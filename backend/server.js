const net = require('net');
const fs  = require('fs');
const path = require('path');

const parseTorrent  = require('./utils/torrentParser');
const PieceManager  = require('./utils/pieceSelector');
const handlePeerWire = require('./peers/peerWire');
const { buildHandshake } = require('./utils/handshake');
const { MAX_CONNECTIONS, MAX_RETRIES } = require('./config');
const {
  sendChoke,
  sendUnchoke,
  sendInterested,
  sendNotInterested,
} = require('./utils/peerMessage');

// ─── Logging ──────────────────────────────────────────────────────────────────
const logPath = path.join(__dirname, 'logs/connections.log');
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, '');

function logConnection(msg) {
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
}

// ─── Module-level download state ──────────────────────────────────────────────
let activePieceManager = null;   // current torrent's piece manager
let activePeerStatus   = [];     // [{ ip, port, attempts, connected, failed }]
let activeConnections  = 0;

// Map of socket → peerState — used by the unchoke timer
const activePeers = new Map();

// Stable peer ID for this process lifetime
const peerId = '-BT0001-' + Math.random().toString(36).substring(2, 14).padEnd(12, '0');

// ─── Tit-for-tat unchoke timer ────────────────────────────────────────────────
const MAX_UNCHOKED   = 3;   // max peers we upload to at once
const UNCHOKE_INTERVAL = 10000; // 10 seconds
let unchokeRound = 0;
let unchokeTimer = null;

function startUnchokeTimer() {
  if (unchokeTimer) return; // only one timer per process

  unchokeTimer = setInterval(() => {
    unchokeRound++;

    const peers = [...activePeers.entries()]; // [socket, peerState]

    // Only consider peers who told us they're interested in downloading from us
    const interested = peers.filter(([, ps]) => ps.peerInterested);

    // Sort by bytes we downloaded from them in the last interval (tit-for-tat)
    interested.sort((a, b) => b[1].downloadedFromPeer - a[1].downloadedFromPeer);

    // Top MAX_UNCHOKED peers get unchoked
    const toUnchoke = new Set(interested.slice(0, MAX_UNCHOKED).map(([s]) => s));

    // Optimistic unchoke: every 3rd round (every 30s), randomly unchoke one
    // additional choked peer so new peers get a chance to prove themselves
    if (unchokeRound % 3 === 0) {
      const stillChoked = interested.slice(MAX_UNCHOKED);
      if (stillChoked.length > 0) {
        const pick = stillChoked[Math.floor(Math.random() * stillChoked.length)];
        toUnchoke.add(pick[0]);
        console.log(`🎲 Optimistic unchoke: giving a slot to a new peer`);
      }
    }

    // Apply decisions
    for (const [socket, ps] of peers) {
      if (toUnchoke.has(socket)) {
        if (ps.amChoking) {
          ps.amChoking = false;
          sendUnchoke(socket);
          console.log(`🔓 Unchoked peer (uploaded ${ps.downloadedFromPeer}B to us this round)`);
        }
      } else {
        if (!ps.amChoking) {
          ps.amChoking = true;
          sendChoke(socket);
          console.log(`⛔ Choked slow/uninterested peer`);
        }
      }

      // Reset rate counter for next interval
      ps.downloadedFromPeer = 0;
    }
  }, UNCHOKE_INTERVAL);
}

// ─── Peer connection ──────────────────────────────────────────────────────────
function tryNextPeer() {
  if (activeConnections >= MAX_CONNECTIONS) return;
  if (!activePieceManager) return;

  const peer = activePeerStatus.find(
    p => !p.connected && !p.failed && p.attempts < MAX_RETRIES
  );
  if (!peer) return;

  peer.attempts++;
  activeConnections++;

  const socket = net.connect(peer.port, peer.ip, () => {
    logConnection(`✅ Connected to ${peer.ip}:${peer.port}`);
    const handshake = buildHandshake(activePieceManager.torrent.infoHash, peerId);
    socket.write(handshake);
  });

  // Full peerState — choked/unchoked from both sides + rate tracking
  const peerState = {
    bitfield:            [],
    choked:              true,   // are THEY choking US  (blocks our downloads)
    amChoking:           true,   // are WE choking THEM  (blocks their uploads from us)
    peerInterested:      false,  // has the peer sent INTERESTED to us
    inFlight:            new Set(),
    downloadedFromPeer:  0,      // bytes received from this peer since last unchoke tick
  };

  // Register in the global peer map so the unchoke timer can see it
  activePeers.set(socket, peerState);

  socket.on('data', data => {
    if (!peer.connected) {
      peer.connected = true;
      sendInterested(socket); // tell peer we want to download
    }
    handlePeerWire(socket, data, activePieceManager, peerState);
  });

  socket.on('error', err => {
    logConnection(`❌ Error ${peer.ip}:${peer.port} — ${err.message}`);
    peer.failed = true;
    activeConnections--;
    activePeers.delete(socket);
    tryNextPeer();
  });

  socket.on('close', () => {
    logConnection(`🔌 Closed ${peer.ip}:${peer.port}`);
    if (peer.connected) sendNotInterested(socket); // polite goodbye
    activeConnections--;
    activePeers.delete(socket);
    tryNextPeer();
  });

  socket.setTimeout(10000, () => {
    logConnection(`⌛ Timeout ${peer.ip}:${peer.port}`);
    socket.destroy();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start downloading a torrent.
 * Accepts either a file path string or a parsed torrent object (from magnetToTorrent).
 * peers: optional array of { host/ip, port } to connect to immediately.
 */
function startDownload(torrentPathOrObject, peers = []) {
  const torrent = typeof torrentPathOrObject === 'string'
    ? parseTorrent(torrentPathOrObject)
    : torrentPathOrObject;

  activePieceManager = new PieceManager(torrent);

  // Normalise peer list — support both { host } and { ip } field names
  activePeerStatus = peers.map(p => ({
    ip:        p.host || p.ip,
    port:      p.port,
    attempts:  0,
    connected: false,
    failed:    false,
  }));

  console.log(`🚀 Starting download: ${torrent.name} (${activePieceManager.totalPieces} pieces, ${peers.length} peers)`);

  startUnchokeTimer();

  for (let i = 0; i < MAX_CONNECTIONS; i++) {
    tryNextPeer();
  }
}

/**
 * Returns live download stats. Safe to call when no download is active.
 */
function getStats() {
  if (!activePieceManager) return { downloaded: 0, total: 0, percent: '0.00' };
  return activePieceManager.getDownloadedStats();
}

module.exports = { startDownload, getStats };

// ─── Entry point guard ────────────────────────────────────────────────────────
// When run directly (`node server.js` / `nodemon server.js`), boot the HTTP API.
// When require()'d by api.js, do nothing — just export the P2P functions above.
// This works without circular-dependency issues because module.exports is set
// before require('./api') is called, so api.js gets the correct exports.
if (require.main === module) {
  require('./api');
}

const net = require('net');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const DHT = require('bittorrent-dht');
const parseMagnet = require('magnet-uri');
const bencode = require('bencode');

const METADATA_BLOCK_SIZE = 16384;
const MAX_PEERS_TO_TRY = 15;      // try more peers in case most are slow/unresponsive
const DHT_LOOKUP_TIMEOUT = 60000;
const METADATA_TIMEOUT = 30000;   // increase to 30s — some peers are slow

// Public HTTP trackers — more reliable than UDP through firewalls
const FALLBACK_HTTP_TRACKERS = [
  'http://tracker.opentrackr.org:1337/announce',
  'http://open.tracker.cl:1337/announce',
  'http://tracker.openbittorrent.com:80/announce',
];

/**
 * Full pipeline: magnet URI → torrent-like object ready for startDownload()
 * Returns a promise that resolves with the torrent metadata object.
 */
function magnetToTorrent(magnetUri) {
  return new Promise((resolve, reject) => {
    // 1. Parse the magnet link
    let parsed;
    try {
      parsed = parseMagnet(magnetUri);
    } catch (err) {
      return reject(new Error('Invalid magnet URI: ' + err.message));
    }

    if (!parsed.infoHash) {
      return reject(new Error('Magnet link missing info hash'));
    }

    const infoHashBuffer = Buffer.from(parsed.infoHash, 'hex');
    const trackers = parsed.announce || [];
    const displayName = parsed.name || parsed.infoHash;

    console.log(`🧲 Magnet parsed: ${displayName}`);
    console.log(`🔑 Info hash: ${parsed.infoHash}`);
    console.log(`📡 Trackers: ${trackers.length}`);

    // 2. Find peers — try HTTP trackers first, fall back to DHT
    const allTrackers = [...(trackers.filter(t => t.startsWith('http'))), ...FALLBACK_HTTP_TRACKERS];

    findPeersViaTrackers(infoHashBuffer, allTrackers, (trackerPeers) => {
      if (trackerPeers.length > 0) {
        console.log(`👥 Found ${trackerPeers.length} peers via tracker`);
        proceedWithPeers(trackerPeers);
      } else {
        console.log('⚠️ No tracker peers found, falling back to DHT...');
        findPeersViaDHT(infoHashBuffer, (err, dhtPeers) => {
          if (err || dhtPeers.length === 0) {
            return reject(new Error('Could not find any peers via trackers or DHT'));
          }
          console.log(`👥 Found ${dhtPeers.length} peers via DHT`);
          proceedWithPeers(dhtPeers);
        });
      }
    });

    function proceedWithPeers(peers) {

      // 3. Fetch metadata from peers
      fetchMetadataFromPeers(peers, infoHashBuffer, (err, metadata) => {
        if (err || !metadata) {
          return reject(new Error('Could not fetch torrent metadata from peers'));
        }

        console.log(`✅ Metadata fetched successfully`);

        // 4. Build torrent object matching our parseTorrent() output shape
        try {
          const torrent = buildTorrentObject(metadata, parsed);
          resolve(torrent);
        } catch (err) {
          reject(new Error('Failed to parse metadata: ' + err.message));
        }
      });
    }
  });
}

// Standard BitTorrent DHT bootstrap nodes — required to join the network
const BOOTSTRAP_NODES = [
  { host: 'router.bittorrent.com',   port: 6881 },
  { host: 'router.utorrent.com',     port: 6881 },
  { host: 'dht.transmissionbt.com',  port: 6881 },
  { host: 'dht.aelitis.com',         port: 6881 },
];

/**
 * Queries HTTP trackers to get peers for an info hash.
 * Much more reliable than DHT on networks with UDP blocked.
 */
function findPeersViaTrackers(infoHashBuffer, trackerUrls, callback) {
  const peers = [];
  let completed = 0;

  if (trackerUrls.length === 0) return callback([]);

  const peerId = crypto.randomBytes(20);

  function percentEncode(buf) {
    return Array.from(buf).map(b => '%' + b.toString(16).padStart(2, '0')).join('');
  }

  trackerUrls.forEach(trackerUrl => {
    try {
      const url = new URL(trackerUrl);
      const query = `info_hash=${percentEncode(infoHashBuffer)}&peer_id=${percentEncode(peerId)}&port=6881&uploaded=0&downloaded=0&left=1&compact=1&numwant=50`;
      const fullUrl = `${url.origin}${url.pathname}?${query}`;
      const protocol = fullUrl.startsWith('https') ? https : http;

      protocol.get(fullUrl, { timeout: 8000 }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          try {
            const data = bencode.decode(Buffer.concat(chunks));
            if (data.peers && Buffer.isBuffer(data.peers)) {
              for (let i = 0; i < data.peers.length; i += 6) {
                peers.push({
                  host: `${data.peers[i]}.${data.peers[i+1]}.${data.peers[i+2]}.${data.peers[i+3]}`,
                  port: data.peers.readUInt16BE(i + 4)
                });
              }
              console.log(`📡 Tracker ${url.hostname}: ${data.peers.length / 6} peers found`);
            } else if (data['failure reason']) {
              console.warn(`📡 Tracker ${url.hostname} failed: ${data['failure reason']}`);
            } else {
              console.warn(`📡 Tracker ${url.hostname}: no peers in response`);
            }
          } catch (e) {
            console.warn(`📡 Tracker ${url.hostname}: decode error - ${e.message}`);
          }
          if (++completed === trackerUrls.length) callback(peers);
        });
      }).on('error', (e) => {
        console.warn(`📡 Tracker ${url.hostname}: connection error - ${e.message}`);
        if (++completed === trackerUrls.length) callback(peers);
      });
    } catch (e) {
      if (++completed === trackerUrls.length) callback(peers);
    }
  });
}

/**
 * Uses bittorrent-dht to discover peers for a given info hash.
 */
function findPeersViaDHT(infoHashBuffer, callback) {
  const dht = new DHT({ bootstrap: BOOTSTRAP_NODES });
  const peers = [];
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    dht.destroy();
    callback(null, peers);
  };

  dht.on('peer', (peer) => {
    peers.push(peer);
    console.log(`🔍 DHT found peer: ${peer.host}:${peer.port} (${peers.length}/${MAX_PEERS_TO_TRY})`);
    if (peers.length >= MAX_PEERS_TO_TRY) finish();
  });

  dht.on('error', (err) => {
    console.warn('DHT error:', err.message);
  });

  // Wait for DHT to be ready before lookup — gives time to connect to bootstrap nodes
  dht.listen(0, () => {
    console.log(`🌐 DHT listening, looking up ${infoHashBuffer.toString('hex')}...`);
    dht.lookup(infoHashBuffer.toString('hex'));
  });

  // Timeout — return whatever peers we found so far
  setTimeout(finish, DHT_LOOKUP_TIMEOUT);
}

/**
 * Tries to fetch metadata from multiple peers in parallel.
 * Returns the first successful metadata buffer.
 */
function fetchMetadataFromPeers(peers, infoHashBuffer, callback) {
  const toTry = peers.slice(0, MAX_PEERS_TO_TRY);
  let done = false;
  let failed = 0;

  if (toTry.length === 0) return callback(new Error('No peers to try'));

  toTry.forEach(peer => {
    console.log(`🔌 Trying peer ${peer.host}:${peer.port} for metadata...`);
    fetchMetadataFromPeer(peer, infoHashBuffer, (err, metadata) => {
      if (done) return;
      if (err) {
        console.warn(`⚠️ Peer ${peer.host}:${peer.port} failed: ${err.message}`);
        failed++;
        if (failed === toTry.length) {
          done = true;
          callback(new Error('All peers failed to provide metadata'));
        }
        return;
      }
      done = true;
      callback(null, metadata);
    });
  });
}

/**
 * Connects to a single peer and fetches torrent metadata via BEP 9 + BEP 10.
 *
 * BEP 10 = Extension protocol handshake (tells peer we support ut_metadata)
 * BEP 9  = Metadata exchange (request/receive metadata pieces)
 */
function fetchMetadataFromPeer(peer, infoHashBuffer, callback) {
  const peerId = crypto.randomBytes(20);
  const socket = net.connect(peer.port, peer.host);
  let buffer = Buffer.alloc(0);
  let metadataSize = null;
  let metadataPieces = {};
  let extensionId = null;
  let handshakeDone = false;
  let done = false;

  const finish = (err, result) => {
    if (done) return;
    done = true;
    socket.destroy();
    callback(err, result);
  };

  socket.setTimeout(METADATA_TIMEOUT, () => finish(new Error('Timeout')));
  socket.on('error', (err) => finish(new Error(`TCP error: ${err.message}`)));

  // Send BitTorrent handshake with extension protocol bit set (BEP 10)
  socket.on('connect', () => {
    console.log(`  ✔ TCP connected to ${peer.host}:${peer.port}, sending handshake...`);
    const handshake = buildExtendedHandshake(infoHashBuffer, peerId);
    socket.write(handshake);
  });

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    // Parse handshake first (68 bytes)
    if (!handshakeDone) {
      if (buffer.length < 68) return;

      // Verify it's a BitTorrent handshake
      const pstrLen = buffer.readUInt8(0);
      if (pstrLen !== 19) return finish(new Error('Not a BitTorrent peer'));

      // Check extension bit (byte 25, bit 4 = supports BEP 10)
      const extensionBit = buffer[25];
      if (!(extensionBit & 0x10)) return finish(new Error('Peer does not support extensions'));

      handshakeDone = true;
      buffer = buffer.slice(68);
      console.log(`  ✔ Handshake OK, sending extension handshake...`);

      // Send BEP 10 extension handshake
      const extHandshake = buildExtensionHandshake();
      socket.write(extHandshake);
    }

    // Parse messages
    while (buffer.length >= 4) {
      const msgLen = buffer.readUInt32BE(0);
      if (msgLen === 0) { buffer = buffer.slice(4); continue; } // keep-alive
      if (buffer.length < 4 + msgLen) break;

      const msg = buffer.slice(4, 4 + msgLen);
      buffer = buffer.slice(4 + msgLen);

      if (msg.length === 0) continue;
      const msgId = msg.readUInt8(0);

      // Extension message (id = 20)
      if (msgId === 20) {
        const extMsgId = msg.readUInt8(1);
        let payload;
        try {
          payload = bencode.decode(msg.slice(2));
        } catch (e) {
          console.warn(`  ⚠️ Failed to decode extension payload: ${e.message}`);
          continue;
        }

        if (extMsgId === 0) {
          // BEP 10 handshake response — get peer's ut_metadata ID + metadata size
          if (payload.m && payload.m.ut_metadata) {
            extensionId = payload.m.ut_metadata; // peer's ID — used when WE request
            metadataSize = payload.metadata_size;

            if (!metadataSize) return finish(new Error('Peer did not send metadata_size'));

            const numPieces = Math.ceil(metadataSize / METADATA_BLOCK_SIZE);
            console.log(`  📦 Requesting ${numPieces} metadata pieces from ${peer.host}...`);
            for (let i = 0; i < numPieces; i++) {
              socket.write(buildMetadataRequest(extensionId, i));
            }
          }
        } else if (extMsgId === 1) {
          // extMsgId === 1 because WE assigned ID 1 to ut_metadata in our handshake
          // Metadata piece: bencoded header dict + raw piece bytes after it
          const rawPayload = msg.slice(2);
          const dictEnd = findBencodeEnd(rawPayload);
          const piece = bencode.decode(rawPayload.slice(0, dictEnd));
          const pieceData = rawPayload.slice(dictEnd);

          if (piece.msg_type === 1 && piece.piece !== undefined) {
            metadataPieces[piece.piece] = pieceData;

            // Check if we have all pieces
            const numPieces = Math.ceil(metadataSize / METADATA_BLOCK_SIZE);
            if (Object.keys(metadataPieces).length === numPieces) {
              const fullMetadata = assembleMetadata(metadataPieces, numPieces);

              // Verify SHA1 of metadata matches info hash
              const hash = crypto.createHash('sha1').update(fullMetadata).digest();
              if (!hash.equals(infoHashBuffer)) {
                return finish(new Error('Metadata hash mismatch'));
              }

              finish(null, fullMetadata);
            }
          }
        }
      }
    }
  });
}

/**
 * Builds a BitTorrent handshake with extension protocol bit set.
 */
function buildExtendedHandshake(infoHash, peerId) {
  const buf = Buffer.alloc(68);
  buf.writeUInt8(19, 0);
  buf.write('BitTorrent protocol', 1, 'utf8');
  // Extension bits: byte 25 bit 4 = supports BEP 10
  buf[25] = 0x10;
  infoHash.copy(buf, 28);
  peerId.copy(buf, 48);
  return buf;
}

/**
 * Builds a BEP 10 extension handshake announcing ut_metadata support.
 */
function buildExtensionHandshake() {
  const payload = bencode.encode({
    m: { ut_metadata: 1 },
    v: 'NodeBT/0.1'
  });
  const msg = Buffer.alloc(6 + payload.length);
  msg.writeUInt32BE(2 + payload.length, 0);
  msg.writeUInt8(20, 4); // extension message id
  msg.writeUInt8(0, 5);  // handshake sub-id
  payload.copy(msg, 6);
  return msg;
}

/**
 * Builds a ut_metadata piece request message.
 */
function buildMetadataRequest(extensionId, piece) {
  const payload = bencode.encode({ msg_type: 0, piece });
  const msg = Buffer.alloc(6 + payload.length);
  msg.writeUInt32BE(2 + payload.length, 0);
  msg.writeUInt8(20, 4);
  msg.writeUInt8(extensionId, 5);
  payload.copy(msg, 6);
  return msg;
}

/**
 * Reassembles ordered metadata pieces into one buffer.
 */
function assembleMetadata(pieces, numPieces) {
  const parts = [];
  for (let i = 0; i < numPieces; i++) {
    parts.push(pieces[i]);
  }
  return Buffer.concat(parts);
}

/**
 * Finds where the bencoded dict ends in a buffer.
 * Used to split bencoded header from raw piece data in metadata messages.
 */
function findBencodeEnd(buf) {
  // Simple approach: try progressively larger slices until decode succeeds
  for (let i = 1; i <= buf.length; i++) {
    try {
      bencode.decode(buf.slice(0, i));
      return i;
    } catch (e) {
      // keep trying
    }
  }
  return buf.length;
}

/**
 * Converts raw metadata buffer + magnet parsed data into our torrent object shape.
 * Matches the output of parseTorrent() so startDownload() works unchanged.
 */
function buildTorrentObject(metadataBuffer, magnetParsed) {
  const info = bencode.decode(metadataBuffer);

  const files = [];
  if (info.files) {
    info.files.forEach(file => {
      const filePath = require('path').join(
        info.name.toString(),
        ...file.path.map(p => p.toString())
      );
      files.push({ path: filePath, length: file.length });
    });
  } else {
    files.push({ path: info.name.toString(), length: info.length });
  }

  const length = files.reduce((acc, f) => acc + f.length, 0);
  const prefix = '-BT0001-';
  const random = Math.random().toString(36).substring(2, 14).padEnd(12, '0');
  const peerId = (prefix + random).substring(0, 20);

  return {
    announce:        magnetParsed.announce?.[0] || '',
    infoHash:        magnetParsed.infoHash,
    infoHashBuffer:  Buffer.from(magnetParsed.infoHash, 'hex'),
    peerId,
    name:            info.name.toString(),
    pieceLength:     info['piece length'],
    pieces:          info.pieces,
    files,
    length
  };
}

module.exports = { magnetToTorrent };

const fs   = require('fs');
const path = require('path');
const { parseMessage, MESSAGE_IDS } = require('../messagePeer');
const { sendPiece }                  = require('../utils/peerMessage');

// How many block requests to keep in-flight per peer at once.
// Pipelining is critical for download speed — with only 1 in-flight request
// at 50ms RTT and 16KB blocks, max speed is 320KB/s. With 10 pipelined: 3.2MB/s.
const PIPELINE_SIZE = 10;

// ─── Block request helpers ────────────────────────────────────────────────────

function sendRequest(socket, index, begin, length) {
  const msg = Buffer.alloc(17);
  msg.writeUInt32BE(13, 0);
  msg.writeUInt8(6, 4);
  msg.writeUInt32BE(index, 5);
  msg.writeUInt32BE(begin, 9);
  msg.writeUInt32BE(length, 13);
  socket.write(msg);
}

function requestBlock(socket, peerState, index, begin, length) {
  const key = `${index}:${begin}`;
  if (peerState.inFlight.has(key)) return;
  peerState.inFlight.add(key);
  sendRequest(socket, index, begin, length);
}

// Fill the request pipeline up to PIPELINE_SIZE outstanding requests.
function fillPipeline(socket, peerState, pieceManager) {
  while (peerState.inFlight.size < PIPELINE_SIZE) {
    const req = pieceManager.nextBlockRequest(peerState.bitfield);
    if (!req) break;
    requestBlock(socket, peerState, req.index, req.begin, req.length);
  }
}

// ─── Per-socket TCP reassembly ────────────────────────────────────────────────

const socketBuffers = new Map();

// ─── Single message handler ───────────────────────────────────────────────────

function processSingleMessage(socket, rawMsg, pieceManager, peerState) {
  const msg = parseMessage(rawMsg);
  if (!msg || msg.id === null) return; // keep-alive or incomplete

  const { id, payload } = msg;

  switch (id) {

    case MESSAGE_IDS.CHOKE:
      peerState.choked = true;
      console.log('⛔ Peer choked us');
      break;

    case MESSAGE_IDS.UNCHOKE:
      peerState.choked = false;
      console.log('🔓 Peer unchoked us — filling request pipeline');
      fillPipeline(socket, peerState, pieceManager);
      break;

    case MESSAGE_IDS.INTERESTED:
      peerState.peerInterested = true;
      console.log('💬 Peer is interested in uploading from us');
      // Unchoke timer in server.js decides whether to unchoke them
      break;

    case MESSAGE_IDS.NOT_INTERESTED:
      peerState.peerInterested = false;
      console.log('💤 Peer lost interest in us');
      break;

    case MESSAGE_IDS.HAVE:
      {
        const { pieceIndex } = payload;
        peerState.bitfield[pieceIndex] = 1;

        if (!peerState.choked && !pieceManager.pieces[pieceIndex]?.received) {
          fillPipeline(socket, peerState, pieceManager);
        }
      }
      break;

    case MESSAGE_IDS.BITFIELD:
      {
        // Convert raw bitfield buffer → boolean array indexed by piece number
        const buf      = payload.bitfield;
        const bitfield = [];
        for (let i = 0; i < buf.length * 8; i++) {
          bitfield.push((buf[Math.floor(i / 8)] >> (7 - i % 8)) & 1);
        }
        peerState.bitfield = bitfield;
        console.log(`🧠 Bitfield received — peer has ${bitfield.filter(Boolean).length} pieces`);

        if (!peerState.choked) {
          fillPipeline(socket, peerState, pieceManager);
        }
      }
      break;

    case MESSAGE_IDS.REQUEST:
      {
        // A peer is asking us to upload a block — only serve if not choking them
        const { index, begin, length } = payload;

        if (peerState.amChoking || !pieceManager.pieces[index]?.received) break;

        try {
          const filePath = path.join(__dirname, '..', 'downloads', pieceManager.torrent.name);
          const offset   = index * pieceManager.pieceLength + begin;
          const buf      = Buffer.alloc(length);
          const fd       = fs.openSync(filePath, 'r');
          fs.readSync(fd, buf, 0, length, offset);
          fs.closeSync(fd);
          sendPiece(socket, index, begin, buf);
          console.log(`📤 Served piece ${index}+${begin} (${length}B)`);
        } catch (e) {
          console.warn(`⚠️ Could not serve piece ${index}: ${e.message}`);
        }
      }
      break;

    case MESSAGE_IDS.CANCEL:
      // Peer cancelled a previous REQUEST — nothing to do since we serve synchronously
      break;

    case MESSAGE_IDS.PIECE:
      {
        const { index, begin, block } = payload;

        // Track bytes received for tit-for-tat scoring
        peerState.downloadedFromPeer += block.length;

        pieceManager.saveBlock(index, begin, block);
        peerState.inFlight.delete(`${index}:${begin}`);

        if (pieceManager.isPieceComplete(index)) {
          const pieceBuffer = pieceManager.assemblePiece(index);

          if (pieceManager.verifyPiece(index, pieceBuffer)) {
            const filePath = path.join(__dirname, '..', 'downloads', pieceManager.torrent.name);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });

            // Use 'r+' (not 'a+') so the explicit byte offset is respected.
            // 'a+' (append mode) ignores position — all writes go to end of file.
            const fileExists = fs.existsSync(filePath);
            const fd = fs.openSync(filePath, fileExists ? 'r+' : 'w');
            fs.writeSync(fd, pieceBuffer, 0, pieceBuffer.length, index * pieceManager.pieceLength);
            fs.closeSync(fd);
            console.log(`✅ Piece ${index} verified and saved`);
          } else {
            console.warn(`❌ Piece ${index} hash mismatch — resetting`);
            pieceManager.resetPiece(index);
          }
        }

        // Keep the request pipeline full — don't wait for more messages
        if (!peerState.choked) {
          fillPipeline(socket, peerState, pieceManager);
        }
      }
      break;

    default:
      // Silently ignore unknown message types (e.g. BEP 10 extension messages)
      break;
  }
}

// ─── Exported handler ─────────────────────────────────────────────────────────

module.exports = function handlePeerWire(socket, data, pieceManager, peerState) {
  // Initialise reassembly buffer for this socket — register the cleanup handler
  // only once so we don't pile up hundreds of once() listeners (one per data chunk).
  if (!socketBuffers.has(socket)) {
    socketBuffers.set(socket, Buffer.alloc(0));
    socket.once('close', () => socketBuffers.delete(socket));
  }

  socketBuffers.set(socket, Buffer.concat([socketBuffers.get(socket), data]));

  let buf = socketBuffers.get(socket);

  while (buf.length >= 4) {
    const msgLen = buf.readUInt32BE(0);
    if (msgLen === 0) { buf = buf.slice(4); continue; } // keep-alive
    if (buf.length < 4 + msgLen) break;                 // wait for more data

    processSingleMessage(socket, buf.slice(0, 4 + msgLen), pieceManager, peerState);
    buf = buf.slice(4 + msgLen);
  }

  socketBuffers.set(socket, buf);
};

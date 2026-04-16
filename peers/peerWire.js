const fs = require('fs');
const path = require('path');

// Constructs a request message for a block
function sendRequest(socket, index, begin = 0, length = 16384) {
  const msg = Buffer.alloc(17);
  msg.writeUInt32BE(13, 0); // Payload length
  msg.writeUInt8(6, 4);     // ID = 6 (request)
  msg.writeUInt32BE(index, 5);
  msg.writeUInt32BE(begin, 9);
  msg.writeUInt32BE(length, 13);
  socket.write(msg);
}
const socketBuffers = new Map();

// Deduplicates block requests — skips if already in-flight for this peer
function requestBlock(socket, peerState, index, begin, length) {
  const key = `${index}:${begin}`;
  if (peerState.inFlight.has(key)) return;
  peerState.inFlight.add(key);
  sendRequest(socket, index, begin, length);
}

function processSingleMessage(socket, data, pieceManager, peerState) {
  if (data.length < 5) return;

  const messageId = data.readUInt8(4);

  switch (messageId) {
    case 0: // CHOKE
    peerState.choked = true;
    console.log("⛔ Peer choked us.");
    break;

  case 1: // UNCHOKE
    peerState.choked = false;
    console.log("🔓 Peer unchoked us.");

    const nextReq = pieceManager.nextBlockRequest(peerState.bitfield);
    if (nextReq) {
      requestBlock(socket, peerState, nextReq.index, nextReq.begin, nextReq.length);
    }
    break;

  case 4: // HAVE
    {
      const pieceIndex = data.readUInt32BE(5);
      peerState.bitfield[pieceIndex] = 1;
      console.log(`📦 Peer has piece ${pieceIndex}`);
    }
    break;

  case 5: // BITFIELD
    {
      const bitfieldBuffer = data.slice(5);
      const bitfield = [];

      for (let i = 0; i < bitfieldBuffer.length * 8; i++) {
        const byte = bitfieldBuffer[Math.floor(i / 8)];
        const hasPiece = (byte >> (7 - i % 8)) & 1;
        bitfield.push(hasPiece);
      }

      peerState.bitfield = bitfield;
      console.log("🧠 Bitfield received");

      const req = pieceManager.nextBlockRequest(bitfield);
      if (!peerState.choked && req) {
        requestBlock(socket, peerState, req.index, req.begin, req.length);
      }
    }
    break;

  case 7: // PIECE
    {
      if (data.length < 13) {
        console.warn(`⚠️ Piece message too short: length=${data.length}`);
        return;
      }

      const index = data.readUInt32BE(5);
      const begin = data.readUInt32BE(9);
      const block = data.slice(13);

      pieceManager.saveBlock(index, begin, block);
      peerState.inFlight.delete(`${index}:${begin}`); // block received, free the slot

      if (pieceManager.isPieceComplete(index)) {
        const pieceBuffer = pieceManager.assemblePiece(index);
        if (pieceManager.verifyPiece(index, pieceBuffer)) {
          const filePath = path.join(__dirname, '..', 'downloads', pieceManager.torrent.name);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });

          const offset = index * pieceManager.pieceLength;
          const fd = fs.openSync(filePath, 'a+');
          fs.writeSync(fd, pieceBuffer, 0, pieceBuffer.length, offset);
          fs.closeSync(fd);

          console.log(`✅ Piece ${index} verified and saved at offset ${offset}`);
        } else {
          console.log(`❌ Piece ${index} failed hash check`);
          pieceManager.resetPiece(index); // clear blocks and retry
        }
      }

      const next = pieceManager.nextBlockRequest(peerState.bitfield);
      if (!peerState.choked && next) {
        requestBlock(socket, peerState, next.index, next.begin, next.length);
      }
    }
    break;

  default:
    console.log(`ℹ️ Unhandled message ID: ${messageId}`);
    break;
}

}

module.exports = function handlePeerWire(socket, data, pieceManager, peerState) {

  // 1. Get or create this socket's buffer
  if (!socketBuffers.has(socket)) {
    socketBuffers.set(socket, Buffer.alloc(0));
  }

  // 2. Append new data to the buffer
  socketBuffers.set(socket, Buffer.concat([socketBuffers.get(socket), data]));

  // 3. Clean up buffer when socket closes
  socket.once('close', () => socketBuffers.delete(socket));

  // 4. Process all complete messages in the buffer
  let buf = socketBuffers.get(socket);

  while (true) {
    // Need at least 4 bytes to read the length prefix
    if (buf.length < 4) break;

    const messageLength = buf.readUInt32BE(0);

    // Keep-alive message (length = 0) — skip it
    if (messageLength === 0) {
      buf = buf.slice(4);
      continue;
    }

    // Check if the full message has arrived yet
    if (buf.length < 4 + messageLength) break;

    // Extract the complete message
    const message = buf.slice(0, 4 + messageLength);
    buf = buf.slice(4 + messageLength);  // remove from buffer

    // Process this single message
    processSingleMessage(socket, message, pieceManager, peerState);

  }

  // Save remaining incomplete data back
  socketBuffers.set(socket, buf);
};

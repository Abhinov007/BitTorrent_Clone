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

module.exports = function handlePeerWire(socket, data, pieceManager, peerState = { bitfield: [], choked: true }) {
  if (data.length < 5) {
    console.warn(`⚠️ Received incomplete message. Length = ${data.length}`);
    return;
  }

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
        sendRequest(socket, nextReq.index, nextReq.begin, nextReq.length);
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
          sendRequest(socket, req.index, req.begin, req.length);
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

        if (pieceManager.isPieceComplete(index)) {
          const pieceBuffer = pieceManager.assemblePiece(index);
          if (pieceManager.verifyPiece(index, pieceBuffer)) {
            const filePath = path.join(__dirname, '..', 'downloads', pieceManager.torrent.name);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });

            const offset = index * pieceManager.pieceLength;
            const fd = fs.openSync(filePath, 'r+');
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
          sendRequest(socket, next.index, next.begin, next.length);
        }
      }
      break;

    default:
      console.log(`ℹ️ Unhandled message ID: ${messageId}`);
      break;
  }
};

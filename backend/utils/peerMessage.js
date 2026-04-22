function createMessage(messageId) {
  const buf = Buffer.alloc(5);
  buf.writeUInt32BE(1, 0);
  buf.writeUInt8(messageId, 4);
  return buf;
}

function sendChoke(socket)         { socket.write(createMessage(0)); }
function sendUnchoke(socket)       { socket.write(createMessage(1)); }
function sendInterested(socket)    { socket.write(createMessage(2)); }
function sendNotInterested(socket) { socket.write(createMessage(3)); }

/**
 * Sends a PIECE message (id=7) — used when uploading a block to a peer.
 */
function sendPiece(socket, index, begin, data) {
  const msg = Buffer.alloc(13 + data.length);
  msg.writeUInt32BE(9 + data.length, 0); // length prefix
  msg.writeUInt8(7, 4);                   // message id = 7
  msg.writeUInt32BE(index, 5);
  msg.writeUInt32BE(begin, 9);
  data.copy(msg, 13);
  socket.write(msg);
}

module.exports = {
  sendChoke,
  sendUnchoke,
  sendInterested,
  sendNotInterested,
  sendUninterested: sendNotInterested, // alias for backwards compat
  sendPiece,
};

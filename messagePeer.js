const MESSAGE_IDS = {
  CHOKE: 0,
  UNCHOKE: 1,
  INTERESTED: 2,
  NOT_INTERESTED: 3,
  HAVE: 4,
  BITFIELD: 5,
  REQUEST: 6,
  PIECE: 7
};

function parseMessage(data) {
  if (data.length < 4) return null;

  const length = data.readUInt32BE(0);

  // Keep-alive
  if (length === 0) return { id: null, payload: null };

  if (data.length < 4 + length) return null; // incomplete, wait for more data

  const id = data.readUInt8(4);
  const payload = data.slice(5, 4 + length);

  switch (id) {
    case 0: // CHOKE
    case 1: // UNCHOKE
    case 2: // INTERESTED
    case 3: // NOT_INTERESTED
      return { id, payload: null };

    case 4: // HAVE
      return { id, payload: { pieceIndex: payload.readUInt32BE(0) } };

    case 5: // BITFIELD
      return { id, payload: { bitfield: payload } }; // raw buffer, caller parses bits

    case 6: // REQUEST
      return { id, payload: {
        index:  payload.readUInt32BE(0),
        begin:  payload.readUInt32BE(4),
        length: payload.readUInt32BE(8)
      }};

    case 7: // PIECE
      return { id, payload: {
        index: payload.readUInt32BE(0),
        begin: payload.readUInt32BE(4),
        block: payload.slice(8)
      }};

    case 8: // CANCEL
      return { id, payload: {
        index:  payload.readUInt32BE(0),
        begin:  payload.readUInt32BE(4),
        length: payload.readUInt32BE(8)
      }};

    default:
      return { id, payload };
  }
}

module.exports = {
  parseMessage,
  MESSAGE_IDS
};

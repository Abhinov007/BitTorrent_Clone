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
  if (length === 0) return null;

  const id = data.readUInt8(4);
  const payload = data.slice(5);

  if (id === 7) {
    const index = payload.readUInt32BE(0);
    const begin = payload.readUInt32BE(4);
    const block = payload.slice(8);
    return { id, payload: { index, begin, block } };
  }

  return { id, payload };
}

module.exports = {
  parseMessage,
  MESSAGE_IDS
};

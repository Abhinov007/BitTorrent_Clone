const MESSAGE_IDS = {
  CHOKE:          0,
  UNCHOKE:        1,
  INTERESTED:     2,
  NOT_INTERESTED: 3,
  HAVE:           4,
  BITFIELD:       5,
  REQUEST:        6,
  PIECE:          7,
  CANCEL:         8,
};

/**
 * Parses a single complete BitTorrent message from a raw buffer.
 * The buffer must include the 4-byte length prefix.
 *
 * Returns:
 *   null                       — buffer too short / incomplete
 *   { id: null, payload: null } — keep-alive (length = 0)
 *   { id, payload }            — parsed message with structured payload
 */
function parseMessage(data) {
  if (data.length < 4) return null;

  const length = data.readUInt32BE(0);
  if (length === 0) return { id: null, payload: null }; // keep-alive
  if (data.length < 4 + length) return null;            // incomplete

  const id      = data.readUInt8(4);
  const payload = data.slice(5, 4 + length);

  switch (id) {
    case MESSAGE_IDS.CHOKE:
    case MESSAGE_IDS.UNCHOKE:
    case MESSAGE_IDS.INTERESTED:
    case MESSAGE_IDS.NOT_INTERESTED:
      return { id, payload: null };

    case MESSAGE_IDS.HAVE:
      return { id, payload: { pieceIndex: payload.readUInt32BE(0) } };

    case MESSAGE_IDS.BITFIELD:
      // Return raw buffer — caller converts bits to boolean array
      return { id, payload: { bitfield: payload } };

    case MESSAGE_IDS.REQUEST:
    case MESSAGE_IDS.CANCEL:
      return { id, payload: {
        index:  payload.readUInt32BE(0),
        begin:  payload.readUInt32BE(4),
        length: payload.readUInt32BE(8),
      }};

    case MESSAGE_IDS.PIECE:
      return { id, payload: {
        index: payload.readUInt32BE(0),
        begin: payload.readUInt32BE(4),
        block: payload.slice(8),
      }};

    default:
      return { id, payload }; // unknown extension — pass raw payload through
  }
}

module.exports = { parseMessage, MESSAGE_IDS };

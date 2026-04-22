/**
 * Builds the 68-byte BitTorrent handshake.
 *
 * Byte layout:
 *   [0]      pstrlen = 19
 *   [1..19]  "BitTorrent protocol"
 *   [20..27] reserved extension bits
 *              byte 25 bit 4 (0x10) = BEP 10 extension protocol support
 *   [28..47] info_hash (20 bytes)
 *   [48..67] peer_id   (20 bytes)
 */
function buildHandshake(infoHash, peerId) {
  const buffer = Buffer.alloc(68);

  buffer.writeUInt8(19, 0);
  buffer.write('BitTorrent protocol', 1, 'utf8');

  // Extension bits — signal BEP 10 (ut_metadata, ut_pex) support
  buffer[25] = 0x10;

  // infoHash may arrive as hex string or Buffer
  const infoHashBuf = Buffer.isBuffer(infoHash)
    ? infoHash
    : Buffer.from(infoHash, 'hex');
  infoHashBuf.copy(buffer, 28);

  // peerId may arrive as string or Buffer
  const peerIdBuf = Buffer.isBuffer(peerId)
    ? peerId
    : Buffer.from(peerId);
  peerIdBuf.copy(buffer, 48);

  return buffer;
}

module.exports = { buildHandshake };

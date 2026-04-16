
function buildHandshake(infoHash, peerId) {
    const buffer = Buffer.alloc(68)
    buffer.writeUInt8(19, 0) // length of pstr
    buffer.write("BitTorrent protocol", 1) // pstr
    Buffer.alloc(8).copy(buffer, 20) // reserved
    Buffer.from(infoHash, 'hex').copy(buffer, 28) // info_hash
    Buffer.from(peerId).copy(buffer, 48) // peer_id
    return buffer
  }
  
  module.exports = { buildHandshake }
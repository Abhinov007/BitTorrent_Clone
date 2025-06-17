const fs = require("fs");
const bencode = require("bencode");
const crypto = require("crypto");

function generatePeerId() {
  const prefix = '-BT0001-'; // 8 characters
  const random = Math.random().toString(36).substring(2, 18).padEnd(12, '0'); // 12 characters
  return (prefix + random).substring(0, 20); // Ensure exactly 20 bytes
}

function parseTorrent(filePath) {
  const torrent = bencode.decode(fs.readFileSync(filePath));
  const info = torrent.info;
  const infoBuffer = bencode.encode(info);
  const infoHash = crypto.createHash("sha1").update(infoBuffer).digest("hex");

  // Safely extract announce URL
  let announce = '';
  if (torrent['announce']) {
    announce = torrent['announce'].toString();
  } else if (torrent['announce-list'] && Array.isArray(torrent['announce-list'])) {
    // Get the first tracker URL in the list
    const list = torrent['announce-list'][0];
    if (list && list.length > 0) {
      announce = list[0].toString();
    }
  }

   return {
    announce: torrent['announce'].toString(),
    infoHash,
    peerId: generatePeerId(), 
    length: info.length,
    name: info.name.toString(),
    pieceLength: info['piece length'],
    pieces: info.pieces,
  };
}

module.exports = parseTorrent;

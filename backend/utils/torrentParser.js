const fs = require("fs");
const bencode = require("bencode");
const crypto = require("crypto");
const path = require("path");

function generatePeerId() {
  const prefix = '-BT0001-';
  const random = Math.random().toString(36).substring(2, 14).padEnd(12, '0');
  return (prefix + random).substring(0, 20);
}

function sha1(buffer) {
  return crypto.createHash("sha1").update(buffer).digest();
}

function parseTorrent(filePath) {
  const torrentRaw = fs.readFileSync(filePath);
  const torrent = bencode.decode(torrentRaw);
  const info = torrent.info;
  const infoBuffer = bencode.encode(info);
  const infoHashBuffer = sha1(infoBuffer);
  const infoHashHex = infoHashBuffer.toString("hex");

  // Extract announce URL
  let announce = '';
  if (torrent['announce']) {
    announce = torrent['announce'].toString();
  } else if (torrent['announce-list']) {
    const announceList = torrent['announce-list'];
    if (Array.isArray(announceList) && announceList.length > 0 && announceList[0].length > 0) {
      announce = announceList[0][0].toString();
    }
  }

  // Handle multi-file or single-file torrent
  const files = [];
  if (info.files) {
    // Multi-file mode
    info.files.forEach(file => {
      const filePath = path.join(info.name.toString(), ...file.path.map(p => p.toString()));
      files.push({ path: filePath, length: file.length });
    });
  } else {
    // Single-file mode
    files.push({ path: info.name.toString(), length: info.length });
  }

  // Calculate total length
  const length = files.reduce((acc, file) => acc + file.length, 0);

  return {
    announce,
    infoHash: infoHashHex,
    infoHashBuffer,
    peerId: generatePeerId(),
    name: info.name.toString(),
    pieceLength: info["piece length"],
    pieces: info.pieces,
    files,
    length // ✅ Added here
  };
}


module.exports = parseTorrent;

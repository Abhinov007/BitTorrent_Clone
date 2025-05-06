const fs = require('fs');
const parseTorrent = require('parse-torrent');

const torrent = parseTorrent(fs.readFileSync('./ubuntu.torrent'));


console.log('Info Hash:', torrent.infoHash);          // ✅ String format
console.log('Info Hash Buffer:', torrent.infoHashBuffer);  // ✅ Buffer (used in handshake)
console.log('Trackers:', torrent.announce);  

const infoHash = '611f70899d4e1d6a9c39cfc925f103dfef630328'; // Ubuntu ISO test torrent
const peerId = '-UT0001-' + Math.random().toString(36).substring(2, 14).padEnd(12, '0')
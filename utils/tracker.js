const url = require('url');
const http = require('http');

function buildTrackerUrl(torrent, port = 6881) {
  const parsed = url.parse(torrent.announce);
  const query = new URLSearchParams({
    info_hash: torrent.infoHash.toString('binary'),
    peer_id: torrent.peerId,
    port,
    uploaded: 0,
    downloaded: 0,
    left: torrent.length,
    compact: 1,
    event: 'started',
  });

  return `${parsed.href}?${query}`;
}

function getPeers(torrent, callback) {
  const trackerUrl = buildTrackerUrl(torrent);

  http.get(trackerUrl, (res) => {
    const chunks = [];

    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      const response = Buffer.concat(chunks);
      const trackerData = require('bencode').decode(response);
      const peers = parsePeers(trackerData.peers);
      callback(peers);
    });
  });
}

function parsePeers(peersBuffer) {
  const peers = [];
  for (let i = 0; i < peersBuffer.length; i += 6) {
    const ip = `${peersBuffer[i]}.${peersBuffer[i+1]}.${peersBuffer[i+2]}.${peersBuffer[i+3]}`;
    const port = peersBuffer.readUInt16BE(i + 4);
    peers.push({ ip, port });
  }
  return peers;
}

module.exports = getPeers;

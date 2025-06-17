const http = require('http');
const https = require('https');
const { URL } = require('url');
const bencode = require('bencode');

function percentEncode(buffer) {
  return Array.from(buffer)
    .map(byte => '%' + byte.toString(16).padStart(2, '0'))
    .join('');
}

function buildTrackerUrl(torrent, peerId, port = 6881) {
  const baseUrl = Array.isArray(torrent.announce) ? torrent.announce[0] : torrent.announce;

  const infoHash = Buffer.from(torrent.infoHash, 'hex');
  const peerIdBuf = Buffer.from(peerId);

  const urlObj = new URL(baseUrl);
  const query =
    `info_hash=${percentEncode(infoHash)}` +
    `&peer_id=${percentEncode(peerIdBuf)}` +
    `&port=${port}` +
    `&uploaded=0` +
    `&downloaded=0` +
    `&left=${torrent.length || 0}` +
    `&compact=1`;

  return `${urlObj.origin}${urlObj.pathname}?${query}`;
}

function getPeers(torrent, callback) {
  try {
    const trackerUrl = buildTrackerUrl(torrent, torrent.peerId);
    const parsedUrl = new URL(trackerUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    protocol.get(trackerUrl, (res) => {
      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const response = Buffer.concat(chunks);
          const trackerData = bencode.decode(response);

          if (!trackerData.peers) {
            console.error('Tracker response missing peers field');
            return callback([]);
          }

          let peers;

          if (Buffer.isBuffer(trackerData.peers)) {
            // Compact peer list
            peers = parsePeers(trackerData.peers);
          } else if (Array.isArray(trackerData.peers)) {
            // Dictionary peer list (not common, but supported)
            peers = trackerData.peers.map(p => ({
              ip: p.ip.toString(),
              port: p.port
            }));
          } else {
            console.error('Unexpected peers format from tracker');
            return callback([]);
          }

          callback(peers);
        } catch (e) {
          console.error('Error decoding tracker response:', e.message);
          callback([]);
        }
      });
    }).on('error', (err) => {
      console.error('Error communicating with tracker:', err.message);
      callback([]);
    });
  } catch (err) {
    console.error('Invalid tracker URL:', err.message);
    callback([]);
  }
}

function parsePeers(peersData) {
  const peers = [];

  if (Buffer.isBuffer(peersData)) {
    // 👈 Compact format
    for (let i = 0; i < peersData.length; i += 6) {
      const ip = `${peersData[i]}.${peersData[i + 1]}.${peersData[i + 2]}.${peersData[i + 3]}`;
      const port = peersData.readUInt16BE(i + 4);
      peers.push({ ip, port });
    }
  } else if (Array.isArray(peersData)) {
    // 👈 Dictionary format
    for (const peer of peersData) {
      peers.push({
        ip: peer.ip.toString(),
        port: peer.port,
        peerId: peer['peer id'] ? peer['peer id'].toString('utf8') : undefined,
      });
    }
  } else {
    console.warn("Unknown peer format from tracker.");
  }

  return peers;
}


module.exports = getPeers;

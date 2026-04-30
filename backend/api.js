const express = require('express');
const fileUpload = require('express-fileupload');
const parseTorrent = require('./utils/torrentParser');
const getTrackerPeers = require('./utils/tracker');
const path = require('path');
const fs = require('fs');
const { startDownload, getStats, getPeers, pauseDownload, resumeDownload, deleteDownload } = require('./server');
const { magnetToTorrent } = require('./utils/magnetHandler');
const crypto = require('crypto');
const { PORT, UPLOAD_PATH, DOWNLOAD_PATH, PROWLARR_URL, PROWLARR_API_KEY, SEARCH_LIMIT } = require('./config');
const axios = require('axios');




const app = express();
app.use(express.json());
app.use(fileUpload());

// create uploads folder if not exists
  const uploadPath = path.join(__dirname, UPLOAD_PATH);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

app.get('/api/status', (req, res) => {
  res.json(getStats());
});

app.post('/api/download/pause', (req, res) => {
  pauseDownload();
  res.json({ message: 'Download paused' });
});

app.post('/api/download/resume', (req, res) => {
  resumeDownload();
  res.json({ message: 'Download resumed' });
});

app.get('/api/download/peers', (req, res) => {
  res.json(getPeers());
});

app.post('/api/download/delete', (req, res) => {
  const deleteFiles = req.body?.deleteFiles === true;
  deleteDownload(deleteFiles);
  res.json({ message: deleteFiles ? 'Download removed and files deleted' : 'Download removed' });
});

app.get('/api/peers', (req, res) => {
  res.json({ message: "Use POST /api/peers to upload a .torrent file" });
});

app.post('/api/peers', (req, res) => {
  if (!req.files || !req.files.torrent) {
    return res.status(400).send('No torrent file uploaded');
  }

  const torrentFile = req.files.torrent;
  const randomName = crypto.randomBytes(16).toString('hex') + '.torrent';
  const savePath = path.join(uploadPath, randomName);

  torrentFile.mv(savePath, err => {
    if (err) return res.status(500).send('Upload failed');

    try {
      const parsed = parseTorrent(savePath);
      console.log("Parsed:", parsed);

      getTrackerPeers(parsed, peers => {
        res.json({ peers });
        // Pass tracker peers directly to the downloader so it can connect immediately
        startDownload(savePath, peers);
      });
    } catch (err) {
      console.error("Error communicating with tracker:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

app.get('/api/search', async (req, res) => {
  const query = req.query.q?.trim();
  const limit = Math.min(parseInt(req.query.limit) || SEARCH_LIMIT, 50);

  // Validate query
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    const response = await axios.get(`${PROWLARR_URL}/api/v1/search`, {
      params: {
        apikey: PROWLARR_API_KEY,
        query:  query,
        type:   'search'
      },
      timeout: 15000
    });

    // Prowlarr returns JSON as a string — parse it manually
    const parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    const results = Array.isArray(parsed) ? parsed : parsed?.results || parsed?.Results || [];

    // Normalize Prowlarr response to consistent shape and sort by seeders
    const normalized = results
      .map(r => ({
        title:      r.title,
        size:       r.size,
        seeders:    r.seeders,
        leechers:   r.leechers,
        infoHash:   r.infoHash    || null,
        magnetLink: (r.magnetUrl && r.magnetUrl.startsWith('magnet:')) ? r.magnetUrl : null,
        torrentUrl: r.downloadUrl || (r.magnetUrl && !r.magnetUrl.startsWith('magnet:') ? r.magnetUrl : null) || null,
        source:     r.indexer      || 'unknown'
      }))
      .filter(r => r.torrentUrl || r.magnetLink)
      .sort((a, b) => b.seeders - a.seeders)
      .slice(0, limit);

    res.json({ results: normalized });

  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed. Is Prowlarr running at ' + PROWLARR_URL + '?' });
  }
});

app.post('/api/download/url', async (req, res) => {
  const { torrentUrl } = req.body;

  if (!torrentUrl) {
    return res.status(400).json({ error: 'torrentUrl is required' });
  }

  try {
    // Fetch the .torrent file from the URL
    const response = await axios.get(torrentUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // increased to 30s — Prowlarr proxy can be slow
      maxRedirects: 5, // follow redirects from indexers
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/x-bittorrent, */*'
      } // some sites reject non-browser requests
    });

    if (!response.data || response.data.byteLength === 0) {
      return res.status(500).json({ error: 'Empty response from indexer' });
    }

    // Check if response is a magnet link instead of a .torrent file (YTS does this)
    const bodyText = Buffer.from(response.data).toString('utf8', 0, 100).trim();
    if (bodyText.startsWith('magnet:')) {
      const magnet = Buffer.from(response.data).toString('utf8').trim();
      console.log('🔁 URL resolved to magnet link, switching to DHT handler...');
      const { torrent, peers } = await magnetToTorrent(magnet);
      startDownload(torrent, peers);
      return res.json({ message: 'Download started via magnet', name: torrent.name });
    }

    // Save with a random name
    const randomName = crypto.randomBytes(16).toString('hex') + '.torrent';
    const savePath = path.join(uploadPath, randomName);
    fs.writeFileSync(savePath, response.data);

    // Parse and start download
    const parsed = parseTorrent(savePath);
    startDownload(savePath);

    res.json({ message: 'Download started', name: parsed.name });

  } catch (err) {
    // Prowlarr redirected to a magnet: URI — axios can't follow it, extract from error
    if (err.message && err.message.includes('magnet:')) {
      const magnetMatch = err.message.match(/(magnet:[^\s"]+)/);
      if (magnetMatch) {
        console.log('🔁 Caught magnet redirect, switching to magnet handler...');
        try {
          const { torrent, peers } = await magnetToTorrent(magnetMatch[1]);
          startDownload(torrent, peers);
          return res.json({ message: 'Download started via magnet', name: torrent.name });
        } catch (magnetErr) {
          return res.status(500).json({ error: 'Magnet fallback failed: ' + magnetErr.message });
        }
      }
    }

    if (err.response) {
      const status = err.response.status;
      if (status === 429) {
        console.warn(`⚠️ Indexer rate-limited (429) — client will retry via magnet/hash`);
        return res.status(429).json({ error: 'Indexer rate limit hit — try again in a moment' });
      }
      console.warn(`⚠️ Indexer returned ${status} — client will retry via fallback`);
      return res.status(502).json({ error: `Indexer returned ${status} — try a different result` });
    }
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request timed out — indexer is too slow' });
    }
    console.error('Download error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/download/magnet', async (req, res) => {
  const { magnetLink } = req.body;

  if (!magnetLink || !magnetLink.startsWith('magnet:')) {
    return res.status(400).json({ error: 'Valid magnetLink is required' });
  }

  console.log(`🧲 Starting magnet download...`);

  try {
    res.json({ message: 'Fetching metadata via DHT...', magnetLink });
    const { torrent, peers } = await magnetToTorrent(magnetLink);
    startDownload(torrent, peers);
    console.log(`✅ Magnet download started: ${torrent.name} with ${peers.length} peers`);
  } catch (err) {
    console.error('Magnet download error:', err.message);
  }
});

app.post('/api/download/hash', async (req, res) => {
  const { infoHash, title } = req.body;

  if (!infoHash) {
    return res.status(400).json({ error: 'infoHash is required' });
  }

  // Build a magnet link with a comprehensive set of HTTP + UDP trackers.
  // UDP trackers (udp://) are handled by the UDP tracker client in magnetHandler.js
  // and tend to have far better peer coverage than HTTP trackers.
  const trackers = [
    // HTTP/HTTPS — work through firewalls, never blocked
    'http://bt1.archive.org:6969/announce',
    'http://bt2.archive.org:6969/announce',
    'http://tracker.openbittorrent.com:80/announce',
    'http://open.stealth.si:80/announce',
    'https://opentracker.i2p.rocks:443/announce',
    'https://tracker.tamersunion.org:443/announce',
    'https://tracker.lilithraws.org:443/announce',
    'https://tracker.gbitt.info:443/announce',
    'http://tracker.opentrackr.org:1337/announce',
    'http://open.tracker.cl:1337/announce',
    'http://tracker.bt4g.com:2095/announce',
    'https://tracker.renfei.net/announce',
    // UDP — highest coverage, used by most popular clients (μTorrent, qBittorrent…)
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.tracker.cl:1337/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.tiny-vps.com:6969/announce',
    'udp://tracker.moeking.me:6969/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.dler.org:6969/announce',
    'udp://retracker.lanta-net.ru:2710/announce',
  ].map(t => `&tr=${encodeURIComponent(t)}`).join('');

  const dn = title ? `&dn=${encodeURIComponent(title)}` : '';
  const magnetLink = `magnet:?xt=urn:btih:${infoHash}${dn}${trackers}`;

  console.log(`🔑 Starting download from infoHash: ${infoHash}`);

  try {
    res.json({ message: 'Fetching metadata via DHT...', infoHash });
    const { torrent, peers } = await magnetToTorrent(magnetLink);
    startDownload(torrent, peers);
    console.log(`✅ Download started: ${torrent.name} with ${peers.length} peers`);
  } catch (err) {
    console.error('Hash download error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});


module.exports = { app };
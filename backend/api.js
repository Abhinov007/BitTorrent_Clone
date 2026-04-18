const express = require('express');
const fileUpload = require('express-fileupload');
const parseTorrent = require('./utils/torrentParser');
const getPeers = require('./utils/tracker');
const path = require('path');
const fs = require('fs');
const pieceManager = require('./utils/pieceSelector');
const { startDownload } = require('./server');
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
  const stats = pieceManager.getDownloadedStats();
  res.json(stats);
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

      getPeers(parsed, peers => {
        res.json({ peers });
      });
      startDownload(savePath);
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
        magnetLink: r.magnetUrl    || null,
        torrentUrl: r.downloadUrl  || null,
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
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' } // some sites reject non-browser requests
    });

    // Save with a random name
    const randomName = crypto.randomBytes(16).toString('hex') + '.torrent';
    const savePath = path.join(uploadPath, randomName);
    fs.writeFileSync(savePath, response.data);

    // Parse and start download
    const parsed = parseTorrent(savePath);
    startDownload(savePath);

    res.json({ message: 'Download started', name: parsed.name });

  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).json({ error: 'Failed to fetch or start download' });
  }
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});


module.exports = { app };
const express = require('express');
const fileUpload = require('express-fileupload');
const parseTorrent = require('./utils/torrentParser');
const getPeers = require('./utils/tracker');
const path = require('path');
const fs = require('fs');
const pieceManager = require('./utils/pieceSelector');

const PORT = 8000;
const app = express();
app.use(fileUpload());

// create uploads folder if not exists
const uploadPath = path.join(__dirname, 'uploads');
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
  const savePath = path.join(uploadPath, torrentFile.name);

  torrentFile.mv(savePath, err => {
    if (err) return res.status(500).send('Upload failed');

    try {
      const parsed = parseTorrent(savePath);
      console.log("Parsed:", parsed);

      getPeers(parsed, peers => {
        res.json({ peers });
      });
    } catch (err) {
      console.error("Error communicating with tracker:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});

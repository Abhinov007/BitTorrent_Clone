const express= require('express');
const fileUpload = require('express-fileupload');
const parseTorrent = require('./utils/torrentParser');
const getPeers = require('./utils/tracker');
const PORT= 8000;

const app= express();
app.use(fileUpload());

app.get('/api/peers', (req, res) => {
    res.json(peerStatus);
  });
  
app.post('/api/peers', (req, res) => {
  const torrentFile = req.files.torrent;
  const savePath = __dirname + '/uploads/' + torrentFile.name;

  torrentFile.mv(savePath, err => {
    if (err) return res.status(500).send('Upload failed');

    const parsed = parseTorrent(savePath);
    getPeers(parsed, peers => {
      res.json({ peers });
    });
  });
});



  
  app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
  });
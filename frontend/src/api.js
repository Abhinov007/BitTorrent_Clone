import axios from 'axios';

/**
 * Search for torrents via Prowlarr.
 * @param {string} query
 * @param {number} limit
 */
export async function searchTorrents(query, limit = 20) {
  const { data } = await axios.get('/api/search', {
    params: { q: query, limit }
  });
  return data.results; // array of { title, size, seeders, leechers, infoHash, magnetLink, torrentUrl, source }
}

/**
 * Start a download from a .torrent file URL (Prowlarr proxy URL).
 */
export async function downloadByUrl(torrentUrl) {
  const { data } = await axios.post('/api/download/url', { torrentUrl });
  return data;
}

/**
 * Start a download from a magnet link.
 */
export async function downloadByMagnet(magnetLink) {
  const { data } = await axios.post('/api/download/magnet', { magnetLink });
  return data;
}

/**
 * Start a download from an info hash (builds magnet + tracker list server-side).
 */
export async function downloadByHash(infoHash, title) {
  const { data } = await axios.post('/api/download/hash', { infoHash, title });
  return data;
}

/**
 * Poll the current global download status.
 * Returns { downloaded, total, percent }
 */
export async function getStatus() {
  const { data } = await axios.get('/api/status');
  return data;
}

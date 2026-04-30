require('dotenv').config();

module.exports = {
  PORT:            parseInt(process.env.PORT)            || 8000,
  PEER_PORT:       parseInt(process.env.PEER_PORT)       || 6881,
  MAX_CONNECTIONS: parseInt(process.env.MAX_CONNECTIONS) || 10,
  MAX_RETRIES:     parseInt(process.env.MAX_RETRIES)     || 5,
  BLOCK_SIZE:      parseInt(process.env.BLOCK_SIZE)      || 16384,
  SOCKET_TIMEOUT:  parseInt(process.env.SOCKET_TIMEOUT)  || 10000,
  UPLOAD_PATH:     process.env.UPLOAD_PATH               || './uploads',
  DOWNLOAD_PATH:   process.env.DOWNLOAD_PATH             || './downloads',
  PROWLARR_URL:    process.env.PROWLARR_URL              || 'http://localhost:9696',
  PROWLARR_API_KEY: process.env.PROWLARR_API_KEY         || '',
  SEARCH_LIMIT:    parseInt(process.env.SEARCH_LIMIT)    || 20,
};
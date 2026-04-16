require('dotenv').config();

module.exports = {
  PORT:            parseInt(process.env.PORT)            || 8000,
  PEER_PORT:       parseInt(process.env.PEER_PORT)       || 6881,
  MAX_CONNECTIONS: parseInt(process.env.MAX_CONNECTIONS) || 4,
  MAX_RETRIES:     parseInt(process.env.MAX_RETRIES)     || 2,
  BLOCK_SIZE:      parseInt(process.env.BLOCK_SIZE)      || 16384,
  SOCKET_TIMEOUT:  parseInt(process.env.SOCKET_TIMEOUT)  || 10000,
  UPLOAD_PATH:     process.env.UPLOAD_PATH               || './uploads',
  DOWNLOAD_PATH:   process.env.DOWNLOAD_PATH             || './downloads',
};
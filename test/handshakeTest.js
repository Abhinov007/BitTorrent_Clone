const { buildHandshake } = require('../utils/handshake');

const infoHash = '611f70899d4e1d6a9c39cfc925f103dfef630328';
const peerId = '-UT0001-' + Math.random().toString(36).substring(2, 14).padEnd(12, '0');

const handshake = buildHandshake(infoHash, peerId);

// Display output for testing
console.log('Handshake buffer length:', handshake.length);
console.log('Handshake buffer (hex):', handshake.toString('hex'));
console.log('Protocol string:', handshake.slice(1, 20).toString());
console.log('Info hash:', handshake.slice(28, 48).toString('hex'));
console.log('Peer ID:', handshake.slice(48, 68).toString());
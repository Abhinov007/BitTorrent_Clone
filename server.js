const net = require('net');
const fs = require('fs');
const parseTorrent = require('./utils/torrentParser');
const PieceManager = require('./utils/pieceSelector');
const handlePeerWire = require('./peers/peerWire');
const path = require('path');
const { buildHandshake } = require('./utils/handshake');
const {app}= require('./api')

const {
  sendChoke,
  sendUnchoke,
  sendInterested,
  sendNotInterested
} = require('./utils/peerMessage');
const MAX_CONNECTIONS = 4;
const MAX_RETRIES = 2;

const logPath = path.join(__dirname, 'logs/connections.log');
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, ''); // Clear previous logs

const torrent = parseTorrent("ubuntu.torrent");
const pieceManager = new PieceManager(torrent);


const infoHash = '611f70899d4e1d6a9c39cfc925f103dfef630328'; // Ubuntu ISO test torrent
const peerId = '-UT0001-' + Math.random().toString(36).substring(2, 14).padEnd(12, '0')

const peerList = [
  { ip: '2600:1702:4fb0:acdf:dacb:8aff:fe72:fac0', port: 42070 },
  { ip: '2a00:23c7:acea:a801:c635:4a3a:11aa:e14c', port: 49100 },
  { ip: 'facepalm.jpe.gs', port: 57070 },
  { ip: 'distro-seeder-vm.vmbr1.hel1.moderateinfra.net', port: 42787 },
  { ip: '2408:8276:3219:ff71::e2e', port: 63219 },
  { ip: '2a00:1370:819a:5125:93f8:49b2:c0cb:c863', port: 51413 },
  { ip: '2001:bc8:1203:2b9::10', port: 51413 },
  { ip: '2a01:e0a:d5b:2100::1', port: 13249 },
  { ip: '2a00:6020:504e:9400:211:32ff:feb7:b351', port: 51413 },
  { ip: '2a01:e0a:204:18e0:55d2:6bc9:1efe:7099', port: 14934 },
  { ip: '2607:fea8:fdf0:825b:5ba3:d3d7:a975:379', port: 51413 },
  { ip: '2602:feb4:7c:cc00:f0db:20fe:3dcd:526c', port: 19481 },
  { ip: '2a01:e0a:352:2450:211:32ff:fed8:cacb', port: 63810 },
  { ip: '2606:83c0:b801:c600:a4ab:d92e:a931:831f', port: 57350 },
  { ip: '2a01:e0a:54d:4110:4c47:70fa:ac0c:aa3b', port: 51413 },
  { ip: '2a06.4004.c200.0000.0000.0000.0000.0015.static6.kviknet.net', port: 51413 },
  { ip: '2a02:247a:210:a800::1', port: 6962 },
  { ip: '2a00:6800:3:f49::100', port: 51413 },
  { ip: '2001:470:7a83:6f74:0:7069:7261:7465', port: 6979 },
  { ip: '2804:7f0:d889:13f:7c55:e366:a7e:dd2', port: 51413 },
  { ip: '2408:8207:2563:4730::683', port: 49528 },
  { ip: '2c0f:eb58:651:fb00:a197:9321:ebcd:68e8', port: 19749 },
  { ip: '2001:da8:208:181:40f2:c346:b274:73da', port: 40433 },
  { ip: '2001:41d0:a:6785::1', port: 6939 },
  { ip: '2001:41d0:a:6785::1', port: 6939 },
  { ip: '2a0d:c580:1:3:89::1', port: 29855 },
  { ip: '2a0d:c580:1:3:89::1', port: 29855 },
  { ip: '2a01:e0a:204:18e0:e5bd:28bb:671e:218', port: 14934 },
  { ip: '2a02:8071:5151:700:f491:de5c:ff4e:4ba7', port: 56789 },
  { ip: '240e:390:5248:5e20:d200:6ff:fe12:a32', port: 63219 },
  { ip: '240e:390:5248:5e20:d200:6ff:fe12:a32', port: 63219 },
  { ip: '2a0c:5a82:180b:e00:8b32:8708:56b6:e963', port: 45201 },
  { ip: '2a0c:5a82:180b:e00:8b32:8708:56b6:e963', port: 45201 },
  { ip: '2a01:e0a:4a2:f6b0::1', port: 47974 },
  { ip: '2a01:e0a:4a2:f6b0::1', port: 47974 },
  { ip: '2600:1700:7781:32d0:b204:7c3:77de:a559', port: 15837 },
  { ip: '2600:1700:7781:32d0:b204:7c3:77de:a559', port: 15837 },
  { ip: '2a02:8071:5151:700:f491:de5c:ff4e:4ba7', port: 56789 }
];


let activeConnections = 0;

const peerStatus = peerList.map(p => ({
  ...p,
  attempts: 0,
  connected: false,
  failed: false,
}));

function logConnection(message) {
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
}

function tryNextPeer() {
  if (activeConnections >= MAX_CONNECTIONS) return;

  const peer = peerStatus.find(p => !p.connected && !p.failed && p.attempts < MAX_RETRIES);
  if (!peer) return;

  peer.attempts++;
  activeConnections++;

  const socket = net.connect(peer.port, peer.ip, () => {
    logConnection(`✅ Connected to ${peer.ip}:${peer.port}`);
    const handshake = buildHandshake(infoHash, peerId);
    socket.write(handshake);
  });

  socket.on('data', data => {
    console.log(`Received from ${peer.ip}:${peer.port}:`, data.toString('hex').slice(0, 40), '...');
  
    if (!peer.connected) {
      peer.connected = true;
  
      // Send interested message
      sendInterested(socket);
  
      //  Automatically unchoke this peer (pretending you're a seeder)
      setTimeout(() => {
        sendUnchoke(socket);
      }, 1000);
  
      //  Choke them later (simulate bandwidth policy)
      setTimeout(() => {
        sendChoke(socket);
      }, 8000);
    }
  });

  const peerState = { bitfield: [], choked: true };
  socket.on('data', data => {
  handlePeerWire(socket, data, pieceManager, peerState);
});

  socket.on('error', err => {
    logConnection(`❌ Error: ${peer.ip}:${peer.port} - ${err.message}`);
    peer.failed = true;
    activeConnections--;
    tryNextPeer();
  });

  socket.on('close', () => {
    logConnection(`🔌 Closed: ${peer.ip}:${peer.port}`);
    activeConnections--;
    tryNextPeer();
  });

  socket.setTimeout(10000, () => {
    logConnection(`⌛Timemeout: ${peer.ip}:${peer.port}`);
    socket.destroy();
  });
}

// Start connections
for (let i = 0; i < 10; i++) {
  tryNextPeer();
}
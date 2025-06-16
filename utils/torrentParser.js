const fs= require("fs");
const bencode = require('bencode');
const crypto = require("crypto");


function parseTorrent(filePath){
 const torrent= bencode.decode(fs.readFileSync(filePath))
 const info= torrent.info;
 const infoBuffer= bencode.encode(info);
 const InfoHash= crypto.createHash('sha1').update(infoBuffer).digest();

 return{
    announce: torrent['announce'].toString(),
    InfoHash,
    peerId:'-BT0001'+ Math.random().toString(36).substring(2,14).padEnd(12,'0'),
    length:info.length,
    name: info.name.toString(),
    pieceLength: info['pieceLength'],
    piece: info.piece,
 };
}

module.exports=parseTorrent;
function createMessage(messageId){
    const length=  Buffer.alloc(5);
    length.writeUInt32BE(1,0);
    length.writeUInt8(messageId,4);
    return length;
}

function sendChoke(socket){
    socket.write(createMessage(0));
    console.log("Sent:Choke");
}

function sendUnchoke(socket){
    socket.write(createMessage(1));
    console.log("Sent:Unchoke");
}

function sendInterested(socket){
    socket.write(createMessage(2));
    console.log("Sent:Interested");
}

function sendUninterested(socket){
    socket.write(createMessage(0));
    console.log("Sent:Uninterested");
}

module.exports={
    sendChoke,
    sendUnchoke,
    sendInterested,
    sendUninterested
};
// Shared mutable state used by both server.js and peerWire.js.
// Avoids circular imports while letting both modules coordinate pause/resume.
module.exports = { isPaused: false };

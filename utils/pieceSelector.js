const crypto = require('crypto');

class PieceManager {
  constructor(torrent) {
    this.torrent = torrent;
    this.pieceLength = torrent.pieceLength;
    this.totalLength = torrent.length;

    if (!this.pieceLength || !this.totalLength) {
      throw new Error(`Invalid torrent metadata`);
    }

    this.totalPieces = Math.ceil(this.totalLength / this.pieceLength);
    this.blockSize = 16384; // 16 KB

    this.pieces = new Array(this.totalPieces).fill(null).map((_, index) => ({
      index,
      requestedBlocks: [],
      receivedBlocks: [],
      received: false,
      requested: false
    }));

    // Parse expected SHA1 hashes
    const pieceBuffer = torrent.pieces;
    this.expectedHashes = [];
    for (let i = 0; i < pieceBuffer.length; i += 20) {
      this.expectedHashes.push(pieceBuffer.slice(i, i + 20));
    }

    if (this.expectedHashes.length !== this.totalPieces) {
      throw new Error(`Mismatch: hashes=${this.expectedHashes.length}, pieces=${this.totalPieces}`);
    }
  }

  /**
   * Returns next block that is available in peer's bitfield.
   */
  nextBlockRequest(bitfield) {
    for (const piece of this.pieces) {
      if (piece.received || !bitfield?.[piece.index]) continue;

      const blocksNeeded = this.getMissingBlocks(piece.index);
      if (blocksNeeded.length === 0) continue;

      const block = blocksNeeded[0];
      piece.requestedBlocks.push(block.begin); // Mark block as requested
      return { index: piece.index, begin: block.begin, length: block.length };
    }

    return null;
  }

  /**
   * Determine which blocks of a piece are still needed.
   */
  getMissingBlocks(index) {
    const pieceLength = this.getPieceLength(index);
    const totalBlocks = Math.ceil(pieceLength / this.blockSize);
    const piece = this.pieces[index];
    const requested = piece.requestedBlocks;
    const received = piece.receivedBlocks.map(b => b.offset);

    const missing = [];
    for (let i = 0; i < totalBlocks; i++) {
      const begin = i * this.blockSize;
      const length = Math.min(this.blockSize, pieceLength - begin);
      if (!requested.includes(begin) && !received.includes(begin)) {
        missing.push({ begin, length });
      }
    }

    return missing;
  }

  /**
   * Save block data at given offset.
   */
  saveBlock(index, begin, data) {
    const piece = this.pieces[index];
    if (!piece) return;

    const already = piece.receivedBlocks.find(b => b.offset === begin);
    if (!already) {
      piece.receivedBlocks.push({ offset: begin, data });
    }
  }

  /**
   * Check if full piece is received.
   */
  isPieceComplete(index) {
    const pieceLength = this.getPieceLength(index);
    const piece = this.pieces[index];
    const totalReceived = piece.receivedBlocks.reduce((sum, b) => sum + b.data.length, 0);
    return totalReceived >= pieceLength;
  }

  /**
   * Combine all blocks into one piece buffer.
   */
  assemblePiece(index) {
    const piece = this.pieces[index];
    const sorted = piece.receivedBlocks.sort((a, b) => a.offset - b.offset);
    return Buffer.concat(sorted.map(b => b.data));
  }

  /**
   * Validate piece hash.
   */
  verifyPiece(index, buffer) {
    const expected = this.expectedHashes[index];
    const actual = crypto.createHash('sha1').update(buffer).digest();

    if (expected.equals(actual)) {
      this.pieces[index].received = true;
      return true;
    } else {
      this.resetPiece(index);
      return false;
    }
  }

  /**
   * Reset piece download progress (on failure).
   */
  resetPiece(index) {
    const piece = this.pieces[index];
    piece.requestedBlocks = [];
    piece.receivedBlocks = [];
    piece.received = false;
  }

  /**
   * Length of the piece (last one may be shorter)
   */
  getPieceLength(index) {
    if (index < this.totalPieces - 1) return this.pieceLength;
    return this.totalLength - index * this.pieceLength;
  }

  /**
   * Whether all pieces are downloaded.
   */
  isDone() {
    return this.pieces.every(p => p.received);
  }
}

module.exports = PieceManager;

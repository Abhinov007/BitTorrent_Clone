const crypto = require('crypto');

class PieceManager {
  constructor(torrent) {
    this.torrent = torrent;
    this.pieceLength = torrent.pieceLength;
    this.totalLength = torrent.length;
    this.blockSize = 16384; // 16KB block size

    if (!this.pieceLength || !this.totalLength) {
      throw new Error(`Invalid torrent metadata`);
    }

    this.totalPieces = Math.ceil(this.totalLength / this.pieceLength);

    this.pieces = Array.from({ length: this.totalPieces }, (_, index) => ({
      index,
      requestedBlocks: [],
      receivedBlocks: [],
      received: false
    }));

    // SHA1 hashes from torrent.pieces buffer
    const buffer = torrent.pieces;
    this.expectedHashes = [];
    for (let i = 0; i < buffer.length; i += 20) {
      this.expectedHashes.push(buffer.slice(i, i + 20));
    }

    if (this.expectedHashes.length !== this.totalPieces) {
      throw new Error(`Mismatch: ${this.expectedHashes.length} hashes for ${this.totalPieces} pieces`);
    }
  }

  /**
   * Chooses the next block to request from a peer based on its bitfield.
   */
nextBlockRequest(bitfield) {
  for (const piece of this.pieces) {
    if (piece.received || !bitfield?.[piece.index]) continue;

    const blocksNeeded = this.getMissingBlocks(piece.index);

    for (const block of blocksNeeded) {
      if (!piece.requestedBlocks.includes(block.begin)) {
        piece.requestedBlocks.push(block.begin); // Mark block
        return { index: piece.index, begin: block.begin, length: block.length };
      }
    }
  }
  return null;
}

  /**
   * Finds blocks that are not yet requested or received.
   */
  getMissingBlocks(index) {
    const piece = this.pieces[index];
    const pieceLen = this.getPieceLength(index);
    const totalBlocks = Math.ceil(pieceLen / this.blockSize);

    const requestedOffsets = piece.requestedBlocks.map(b => b.offset);
    const receivedOffsets = piece.receivedBlocks.map(b => b.offset);

    const missing = [];
    for (let i = 0; i < totalBlocks; i++) {
      const begin = i * this.blockSize;
      const length = Math.min(this.blockSize, pieceLen - begin);

      if (!requestedOffsets.includes(begin) && !receivedOffsets.includes(begin)) {
        missing.push({ begin, length });
      }
    }

    return missing;
  }

  /**
   * Saves a downloaded block.
   */
  saveBlock(index, begin, data) {
    const piece = this.pieces[index];
    if (!piece) return;

    const alreadyExists = piece.receivedBlocks.some(b => b.offset === begin);
    if (!alreadyExists) {
      piece.receivedBlocks.push({ offset: begin, data });
    }
  }

  /**
   * Checks if all blocks for a piece are received.
   */
  isPieceComplete(index) {
    const piece = this.pieces[index];
    const expectedLength = this.getPieceLength(index);
    const receivedLength = piece.receivedBlocks.reduce((acc, b) => acc + b.data.length, 0);
    return receivedLength >= expectedLength;
  }

  /**
   * Concatenates all received blocks for a piece in order.
   */
  assemblePiece(index) {
    const piece = this.pieces[index];
    const sorted = piece.receivedBlocks.sort((a, b) => a.offset - b.offset);
    return Buffer.concat(sorted.map(b => b.data));
  }

  /**
   * Verifies a piece's SHA1 hash.
   */
  verifyPiece(index, buffer) {
    const expected = this.expectedHashes[index];
    const actual = crypto.createHash('sha1').update(buffer).digest();

    const isValid = expected.equals(actual);
    if (isValid) {
      this.pieces[index].received = true;
      return true;
    } else {
      this.resetPiece(index);
      return false;
    }
  }

  /**
   * Resets a piece's requested and received blocks for retry.
   */
  resetPiece(index) {
    const piece = this.pieces[index];
    piece.requestedBlocks = [];
    piece.receivedBlocks = [];
    piece.received = false;
  }

  /**
   * Gets the actual byte size of a given piece index.
   */
  getPieceLength(index) {
    if (index < this.totalPieces - 1) return this.pieceLength;
    return this.totalLength - (index * this.pieceLength);
  }

  /**
   * Checks if all pieces have been received and verified.
   */
  isDone() {
    return this.pieces.every(p => p.received);
  }

   /**
   * Shows download status.
   */
  getDownloadedStats() {
  let downloaded = 0;

  this.pieces.forEach(piece => {
    downloaded += piece.receivedBlocks.reduce((sum, block) => sum + block.data.length, 0);
  });

  return {
    downloaded,
    total: this.totalLength,
    percent: ((downloaded / this.totalLength) * 100).toFixed(2)
  };
}

}

module.exports = PieceManager;

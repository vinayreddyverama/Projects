const { Chess } = require('chess.js');

class ChessGame {
  constructor(id) {
    this.id = id;
    this.type = 'chess';
    this.chess = new Chess();
    this.players = { w: null, b: null }; // w for white, b for black
    this.winner = null; // 'w', 'b', or 'draw'
    this.drawOffer = null; // Tracks which player ('w' or 'b') has offered a draw
    this.capturedPieces = { w: [], b: [] };
    this.materialAdvantage = 0;
  }

  addPlayer(socketId, name) {
    const initialScore = { wins: 0, losses: 0, draws: 0, total: 0 };

    if ((this.players.w && this.players.w.name.toLowerCase() === name.toLowerCase()) || 
        (this.players.b && this.players.b.name.toLowerCase() === name.toLowerCase())) {
      return null;
    }

    if (!this.players.w) {
      this.players.w = { id: socketId, name, score: { ...initialScore } };
      return 'w';
    } else if (!this.players.b) {
      this.players.b = { id: socketId, name, score: { ...initialScore } };
      return 'b';
    }
    return null;
  }

  reconnectPlayer(socketId, name) {
    if (this.players.w && this.players.w.name === name && this.players.w.disconnected) {
      this.players.w.id = socketId;
      this.players.w.disconnected = false;
      return 'w';
    }
    if (this.players.b && this.players.b.name === name && this.players.b.disconnected) {
      this.players.b.id = socketId;
      this.players.b.disconnected = false;
      return 'b';
    }
    return null;
  }

  makeMove(move, symbol) {
    if (this.winner || this.chess.turn() !== symbol) {
      return false;
    }

    try {
      const result = this.chess.move(move);
      if (result === null) return false; // Invalid move

      // Any valid move voids a previous draw offer.
      this.drawOffer = null;

      this._updateCapturedState();

      this.checkGameOver();
      return true;
    } catch (e) {
      return false; // chess.js throws an error for invalid moves
    }
  }

  checkGameOver() {
    if (this.chess.isGameOver()) {
      if (this.chess.isCheckmate()) {
        this.winner = this.chess.turn() === 'w' ? 'b' : 'w'; // The player whose turn it is has been checkmated
      } else {
        this.winner = 'draw'; // Stalemate, three-fold repetition, etc.
      }
      this.updateScores();
    }
  }

  updateScores() {
    if (this.winner === 'draw') {
      if (this.players.w) this.players.w.score.draws++;
      if (this.players.b) this.players.b.score.draws++;
    } else {
      const winnerSym = this.winner;
      const loserSym = winnerSym === 'w' ? 'b' : 'w';
      if (this.players[winnerSym]) this.players[winnerSym].score.wins++;
      if (this.players[loserSym]) this.players[loserSym].score.losses++;
    }

    if (this.players.w) this.players.w.score.total++;
    if (this.players.b) this.players.b.score.total++;
  }

  reset() {
    this.chess.reset();
    this.winner = null;
    this.drawOffer = null;
    this._updateCapturedState();
  }

  _updateCapturedState() {
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    const currentBoard = this.chess.board().flat().filter(p => p);

    const captured = { w: [], b: [] }; // w: pieces captured by white, b: pieces captured by black
    let advantage = 0;

    const initialCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts = { w: { ...initialCounts }, b: { ...initialCounts } };

    // Decrement counts for pieces still on the board
    for (const piece of currentBoard) {
      currentCounts[piece.color][piece.type]--;
    }

    // The remaining counts are the captured pieces
    for (const color of ['w', 'b']) {
      for (const type of ['p', 'n', 'b', 'r', 'q']) {
        const numCaptured = currentCounts[color][type];
        if (numCaptured > 0) {
          const pieceSymbol = color === 'w' ? type : type.toUpperCase();
          for (let i = 0; i < numCaptured; i++) {
            const capturer = color === 'w' ? 'b' : 'w';
            captured[capturer].push(pieceSymbol);
          }
        }
      }
    }

    // Calculate material advantage
    let whiteMaterial = 0;
    let blackMaterial = 0;
    currentBoard.forEach(p => {
      if (p.color === 'w') whiteMaterial += pieceValues[p.type];
      else blackMaterial += pieceValues[p.type];
    });
    advantage = whiteMaterial - blackMaterial;

    this.capturedPieces = captured;
    this.materialAdvantage = advantage;
  }

  getState() {
    return {
      fen: this.chess.fen(),
      history: this.chess.history({ verbose: true }),
      isGameOver: this.chess.isGameOver(),
      isCheckmate: this.chess.isCheckmate(),
      isDraw: this.chess.isDraw(),
      turn: this.chess.turn(),
      players: this.players,
      winner: this.winner,
      drawOffer: this.drawOffer,
      capturedPieces: this.capturedPieces,
      materialAdvantage: this.materialAdvantage,
      gameId: this.id,
      type: this.type,
    };
  }

  isReady() {
    return this.players.w && !this.players.w.disconnected && this.players.b && !this.players.b.disconnected;
  }
}

module.exports = ChessGame;
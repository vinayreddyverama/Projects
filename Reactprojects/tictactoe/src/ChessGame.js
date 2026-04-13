const { Chess } = require('chess.js');

class ChessGame {
  constructor(id) {
    this.id = id;
    this.type = 'chess';
    this.chess = new Chess();
    this.players = { w: null, b: null };
    this.winner = null;
    this.drawOffer = null;
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
      this.players.w = { id: socketId, name, score: { ...initialScore }, disconnected: false };
      return 'w';
    } else if (!this.players.b) {
      this.players.b = { id: socketId, name, score: { ...initialScore }, disconnected: false };
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

  makeMove(moveObj, symbol) {
    if (this.winner) return false;
    if (this.chess.turn() !== symbol) return false;

    try {
      const move = this.chess.move(moveObj);
      if (!move) return false;
    } catch (e) {
      return false; // Invalid move
    }

    this.checkWinner(symbol);
    this.calculateStats();

    if (this.winner) {
      this.updateScores();
    }

    this.drawOffer = null;

    return true;
  }

  calculateStats() {
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const initialCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    let wScore = 0;
    let bScore = 0;

    const board = this.chess.board();
    for (let row of board) {
      for (let square of row) {
        if (square && currentCounts[square.color] && currentCounts[square.color][square.type] !== undefined) {
          currentCounts[square.color][square.type]++;
          if (square.color === 'w') wScore += values[square.type];
          else bScore += values[square.type];
        }
      }
    }

    this.materialAdvantage = wScore - bScore;

    this.capturedPieces = { w: [], b: [] };
    for (const type of Object.keys(initialCounts)) {
      const missingBlack = Math.max(0, initialCounts[type] - currentCounts.b[type]);
      for (let i = 0; i < missingBlack; i++) this.capturedPieces.w.push(type);

      const missingWhite = Math.max(0, initialCounts[type] - currentCounts.w[type]);
      for (let i = 0; i < missingWhite; i++) this.capturedPieces.b.push(type);
    }
  }

  checkWinner(lastMoveSymbol) {
    if (this.chess.isCheckmate()) {
      this.winner = lastMoveSymbol;
    } else if (this.chess.isDraw() || this.chess.isStalemate() || this.chess.isThreefoldRepetition() || this.chess.isInsufficientMaterial()) {
      this.winner = 'draw';
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
    this.calculateStats();
  }

  getState() {
    return {
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      players: this.players,
      winner: this.winner,
      gameId: this.id,
      type: this.type,
      history: this.chess.history({ verbose: true }),
      capturedPieces: this.capturedPieces,
      materialAdvantage: this.materialAdvantage,
      drawOffer: this.drawOffer
    };
  }

  isReady() {
    return !!(this.players.w && !this.players.w.disconnected && this.players.b && !this.players.b.disconnected);
  }
}

module.exports = ChessGame;

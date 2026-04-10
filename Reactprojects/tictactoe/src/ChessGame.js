const { Chess } = require('chess.js');

class ChessGame {
  constructor(id) {
    this.id = id;
    this.type = 'chess';
    this.chess = new Chess();
    this.players = { w: null, b: null }; // w for white, b for black
    this.winner = null; // 'w', 'b', or 'draw'
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
      gameId: this.id,
      type: this.type,
    };
  }

  isReady() {
    return this.players.w && !this.players.w.disconnected && this.players.b && !this.players.b.disconnected;
  }
}

module.exports = ChessGame;
class Game {
  constructor(id) {
    this.id = id;
    this.type = 'tictactoe';
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.players = { X: null, O: null };
    this.winner = null;
  }

  addPlayer(socketId, name) {
    const initialScore = { wins: 0, losses: 0, draws: 0, total: 0 };

    if ((this.players.X && this.players.X.name.toLowerCase() === name.toLowerCase()) || 
        (this.players.O && this.players.O.name.toLowerCase() === name.toLowerCase())) {
      return null; // Name already taken in this game
    }

    if (!this.players.X) {
      this.players.X = { id: socketId, name, score: { ...initialScore } };
      return 'X';
    } else if (!this.players.O) {
      this.players.O = { id: socketId, name, score: { ...initialScore } };
      return 'O';
    }
    return null;
  }

  reconnectPlayer(socketId, name) {
    if (this.players.X && this.players.X.name === name && this.players.X.disconnected) {
      this.players.X.id = socketId;
      this.players.X.disconnected = false;
      return 'X';
    }
    if (this.players.O && this.players.O.name === name && this.players.O.disconnected) {
      this.players.O.id = socketId;
      this.players.O.disconnected = false;
      return 'O';
    }
    return null;
  }

  makeMove(index, symbol) {
    if (this.board[index] !== null || this.winner) return false;
    if (this.currentPlayer !== symbol) return false;

    this.board[index] = symbol;
    this.checkWinner();
    
    if (!this.winner) {
      this.currentPlayer = symbol === 'X' ? 'O' : 'X';
      if (this.board.every(cell => cell !== null)) {
        this.winner = 'draw';
      }
    }
    
    if (this.winner) {
      this.updateScores();
    }

    return true;
  }

  updateScores() {
    if (this.winner === 'draw') {
      if (this.players.X) this.players.X.score.draws++;
      if (this.players.O) this.players.O.score.draws++;
    } else {
      const winnerSym = this.winner;
      const loserSym = winnerSym === 'X' ? 'O' : 'X';
      if (this.players[winnerSym]) this.players[winnerSym].score.wins++;
      if (this.players[loserSym]) this.players[loserSym].score.losses++;
    }

    if (this.players.X) this.players.X.score.total++;
    if (this.players.O) this.players.O.score.total++;
  }

  checkWinner() {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    for (let [a, b, c] of lines) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        this.winner = this.board[a];
        return true;
      }
    }
    return false;
  }

  reset() {
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.winner = null;
  }

  getState() {
    return {
      board: this.board,
      currentPlayer: this.currentPlayer,
      players: this.players,
      winner: this.winner,
      gameId: this.id,
      type: this.type
    };
  }

  isReady() {
    return this.players.X && !this.players.X.disconnected && this.players.O && !this.players.O.disconnected;
  }
}

module.exports = Game;
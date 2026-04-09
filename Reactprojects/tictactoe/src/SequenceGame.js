class SequenceGame {
  constructor(id) {
    this.id = id;
    this.type = 'sequence';
    this.ROWS = 10;
    this.COLS = 10;
    this.board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    this.currentPlayer = 'P1';
    this.players = { P1: null, P2: null };
    this.winner = null;
  }

  addPlayer(socketId, name) {
    const initialScore = { wins: 0, losses: 0, draws: 0, total: 0 };

    if ((this.players.P1 && this.players.P1.name === name) || 
        (this.players.P2 && this.players.P2.name === name)) {
      return null;
    }

    if (!this.players.P1) {
      this.players.P1 = { id: socketId, name, score: { ...initialScore } };
      return 'P1';
    } else if (!this.players.P2) {
      this.players.P2 = { id: socketId, name, score: { ...initialScore } };
      return 'P2';
    }
    return null;
  }

  reconnectPlayer(socketId, name) {
    if (this.players.P1 && this.players.P1.name === name && this.players.P1.disconnected) {
      this.players.P1.id = socketId;
      this.players.P1.disconnected = false;
      return 'P1';
    }
    if (this.players.P2 && this.players.P2.name === name && this.players.P2.disconnected) {
      this.players.P2.id = socketId;
      this.players.P2.disconnected = false;
      return 'P2';
    }
    return null;
  }

  makeMove(index, symbol) {
    if (this.winner) return false;
    if (this.currentPlayer !== symbol) return false;

    const { r, c } = index;
    if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return false;
    if (this.board[r][c] !== null) return false;

    this.board[r][c] = symbol;
    this.checkWinner(r, c, symbol);

    if (!this.winner) {
      this.currentPlayer = symbol === 'P1' ? 'P2' : 'P1';
      if (this.board.every(row => row.every(cell => cell !== null))) {
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
      if (this.players.P1) this.players.P1.score.draws++;
      if (this.players.P2) this.players.P2.score.draws++;
    } else {
      const winnerSym = this.winner;
      const loserSym = winnerSym === 'P1' ? 'P2' : 'P1';
      if (this.players[winnerSym]) this.players[winnerSym].score.wins++;
      if (this.players[loserSym]) this.players[loserSym].score.losses++;
    }

    if (this.players.P1) this.players.P1.score.total++;
    if (this.players.P2) this.players.P2.score.total++;
  }

  checkWinner(row, col, player) {
    const directions = [
      [[0, 1], [0, -1]],   // Horizontal
      [[1, 0], [-1, 0]],   // Vertical
      [[1, 1], [-1, -1]],  // Diagonal \
      [[1, -1], [-1, 1]]   // Diagonal /
    ];

    for (let dir of directions) {
      let count = 1;
      for (let d of dir) {
        let r = row + d[0];
        let c = col + d[1];
        while (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && this.board[r][c] === player) {
          count++;
          r += d[0];
          c += d[1];
        }
      }
      if (count >= 5) {
        this.winner = player;
        return true;
      }
    }
    return false;
  }

  reset() {
    this.board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    this.currentPlayer = 'P1';
    this.winner = null;
  }

  getState() {
    return { board: this.board, currentPlayer: this.currentPlayer, players: this.players, winner: this.winner, gameId: this.id, type: this.type };
  }

  isReady() { 
    return this.players.P1 && !this.players.P1.disconnected && this.players.P2 && !this.players.P2.disconnected; 
  }
}

module.exports = SequenceGame;
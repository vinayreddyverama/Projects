class Connect4Game {
  constructor(id) {
    this.id = id;
    this.type = 'connect4';
    this.ROWS = 6;
    this.COLS = 7;
    this.board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    this.currentPlayer = 'Red';
    this.players = { Red: null, Yellow: null };
    this.winner = null;
  }

  addPlayer(socketId, name) {
    const initialScore = { wins: 0, losses: 0, draws: 0, total: 0 };
    
    if ((this.players.Red && this.players.Red.name === name) || 
        (this.players.Yellow && this.players.Yellow.name === name)) {
      return null;
    }

    if (!this.players.Red) {
      this.players.Red = { id: socketId, name, score: { ...initialScore } };
      return 'Red';
    } else if (!this.players.Yellow) {
      this.players.Yellow = { id: socketId, name, score: { ...initialScore } };
      return 'Yellow';
    }
    return null;
  }

  reconnectPlayer(socketId, name) {
    if (this.players.Red && this.players.Red.name === name && this.players.Red.disconnected) {
      this.players.Red.id = socketId;
      this.players.Red.disconnected = false;
      return 'Red';
    }
    if (this.players.Yellow && this.players.Yellow.name === name && this.players.Yellow.disconnected) {
      this.players.Yellow.id = socketId;
      this.players.Yellow.disconnected = false;
      return 'Yellow';
    }
    return null;
  }

  makeMove(colIndex, symbol) {
    if (this.winner) return false;
    if (this.currentPlayer !== symbol) return false;

    let placedRow = -1;
    // Find the lowest empty slot in the selected column
    for (let r = this.ROWS - 1; r >= 0; r--) {
      if (!this.board[r][colIndex]) {
        this.board[r][colIndex] = symbol;
        placedRow = r;
        break;
      }
    }

    if (placedRow === -1) return false; // Column is full

    this.checkWinner(placedRow, colIndex, symbol);

    if (!this.winner) {
      this.currentPlayer = symbol === 'Red' ? 'Yellow' : 'Red';
      // Check for draw (if all cells are filled)
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
      if (this.players.Red) this.players.Red.score.draws++;
      if (this.players.Yellow) this.players.Yellow.score.draws++;
    } else {
      const winnerSym = this.winner;
      const loserSym = winnerSym === 'Red' ? 'Yellow' : 'Red';
      if (this.players[winnerSym]) this.players[winnerSym].score.wins++;
      if (this.players[loserSym]) this.players[loserSym].score.losses++;
    }

    if (this.players.Red) this.players.Red.score.total++;
    if (this.players.Yellow) this.players.Yellow.score.total++;
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
      if (count >= 4) {
        this.winner = player;
        return true;
      }
    }
    return false;
  }

  reset() {
    this.board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
    this.currentPlayer = 'Red';
    this.winner = null;
  }

  getState() {
    return { board: this.board, currentPlayer: this.currentPlayer, players: this.players, winner: this.winner, gameId: this.id, type: this.type };
  }

  isReady() { 
    return this.players.Red && !this.players.Red.disconnected && this.players.Yellow && !this.players.Yellow.disconnected; 
  }
}

module.exports = Connect4Game;
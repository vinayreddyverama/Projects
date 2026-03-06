const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const logger = require('./src/logger');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, 'build')));
app.use(express.json());

// ==================== GAME CLASS ====================
class Game {
  constructor(id) {
    this.id = id;
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.players = { X: null, O: null };
    this.winner = null;
  }

  addPlayer(socketId, name) {
    if (!this.players.X) {
      this.players.X = { id: socketId, name };
      return 'X';
    } else if (!this.players.O) {
      this.players.O = { id: socketId, name };
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

    return true;
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
      gameId: this.id
    };
  }

  isReady() {
    return this.players.X && this.players.O;
  }
}

// ==================== GAME MANAGER ====================
const games = new Map();
const playerToGame = new Map();
let gameCounter = 0;

function findOrCreateGame(socketId, playerName) {
  // Look for a game with one player
  for (let [gameId, game] of games) {
    if (game.players.X && !game.players.O) {
      const symbol = game.addPlayer(socketId, playerName);
      playerToGame.set(socketId, gameId);
      logger.playerJoin(playerName, symbol, gameId);
      return { game, symbol };
    }
  }

  // Create new game
  const gameId = ++gameCounter;
  const game = new Game(gameId);
  const symbol = game.addPlayer(socketId, playerName);
  games.set(gameId, game);
  playerToGame.set(socketId, gameId);
  logger.playerJoin(playerName, symbol, gameId);
  return { game, symbol };
}

// ==================== SOCKET EVENTS ====================
io.on('connection', (socket) => {
  logger.connection(socket.id);

  socket.on('playerJoin', (playerName) => {
    logger.info(`Player join request: ${playerName} (${socket.id})`);

    const { game, symbol } = findOrCreateGame(socket.id, playerName);
    socket.join(`game-${game.id}`);

    socket.emit('playerAssigned', { symbol, game: game.getState() });

    io.to(`game-${game.id}`).emit('gameUpdate', game.getState());

    if (game.isReady()) {
      logger.gameStart(game.id, game.players);
      io.to(`game-${game.id}`).emit('gameStart', game.getState());
    }
  });

  socket.on('playerMove', (data) => {
    const gameId = playerToGame.get(socket.id);
    if (!gameId) return;

    const game = games.get(gameId);
    if (!game) return;

    const { index } = data;
    const player = game.players.X?.id === socket.id ? 'X' : 'O';

    if (game.makeMove(index, player)) {
      logger.playerMove(gameId, player, index);
      io.to(`game-${gameId}`).emit('gameUpdate', game.getState());

      if (game.winner) {
        logger.gameEnd(gameId, game.winner);
        io.to(`game-${gameId}`).emit('gameEnd', game.getState());
      }
    }
  });

  socket.on('gameReset', () => {
    const gameId = playerToGame.get(socket.id);
    if (!gameId) return;

    const game = games.get(gameId);
    if (!game) return;

    game.reset();
    logger.info(`Game ${gameId} reset`);
    io.to(`game-${gameId}`).emit('gameUpdate', game.getState());
  });

  socket.on('disconnect', () => {
    const gameId = playerToGame.get(socket.id);
    if (gameId) {
      const game = games.get(gameId);
      if (game) {
        const playerSymbol = game.players.X?.id === socket.id ? 'X' : 'O';
        logger.playerDisconnect(playerSymbol, gameId);

        io.to(`game-${gameId}`).emit('opponentLeft');
        games.delete(gameId);
      }
    }
    logger.disconnection(socket.id);
    playerToGame.delete(socket.id);
  });
});

// ==================== HTTP ====================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  logger.success(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} already in use`);
    process.exit(1);
  }
});

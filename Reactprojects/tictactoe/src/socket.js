const logger = require('./logger');
const Game = require('./Game');

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

module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.connection(socket.id);

    socket.on('playerJoin', (playerName) => {
      logger.info(`Player join request: ${playerName} (${socket.id})`);

      // Prevent player from joining if they are already in a game
      if (playerToGame.has(socket.id)) {
        return;
      }

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
      
      // Validate that the socket is actually one of the players
      let player = null;
      if (game.players.X?.id === socket.id) player = 'X';
      else if (game.players.O?.id === socket.id) player = 'O';

      if (!player) return; // Socket is not a player in this game

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
};
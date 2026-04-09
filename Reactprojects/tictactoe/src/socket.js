const logger = require('./logger');
const Game = require('./Game');
const Connect4Game = require('./Connect4Game');
const SequenceGame = require('./SequenceGame');

const games = new Map();
const playerToGame = new Map();
let gameCounter = 0;

function findOrCreateGame(socketId, playerName, gameType, requestedGameId) {
  // 1. Try to reconnect by requestedGameId
  if (requestedGameId) {
    const game = games.get(requestedGameId);
    if (game && game.type === gameType) {
      const symbol = game.reconnectPlayer(socketId, playerName);
      if (symbol) {
        playerToGame.set(socketId, game.id);
        logger.playerJoin(playerName, symbol, game.id);
        return { game, symbol };
      }
      if (!game.isReady()) {
        const existingNames = Object.values(game.players).filter(p => p).map(p => p.name);
        if (!existingNames.includes(playerName)) {
          const sym = game.addPlayer(socketId, playerName);
          if (sym) {
            playerToGame.set(socketId, game.id);
            logger.playerJoin(playerName, sym, game.id);
            return { game, symbol: sym };
          }
        }
      }
    }
  }

  // 2. Reconnect by name across games of the same type
  for (let [gameId, game] of games) {
    if (game.type === gameType) {
      const symbol = game.reconnectPlayer(socketId, playerName);
      if (symbol) {
        playerToGame.set(socketId, game.id);
        logger.playerJoin(playerName, symbol, game.id);
        return { game, symbol };
      }
    }
  }

  // 3. Find waiting game
  for (let [gameId, game] of games) {
    if (game.type === gameType && !game.isReady()) {
      const existingNames = Object.values(game.players).filter(p => p).map(p => p.name);
      if (existingNames.includes(playerName)) continue;

      const symbol = game.addPlayer(socketId, playerName);
      if (symbol) {
        playerToGame.set(socketId, gameId);
        logger.playerJoin(playerName, symbol, gameId);
        return { game, symbol };
      }
    }
  }

  // Create new game
  const gameId = ++gameCounter;
  const game = gameType === 'connect4' ? new Connect4Game(gameId) : 
               gameType === 'sequence' ? new SequenceGame(gameId) : 
               new Game(gameId);
  const symbol = game.addPlayer(socketId, playerName);
  games.set(gameId, game);
  playerToGame.set(socketId, gameId);
  logger.playerJoin(playerName, symbol, gameId);
  return { game, symbol };
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.connection(socket.id);

    socket.on('playerJoin', (data) => {
      let playerName, gameType, requestedGameId;
      if (typeof data === 'object') {
        playerName = data.playerName;
        gameType = data.gameType;
        requestedGameId = data.requestedGameId;
      } else { // Fallback for backward compatibility
        playerName = data;
        gameType = 'tictactoe';
      }
      
      if (!playerName || !playerName.trim()) return;
      playerName = playerName.trim();

      // Check if name is taken globally by another actively connected player
      let nameInUse = false;
      for (let [gId, g] of games) {
        for (let p of Object.values(g.players)) {
          if (p && p.name.toLowerCase() === playerName.toLowerCase() && !p.disconnected && p.id !== socket.id) {
            nameInUse = true;
            break;
          }
        }
        if (nameInUse) break;
      }

      if (nameInUse) {
        socket.emit('nameError', 'This name is already taken by another active player. Please choose a different name.');
        return;
      }

      logger.info(`Player join request: ${playerName} for ${gameType} (${socket.id})`);

      // Prevent player from joining if they are already in a game
      if (playerToGame.has(socket.id)) {
        return;
      }

      const { game, symbol } = findOrCreateGame(socket.id, playerName, gameType, requestedGameId);
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

      const playerSymbols = Object.keys(game.players);
      const playerSymbol = playerSymbols.find(sym => game.players[sym]?.id === socket.id);

      if (!playerSymbol) return; // Socket is not a player in this game

      if (game.makeMove(index, playerSymbol)) {
        logger.playerMove(gameId, playerSymbol, index);
        io.to(`game-${gameId}`).emit('gameUpdate', game.getState());

        if (game.winner) {
          logger.gameEnd(gameId, game.winner);
          io.to(`game-${gameId}`).emit('gameEnd', game.getState());
        }
      }
    });

    socket.on('sendMessage', (message) => {
      const gameId = playerToGame.get(socket.id);
      if (!gameId) return;

      const game = games.get(gameId);
      if (!game) return;

      const playerSymbols = Object.keys(game.players);
      const playerSymbol = playerSymbols.find(sym => game.players[sym]?.id === socket.id);

      if (playerSymbol) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.to(`game-${gameId}`).emit('receiveMessage', { sender: playerSymbol, message, timestamp });
      }
    });

    socket.on('typing', () => {
      const gameId = playerToGame.get(socket.id);
      if (gameId) socket.to(`game-${gameId}`).emit('opponentTyping');
    });

    socket.on('stopTyping', () => {
      const gameId = playerToGame.get(socket.id);
      if (gameId) socket.to(`game-${gameId}`).emit('opponentStoppedTyping');
    });

    socket.on('endSession', () => {
      socket.isSwitching = true;
      const gameId = playerToGame.get(socket.id);
      if (gameId) {
        io.to(`game-${gameId}`).emit('sessionEnded');
        games.delete(gameId);
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
          const playerSymbols = Object.keys(game.players);
          const playerSymbol = playerSymbols.find(sym => game.players[sym]?.id === socket.id);
          
          if (playerSymbol) {
            game.players[playerSymbol].disconnected = true;
            logger.playerDisconnect(playerSymbol, gameId);

            io.to(`game-${gameId}`).emit('opponentDisconnected');
            
            setTimeout(() => {
              const currentGame = games.get(gameId);
              if (currentGame && currentGame.players[playerSymbol]?.disconnected) {
                const allDisconnected = Object.values(currentGame.players).every(p => !p || p.disconnected);
                if (allDisconnected) {
                  games.delete(gameId);
                } else {
                  io.to(`game-${gameId}`).emit('opponentLeft');
                }
              }
            }, 30000);
          }
        }
      }
      logger.disconnection(socket.id);
      playerToGame.delete(socket.id);
    });
  });
};
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import logger from './logger';

function App() {
  const [socket, setSocket] = useState(null);
  const [phase, setPhase] = useState('nameInput'); // nameInput, playing, finished
  const [playerName, setPlayerName] = useState('');
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [status, setStatus] = useState('');
  const [opponentName, setOpponentName] = useState('');

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:5001', {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      logger.connection(newSocket.id);
    });

    newSocket.on('playerAssigned', (data) => {
      logger.playerJoin(data.symbol, data.symbol, data.game.gameId);
      setPlayerSymbol(data.symbol);
      setGameId(data.game.gameId);
      setGameState(data.game);
      setPhase('waiting');
      setStatus('Waiting for opponent...');
    });

    newSocket.on('gameUpdate', (state) => {
      logger.info('Game state updated');
      setGameState(state);
      // Determine player symbol from socket ID
      const mySymbol = state.players.X.id === newSocket.id ? 'X' : 'O';
      const oppSymbol = mySymbol === 'X' ? 'O' : 'X';
      const oppName = state.players[oppSymbol].name;
      updateStatus(state, mySymbol, oppName);
    });

    newSocket.on('gameStart', (state) => {
      logger.gameStart(state.gameId, state.players);
      // Determine this player's symbol by matching socket ID
      let mySymbol = null;
      let oppName = '';
      if (state.players.X.id === newSocket.id) {
        mySymbol = 'X';
        oppName = state.players.O.name;
      } else {
        mySymbol = 'O';
        oppName = state.players.X.name;
      }
      setPlayerSymbol(mySymbol);
      setOpponentName(oppName);
      setPhase('playing');
      setGameState(state);
      updateStatus(state, mySymbol, oppName);
    });

    newSocket.on('gameEnd', (state) => {
      logger.gameEnd(state.winner, state.winner === 'draw' ? 'draw' : 'win');
      setPhase('finished');
      setGameState(state);
    });

    newSocket.on('opponentLeft', () => {
      logger.opponentLeft();
      setPhase('ended');
      setStatus('Opponent disconnected!');
    });

    newSocket.on('disconnect', () => {
      logger.disconnect();
      setStatus('Disconnected from server');
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  const updateStatus = (state, currentPlayerSymbol, oppName = '') => {
    if (state.winner) {
      if (state.winner === 'draw') {
        setStatus("It's a Draw!");
      } else {
        setStatus(state.winner === currentPlayerSymbol ? 'You won! 🎉' : 'You lost!');
      }
    } else {
      const opponentSymbol = currentPlayerSymbol === 'X' ? 'O' : 'X';
      setStatus(state.currentPlayer === currentPlayerSymbol ? 'Your turn' : `${oppName}'s turn (${opponentSymbol})`);
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (playerName.trim() && socket) {
      logger.playerJoin(playerName);
      socket.emit('playerJoin', playerName);
    }
  };

  const handleMove = (index) => {
    if (
      !gameState ||
      gameState.board[index] !== null ||
      gameState.currentPlayer !== playerSymbol ||
      gameState.winner
    ) {
      return;
    }

    socket.emit('playerMove', { index });
  };

  const handlePlayAgain = () => {
    socket.emit('gameReset');
    setPhase('playing');
  };

  // ==================== RENDER PHASES ====================

  if (phase === 'nameInput') {
    return (
      <div className="container">
        <div className="welcome-screen">
          <h1>🎮 Tic Tac Toe</h1>
          <p className="subtitle">Enter your name to join a game</p>
          <form onSubmit={handleNameSubmit}>
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength="20"
              disabled={!socket}
              autoFocus
            />
            <button type="submit" disabled={!playerName.trim() || !socket}>
              {socket ? 'Start Game' : 'Connecting...'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div className="container">
        <div className="game-screen">
          <h1>⏳ Waiting</h1>
          <p className="loading-text">Player: <strong>{playerName}</strong> ({playerSymbol})</p>
          <p className="loading-text">Waiting for opponent to join...</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  return (
    <div className="container">
      <div className="game-screen">
        <h1>Tic Tac Toe</h1>

        <div className="game-info">
          <div className="player-info">
            <div className="player-card">
              <p className="player-name">You</p>
              <p className="player-label">{playerName}</p>
              <p className="player-symbol">{playerSymbol}</p>
              <p className="player-turn">
                {gameState.currentPlayer === playerSymbol ? '🔴' : '⚫'}
              </p>
            </div>

            <div className="player-card opponent">
              <p className="player-name">Opponent</p>
              <p className="player-label">{opponentName}</p>
              <p className="player-symbol">{playerSymbol === 'X' ? 'O' : 'X'}</p>
              <p className="player-turn">
                {gameState.currentPlayer !== playerSymbol ? '🔴' : '⚫'}
              </p>
            </div>
          </div>

          <div className="game-status">
            <p className="status-text">{status}</p>
            <p className="room-info">Game #{gameId}</p>
          </div>
        </div>

        <div className="board">
          {gameState.board.map((cell, i) => (
            <div
              key={i}
              className={`cell ${cell ? `cell-${cell}` : ''} ${
                !cell && gameState.currentPlayer === playerSymbol && !gameState.winner
                  ? 'clickable'
                  : ''
              }`}
              onClick={() => handleMove(i)}
            >
              {cell}
            </div>
          ))}
        </div>

        {gameState.winner && (
          <div className="reset-section">
            <button onClick={handlePlayAgain} className="reset-btn">
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

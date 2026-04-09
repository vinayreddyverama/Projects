import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import logger from './logger';
import './TicTacToe.css';

const QUICK_EMOJIS = ['😂', '😎', '😢', '😡', '👍', '🎉'];

const TicTacToe = ({ onScoreUpdate, globalPlayerName, setGlobalPlayerName, onPlayMusic, onOpponentLeft, activeSocketRef }) => {
  const [socket, setSocket] = useState(null);
  const [phase, setPhase] = useState('nameInput'); // nameInput, playing, finished
  const [playerName, setPlayerName] = useState(globalPlayerName || '');
  const [joinGameId, setJoinGameId] = useState('');
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [status, setStatus] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const chatEndRef = useRef(null);
  const hasAutoJoined = useRef(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(null);

  const getEmoji = (sym) => sym;

  const playSendSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/3005/3005-preview.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  const playReceiveSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.sender !== playerSymbol) playReceiveSound();
    }
  }, [chatMessages, isOpponentTyping, playerSymbol]);

  useEffect(() => {
    if (disconnectCountdown === null) return;
    if (disconnectCountdown > 0) {
      setStatus(`⏳ Opponent disconnected... (Waiting ${disconnectCountdown}s)`);
      const timer = setTimeout(() => {
        setDisconnectCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setStatus('⏳ Opponent disconnected... (0s)');
    }
  }, [disconnectCountdown]);

  // Initialize socket connection
  useEffect(() => {
    let isMounted = true;

    const updateStatus = (state, currentPlayerSymbol, oppName = '') => {
      if (!isMounted) return;
      if (state.winner) {
        if (state.winner === 'draw') {
          setStatus("It's a Draw!");
        } else {
          const winnerName = state.players[state.winner]?.name || state.winner;
          setStatus(state.winner === currentPlayerSymbol ? `You won! 🎉 ${getEmoji(currentPlayerSymbol)} (${winnerName})` : `Winner: ${winnerName} ${getEmoji(state.winner)}`);
        }
      } else {
        const opponentSymbol = currentPlayerSymbol === 'X' ? 'O' : 'X';
        setStatus(state.currentPlayer === currentPlayerSymbol ? 'Your turn' : `${oppName}'s turn (${getEmoji(opponentSymbol)})`);
      }
    };

    const checkScoreUpdate = (state, currentSocketId) => {
      if (!state || !state.players) return;
      const mySymbol = state.players.X?.id === currentSocketId ? 'X' : (state.players.O?.id === currentSocketId ? 'O' : null);
      if (mySymbol && state.players[mySymbol]?.score) {
        const { wins, losses, draws } = state.players[mySymbol].score;
        if (onScoreUpdate) onScoreUpdate(wins, losses, draws);
      }
    };

    const newSocket = io('/', {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      if (!isMounted) return;
      logger.connection(newSocket.id);
    });

    newSocket.on('nameError', (message) => {
      if (!isMounted) return;
      alert(message);
      setPhase('nameInput');
      setPlayerName('');
      if (setGlobalPlayerName) setGlobalPlayerName('');
      hasAutoJoined.current = false;
    });

    newSocket.on('playerAssigned', (data) => {
      if (!isMounted) return;
      logger.playerJoin(data.symbol, data.symbol, data.game.gameId);
      setPlayerSymbol(data.symbol);
      setGameId(data.game.gameId);
      setGameState(data.game);
      setPhase('waiting');
      setStatus('Waiting for another player to join...');
    });

    newSocket.on('receiveMessage', (data) => {
      if (!isMounted) return;
      setChatMessages((prev) => [...prev.slice(-9), data]); // Keeps the last 10 messages
      setIsOpponentTyping(false); // Hide indicator when message is finally received
    });

    newSocket.on('opponentTyping', () => {
      if (isMounted) setIsOpponentTyping(true);
    });

    newSocket.on('opponentStoppedTyping', () => {
      if (isMounted) setIsOpponentTyping(false);
    });

    newSocket.on('opponentSwitched', (targetGame) => {
      if (!isMounted) return;
      setDisconnectCountdown(null);
      if (onOpponentLeft) onOpponentLeft('switch', targetGame);
    });

    newSocket.on('sessionEnded', () => {
      if (!isMounted) return;
      setDisconnectCountdown(null);
      if (onOpponentLeft) onOpponentLeft('end');
    });

    newSocket.on('opponentDisconnected', () => {
      if (!isMounted) return;
      setDisconnectCountdown(30);
    });

    newSocket.on('gameUpdate', (state) => {
      if (!isMounted) return;
      setDisconnectCountdown(null);
      logger.info('Game state updated');
      setGameState(state);
      const mySymbol = state.players.X?.id === newSocket.id ? 'X' : 'O';
      const oppSymbol = mySymbol === 'X' ? 'O' : 'X';
      const oppName = state.players[oppSymbol]?.name;
      updateStatus(state, mySymbol, oppName);
      checkScoreUpdate(state, newSocket.id);
    });

    newSocket.on('gameStart', (state) => {
      if (!isMounted) return;
      logger.gameStart(state.gameId, state.players);
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
      checkScoreUpdate(state, newSocket.id);
    });

    newSocket.on('gameEnd', (state) => {
      if (!isMounted) return;
      logger.gameEnd(state.winner, state.winner === 'draw' ? 'draw' : 'win');
      setPhase('finished');
      setGameState(state);
      
      const mySymbol = state.players.X?.id === newSocket.id ? 'X' : 'O';
      const oppSymbol = mySymbol === 'X' ? 'O' : 'X';
      const oppName = state.players[oppSymbol]?.name;
      updateStatus(state, mySymbol, oppName);
      checkScoreUpdate(state, newSocket.id);
    });

    newSocket.on('opponentLeft', () => {
      if (!isMounted) return;
      setDisconnectCountdown(null);
      logger.info('Opponent disconnected!');
      setPhase('ended');
      setStatus('Opponent disconnected!');
      if (onOpponentLeft) onOpponentLeft('disconnect');
    });

    newSocket.on('disconnect', () => {
      if (!isMounted) return;
      logger.disconnection(newSocket.id);
      setStatus('Disconnected from server');
    });

    setSocket(newSocket);
    if (activeSocketRef) activeSocketRef.current = newSocket;
    return () => {
      isMounted = false;
      newSocket.disconnect();
    };
  }, [onScoreUpdate]);

  useEffect(() => {
    if (socket && globalPlayerName && phase === 'nameInput' && !hasAutoJoined.current) {
      hasAutoJoined.current = true;
      if (onPlayMusic) onPlayMusic();
      logger.playerJoin(globalPlayerName);
      socket.emit('playerJoin', { playerName: globalPlayerName, gameType: 'tictactoe', requestedGameId: null });
    }
  }, [socket, globalPlayerName, phase, onPlayMusic]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (playerName.trim() && socket) {
      if (setGlobalPlayerName) setGlobalPlayerName(playerName.trim());
      if (onPlayMusic) onPlayMusic();
      logger.playerJoin(playerName.trim());
      socket.emit('playerJoin', { playerName: playerName.trim(), gameType: 'tictactoe', requestedGameId: parseInt(joinGameId) || null });
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

  const sendMessage = (message) => {
    if (socket && message.trim()) {
      playSendSound();
      socket.emit('sendMessage', message);
    }
  };

  const handleChatChange = (e) => {
    setCurrentMessage(e.target.value);
    if (socket) {
      if (e.target.value.trim() === '') {
        socket.emit('stopTyping');
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      } else {
        socket.emit('typing');
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit('stopTyping');
        }, 2000);
      }
    }
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    sendMessage(currentMessage);
    setCurrentMessage('');
    if (socket) {
      socket.emit('stopTyping');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handlePlayAgain = () => {
    socket.emit('gameReset');
    setPhase('playing');
  };

  if (phase === 'nameInput') {
    if (globalPlayerName) {
      return (
        <div className="container">
          <div className="welcome-screen">
            <h1>🎮 Tic Tac Toe</h1>
            <p className="loading-text">Rejoining as <strong>{globalPlayerName}</strong>...</p>
            <div className="spinner"></div>
          </div>
        </div>
      );
    }

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
            <input
              type="number"
              placeholder="Game ID to Rejoin (optional)"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              disabled={!socket}
              style={{ marginTop: '5px' }}
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
          <p className="loading-text">Player: <strong>{playerName}</strong> ({getEmoji(playerSymbol)})</p>
          <p className="loading-text">Waiting for another player to join...</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  return (
    <div className="container">
      <div className="game-layout">
        <div className="game-screen">
          <h1>Tic Tac Toe</h1>

          <div className="game-info">
            <div className="player-info">
            <div className="player-card">
              <p className="player-name">You</p>
              <p className="player-label">{playerName}</p>
              <p className="player-symbol">{getEmoji(playerSymbol)}</p>
              <div className="player-stats" style={{ fontSize: '0.85rem', marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Stats</div>
                <div>🏆 Wins: {gameState.players[playerSymbol]?.score?.wins || 0}</div>
                <div>🤝 Draws: {gameState.players[playerSymbol]?.score?.draws || 0}</div>
                <div>❌ Losses: {gameState.players[playerSymbol]?.score?.losses || 0}</div>
                <div>🎮 Total: {gameState.players[playerSymbol]?.score?.total || 0}</div>
              </div>
              <p className="player-turn">{gameState.currentPlayer === playerSymbol ? getEmoji(playerSymbol) : '⚫'}</p>
            </div>

            <div className="player-card opponent">
              <p className="player-name">Opponent</p>
              <p className="player-label">{opponentName}</p>
              <p className="player-symbol">{getEmoji(playerSymbol === 'X' ? 'O' : 'X')}</p>
              <div className="player-stats" style={{ fontSize: '0.85rem', marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Stats</div>
                <div>🏆 Wins: {gameState.players[playerSymbol === 'X' ? 'O' : 'X']?.score?.wins || 0}</div>
                <div>🤝 Draws: {gameState.players[playerSymbol === 'X' ? 'O' : 'X']?.score?.draws || 0}</div>
                <div>❌ Losses: {gameState.players[playerSymbol === 'X' ? 'O' : 'X']?.score?.losses || 0}</div>
                <div>🎮 Total: {gameState.players[playerSymbol === 'X' ? 'O' : 'X']?.score?.total || 0}</div>
              </div>
              <p className="player-turn">{gameState.currentPlayer !== playerSymbol ? getEmoji(playerSymbol === 'X' ? 'O' : 'X') : '⚫'}</p>
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
              {getEmoji(cell)}
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

        <div className="chat-container">
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333', textAlign: 'center' }}>💬 Live Chat</h3>
          <div className="chat-messages">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.sender === playerSymbol ? 'self' : 'opponent'}`}>
                <span className="chat-sender">
                  {getEmoji(msg.sender)}
                  {msg.timestamp && <span className="chat-timestamp">{msg.timestamp}</span>}
                </span>
                <span className="chat-text">{msg.message}</span>
              </div>
            ))}
            {isOpponentTyping && (
              <div className="chat-message opponent typing-indicator">
                <span className="chat-sender">
                  {getEmoji(playerSymbol === 'X' ? 'O' : 'X')}
                  <span className="chat-timestamp"></span>
                </span>
                <span className="chat-text">typing<span className="dots">...</span></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-controls">
            {QUICK_EMOJIS.map((e) => (
              <button key={e} className="emoji-btn" onClick={() => sendMessage(e)}>
                {e}
              </button>
            ))}
          </div>
          <form onSubmit={handleChatSubmit} className="chat-form">
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={currentMessage}
              onChange={handleChatChange}
              maxLength="50"
            />
            <button type="submit" className="send-btn">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TicTacToe;
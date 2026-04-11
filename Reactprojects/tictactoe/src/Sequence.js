import React, { useState, useEffect, useRef } from 'react';
import logger from './logger';
import './Sequence.css';
import './TicTacToe.css'; // Reuse the layout and chat box
import { useSocket } from './useSocket';

const QUICK_EMOJIS = ['😂', '😎', '😢', '😡', '👍', '🎉'];

const Sequence = ({ onScoreUpdate, globalPlayerName, setGlobalPlayerName, onPlayMusic, onOpponentLeft, setLockedGameType, activeSocketRef }) => {
  const {
    socket, phase, setPhase, gameState, playerSymbol, gameId, status,
    opponentName, chatMessages, isOpponentTyping, getEmoji
  } = useSocket('sequence', onScoreUpdate, onOpponentLeft, activeSocketRef);

  const [playerName, setPlayerName] = useState(globalPlayerName || '');
  const [currentMessage, setCurrentMessage] = useState('');
  const typingTimeoutRef = useRef(null);
  const chatEndRef = useRef(null);
  const hasAutoJoined = useRef(false);

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

  const playMoveSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
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
    if (socket && globalPlayerName && phase === 'nameInput' && !hasAutoJoined.current) {
      hasAutoJoined.current = true;
      if (onPlayMusic) onPlayMusic();
      logger.playerJoin(globalPlayerName);
      socket.emit('playerJoin', { playerName: globalPlayerName, gameType: 'sequence' });
    }
  }, [socket, globalPlayerName, phase, onPlayMusic]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (playerName.trim() && socket) {
      if (setGlobalPlayerName) setGlobalPlayerName(playerName.trim());
      if (onPlayMusic) onPlayMusic();
      logger.playerJoin(playerName.trim());
      socket.emit('playerJoin', { playerName: playerName.trim(), gameType: 'sequence' });
    }
  };

  const handleCellClick = (rIndex, cIndex) => {
    if (!gameState || gameState.currentPlayer !== playerSymbol || gameState.winner) return;
    playMoveSound();
    socket.emit('playerMove', { index: { r: rIndex, c: cIndex } });
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
        typingTimeoutRef.current = setTimeout(() => { socket.emit('stopTyping'); }, 2000);
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

  const handleResign = () => {
    if (socket && window.confirm('Are you sure you want to resign?')) {
      socket.emit('resignGame');
    }
  };

  const handlePlayAgain = () => {
    socket.emit('gameReset');
  };

  if (phase === 'nameInput') {
    if (globalPlayerName) {
      return (
        <div className="container">
          <div className="welcome-screen">
            <h1>🦊 Sequence 🐸</h1>
            <p className="loading-text">Rejoining as <strong>{globalPlayerName}</strong>...</p>
            <div className="spinner"></div>
          </div>
        </div>
      );
    }
    return (
      <div className="container">
        <div className="welcome-screen">
          <h1>🦊 Sequence 🐸</h1>
          <p className="subtitle">Enter your name to join a game</p>
          <form onSubmit={handleNameSubmit}>
            <input type="text" placeholder="Your name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength="20" disabled={!socket} autoFocus />
            <button type="submit" disabled={!playerName.trim() || !socket}>{socket ? 'Start Game' : 'Connecting...'}</button>
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
          <h1>Sequence (5 in a Row)</h1>
        
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
              </div>
              <p className="player-turn">{gameState.currentPlayer === playerSymbol ? getEmoji(playerSymbol) : '⚫'}</p>
            </div>
            <div className="player-card opponent">
              <p className="player-name">Opponent</p>
              <p className="player-label">{opponentName}</p>
              <p className="player-symbol">{getEmoji(playerSymbol === 'P1' ? 'P2' : 'P1')}</p>
              <div className="player-stats" style={{ fontSize: '0.85rem', marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Stats</div>
                <div>🏆 Wins: {gameState.players[playerSymbol === 'P1' ? 'P2' : 'P1']?.score?.wins || 0}</div>
                <div>🤝 Draws: {gameState.players[playerSymbol === 'P1' ? 'P2' : 'P1']?.score?.draws || 0}</div>
                <div>❌ Losses: {gameState.players[playerSymbol === 'P1' ? 'P2' : 'P1']?.score?.losses || 0}</div>
              </div>
              <p className="player-turn">{gameState.currentPlayer !== playerSymbol ? getEmoji(playerSymbol === 'P1' ? 'P2' : 'P1') : '⚫'}</p>
            </div>
          </div>
          <div className="game-status">
            <p className="status-text">{status}</p>
            <p className="room-info">Game #{gameId}</p>
          </div>
        </div>
        
        <div className="seq-board">
          {gameState.board.map((row, rIndex) => (
            row.map((cell, cIndex) => (
              <div
                key={`${rIndex}-${cIndex}`}
                className={`seq-cell ${!cell && gameState.currentPlayer === playerSymbol && !gameState.winner ? 'clickable' : ''}`}
                onClick={() => handleCellClick(rIndex, cIndex)}
              >
                {cell && <span className="seq-emoji">{getEmoji(cell)}</span>}
              </div>
            ))
          ))}
        </div>

        {gameState.winner && (
          <div className="reset-section">
            <button className="reset-btn" onClick={handlePlayAgain}>Play Again</button>
          </div>
        )}
        {!gameState.winner && phase === 'playing' && (
          <div className="game-actions">
            <button onClick={handleResign} className="resign-btn">
              🏳️ Resign
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
                  {getEmoji(playerSymbol === 'P1' ? 'P2' : 'P1')}
                  <span className="chat-timestamp"></span>
                </span>
                <span className="chat-text">typing<span className="dots">...</span></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-controls">
            {QUICK_EMOJIS.map((e) => (
              <button key={e} className="emoji-btn" onClick={() => sendMessage(e)}>{e}</button>
            ))}
          </div>
          <form onSubmit={handleChatSubmit} className="chat-form">
            <input type="text" className="chat-input" placeholder="Type a message..." value={currentMessage} onChange={handleChatChange} maxLength="50" />
            <button type="submit" className="send-btn">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Sequence;
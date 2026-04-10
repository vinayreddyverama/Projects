import React, { useState, useEffect, useRef } from 'react';
import logger from './logger';
import './Chess.css';
import './TicTacToe.css'; // Reuse layouts
import { useSocket } from './useSocket';

const QUICK_EMOJIS = ['😂', '😎', '😢', '😡', '👍', '🎉'];

const pieceMap = {
  p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔',
  P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚',
};

const Chess = ({ onScoreUpdate, globalPlayerName, setGlobalPlayerName, onPlayMusic, onOpponentLeft, setLockedGameType, activeSocketRef }) => {
  const {
    socket, phase, setPhase, gameState, playerSymbol, gameId, status,
    opponentName, chatMessages, isOpponentTyping, getEmoji
  } = useSocket('chess', onScoreUpdate, onOpponentLeft, activeSocketRef);

  const [playerName, setPlayerName] = useState(globalPlayerName || '');
  const [currentMessage, setCurrentMessage] = useState('');
  const typingTimeoutRef = useRef(null);
  const chatEndRef = useRef(null);
  const hasAutoJoined = useRef(false);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    if (gameState?.fen) {
      const newBoard = [];
      const rows = gameState.fen.split(' ')[0].split('/');
      rows.forEach(row => {
        const boardRow = [];
        for (const char of row) {
          if (isNaN(char)) {
            boardRow.push({ type: char, color: char === char.toUpperCase() ? 'b' : 'w' });
          } else {
            for (let i = 0; i < parseInt(char, 10); i++) {
              boardRow.push(null);
            }
          }
        }
        newBoard.push(boardRow);
      });
      setBoard(newBoard);
    }
  }, [gameState]);

  const playSendSound = () => new Audio('https://assets.mixkit.co/active_storage/sfx/3005/3005-preview.mp3').play();
  const playReceiveSound = () => new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3').play();
  const playMoveSound = () => new Audio('https://assets.mixkit.co/active_storage/sfx/1648/1648-preview.mp3').play();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].sender !== playerSymbol) playReceiveSound();
  }, [chatMessages, isOpponentTyping, playerSymbol]);

  useEffect(() => {
    if (socket && globalPlayerName && phase === 'nameInput' && !hasAutoJoined.current) {
      hasAutoJoined.current = true;
      if (onPlayMusic) onPlayMusic();
      socket.emit('playerJoin', { playerName: globalPlayerName, gameType: 'chess' });
    }
  }, [socket, globalPlayerName, phase, onPlayMusic]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (playerName.trim() && socket) {
      if (setGlobalPlayerName) setGlobalPlayerName(playerName.trim());
      if (onPlayMusic) onPlayMusic();
      socket.emit('playerJoin', { playerName: playerName.trim(), gameType: 'chess' });
    }
  };

  const handleSquareClick = (r, c) => {
    if (!gameState || gameState.turn !== playerSymbol || gameState.isGameOver) return;

    const squareName = String.fromCharCode(97 + c) + (8 - r);
    const piece = board[r][c];

    if (selectedSquare) {
      // This is the second click (making a move)
      const move = { from: selectedSquare, to: squareName };
      socket.emit('playerMove', { index: move });
      playMoveSound();
      setSelectedSquare(null);
    } else if (piece && piece.color === playerSymbol) {
      // This is the first click (selecting a piece)
      setSelectedSquare(squareName);
    }
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
      if (e.target.value.trim() === '') socket.emit('stopTyping');
      else socket.emit('typing');
    }
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    sendMessage(currentMessage);
    setCurrentMessage('');
    if (socket) socket.emit('stopTyping');
  };

  const handlePlayAgain = () => {
    socket.emit('gameReset');
    setPhase('playing');
  };

  if (phase === 'nameInput') {
    return (
      <div className="container">
        <div className="welcome-screen">
          <h1>♚ Chess ♔</h1>
          <p className="subtitle">Enter your name to join a game</p>
          <form onSubmit={handleNameSubmit}>
            <input type="text" placeholder="Your name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength="20" disabled={!socket} autoFocus />
            <button type="submit" disabled={!playerName.trim() || !socket}>{socket ? 'Start Game' : 'Connecting...'}</button>
          </form>
        </div>
      </div>
    );
  }

  if (phase === 'waiting' || !gameState) {
    return (
      <div className="container">
        <div className="game-screen">
          <h1>⏳ Waiting</h1>
          <p className="loading-text">Player: <strong>{playerName}</strong> ({playerSymbol === 'w' ? 'White' : 'Black'})</p>
          <p className="loading-text">Waiting for another player to join...</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="game-layout">
        <div className="game-screen">
          <h1>Chess</h1>
          <div className="game-info">
            <div className="player-info">
              <div className="player-card">
                <p className="player-name">You ({playerSymbol === 'w' ? 'White' : 'Black'})</p>
                <p className="player-label">{playerName}</p>
                <div className="player-stats" style={{ fontSize: '0.85rem', marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
                  <div>🏆 Wins: {gameState.players[playerSymbol]?.score?.wins || 0}</div>
                  <div>🤝 Draws: {gameState.players[playerSymbol]?.score?.draws || 0}</div>
                  <div>❌ Losses: {gameState.players[playerSymbol]?.score?.losses || 0}</div>
                </div>
                <p className="player-turn">{gameState.turn === playerSymbol ? 'Your Turn' : '⚫'}</p>
              </div>
              <div className="player-card opponent">
                <p className="player-name">Opponent ({playerSymbol === 'w' ? 'Black' : 'White'})</p>
                <p className="player-label">{opponentName}</p>
                <div className="player-stats" style={{ fontSize: '0.85rem', marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
                  <div>🏆 Wins: {gameState.players[playerSymbol === 'w' ? 'b' : 'w']?.score?.wins || 0}</div>
                  <div>🤝 Draws: {gameState.players[playerSymbol === 'w' ? 'b' : 'w']?.score?.draws || 0}</div>
                  <div>❌ Losses: {gameState.players[playerSymbol === 'w' ? 'b' : 'w']?.score?.losses || 0}</div>
                </div>
                <p className="player-turn">{gameState.turn !== playerSymbol ? 'Their Turn' : '⚫'}</p>
              </div>
            </div>
            <div className="game-status">
              <p className="status-text">{status}</p>
              <p className="room-info">Game #{gameId}</p>
            </div>
          </div>

          <div className="chess-board-container">
            <div className={`chess-board ${playerSymbol === 'b' ? 'flipped' : ''}`}>
              {board.map((row, rIndex) => (
                row.map((piece, cIndex) => {
                  const squareName = String.fromCharCode(97 + cIndex) + (8 - rIndex);
                  return (
                    <div
                      key={`${rIndex}-${cIndex}`}
                      className={`chess-square ${(rIndex + cIndex) % 2 === 0 ? 'light' : 'dark'} ${selectedSquare === squareName ? 'selected' : ''}`}
                      onClick={() => handleSquareClick(rIndex, cIndex)}
                    >
                      {piece && <span className="chess-piece">{pieceMap[piece.type]}</span>}
                    </div>
                  );
                })
              ))}
            </div>
          </div>

          {gameState.isGameOver && (
            <div className="reset-section">
              <button onClick={handlePlayAgain} className="reset-btn">Play Again</button>
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
                <span className="chat-sender">{getEmoji(playerSymbol === 'w' ? 'b' : 'w')}</span>
                <span className="chat-text">typing...</span>
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

export default Chess;
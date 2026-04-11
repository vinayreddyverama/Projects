import React, { useState, useEffect, useRef } from 'react';
import './Chess.css';
import './TicTacToe.css'; // Reuse layouts
import { useSocket } from './useSocket';
import { Chess as ChessJS } from 'chess.js';

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
  const hasAutoJoined = useRef(false);
  const typingTimeoutRef = useRef(null);
  const chatEndRef = useRef(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [board, setBoard] = useState([]);
  const [promotionData, setPromotionData] = useState(null);
  const [drawOfferFrom, setDrawOfferFrom] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [kingInCheckSquare, setKingInCheckSquare] = useState(null);

  const chess = React.useMemo(() => {
    try {
      // Creates a new chess instance based on the FEN from the server
      return new ChessJS(gameState?.fen);
    } catch (e) {
      // Fallback to a default board if FEN is invalid
      return new ChessJS();
    }
  }, [gameState?.fen]);

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

    // Update last move highlight
    const history = gameState?.history;
    if (history && history.length > 0) {
      const last = history[history.length - 1];
      setLastMove({ from: last.from, to: last.to });
    } else {
      setLastMove(null);
    }

    // Update check highlight
    if (chess.isCheck()) {
      // Find the king of the current turn's color
      const kingSquare = chess.board().flat().find(p => p && p.type === 'k' && p.color === chess.turn())?.square;
      setKingInCheckSquare(kingSquare || null);
    } else {
      setKingInCheckSquare(null);
    }

    // Update draw offer status
    setDrawOfferFrom(gameState?.drawOffer || null);
  }, [gameState, chess]);

  const playSendSound = () => new Audio('https://assets.mixkit.co/active_storage/sfx/3005/3005-preview.mp3').play();
  const playReceiveSound = () => new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3').play();
  const playMoveSound = () => new Audio('https://assets.mixkit.co/active_storage/sfx/1648/1648-preview.mp3').play(); // A nice piece-placing sound

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].sender !== playerSymbol) playReceiveSound();
  }, [chatMessages, isOpponentTyping, playerSymbol]);

  useEffect(() => {
    if (selectedSquare) {
      const moves = chess.moves({ square: selectedSquare, verbose: true });
      setPossibleMoves(moves.map(move => move.to));
    } else {
      setPossibleMoves([]);
    }
  }, [selectedSquare, chess]);

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
    if (!gameState || gameState.turn !== playerSymbol || gameState.winner) return;

    const squareName = String.fromCharCode(97 + c) + (8 - r);
    const piece = board[r][c];

    // If a piece is already selected
    if (selectedSquare) {
      // If the clicked square is a valid move, make the move
      if (possibleMoves.includes(squareName)) {
        const fromPiece = chess.get(selectedSquare);
        if (!fromPiece) return; // Defensive check
        const isPromotion = fromPiece.type === 'p' && (squareName[1] === '8' || squareName[1] === '1');

        if (isPromotion) {
          setPromotionData({ from: selectedSquare, to: squareName });
        } else {
          const move = { from: selectedSquare, to: squareName };
          socket.emit('playerMove', { index: move });
          playMoveSound();
        }
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (piece && piece.color === playerSymbol) {
        // If another of the player's own pieces is clicked, switch selection
        setSelectedSquare(squareName);
      } else {
        // Otherwise, deselect
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    } else if (piece && piece.color === playerSymbol) {
      // If no piece is selected, select the clicked piece
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

  const handleOfferDraw = () => {
    if (socket) {
      socket.emit('offerDraw');
    }
  };

  const handleDeclineDraw = () => {
    if (socket) {
      socket.emit('declineDraw');
    }
  };

  const handleAcceptDraw = () => {
    if (socket) {
      socket.emit('acceptDraw');
    }
  };

  const handleResign = () => {
    if (socket && window.confirm('Are you sure you want to resign?')) {
      socket.emit('resignGame');
    }
  };

  const handlePromotion = (piece) => {
    if (!promotionData) return;
    const move = { ...promotionData, promotion: piece };
    socket.emit('playerMove', { index: move });
    playMoveSound();
    setPromotionData(null);
  };

  const handlePlayAgain = () => {
    socket.emit('gameReset');
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

  const capturedPieces = gameState?.capturedPieces || { w: [], b: [] };
  const materialAdvantage = gameState?.materialAdvantage || 0;

  return (
    <div className="container chess-container">
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
                <div className="captured-pieces-wrapper">
                  <div className="captured-pieces">
                    {capturedPieces[playerSymbol]?.map((p, i) => <span key={i} className="captured-piece">{pieceMap[p]}</span>)}
                  </div>
                  {playerSymbol === 'w' && materialAdvantage > 0 && <span className="material-advantage">+{materialAdvantage}</span>}
                  {playerSymbol === 'b' && materialAdvantage < 0 && <span className="material-advantage">+{Math.abs(materialAdvantage)}</span>}
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
                <div className="captured-pieces-wrapper">
                  <div className="captured-pieces">
                    {capturedPieces[playerSymbol === 'w' ? 'b' : 'w']?.map((p, i) => <span key={i} className="captured-piece">{pieceMap[p]}</span>)}
                  </div>
                  {playerSymbol === 'b' && materialAdvantage > 0 && <span className="material-advantage">+{materialAdvantage}</span>}
                  {playerSymbol === 'w' && materialAdvantage < 0 && <span className="material-advantage">+{Math.abs(materialAdvantage)}</span>}
                </div>
                <p className="player-turn">{gameState.turn !== playerSymbol ? 'Their Turn' : '⚫'}</p>
              </div>
            </div>
            <div className="game-status">
              <p className="status-text">{status}</p>
              <p className="room-info">Game #{gameId}</p>
            </div>
            {!gameState.winner && phase === 'playing' && (
              <div className="ingame-actions">
                <button onClick={handleResign} className="ingame-btn resign">
                  🏳️ Resign
                </button>
                {drawOfferFrom === (playerSymbol === 'w' ? 'b' : 'w') ? (
                  <>
                    <button onClick={handleAcceptDraw} className="ingame-btn accept-draw">
                      Accept Draw
                    </button>
                    <button onClick={handleDeclineDraw} className="ingame-btn decline-draw">
                      Decline
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleOfferDraw} 
                    className="ingame-btn draw" 
                    disabled={drawOfferFrom !== null}
                  >
                    {drawOfferFrom === playerSymbol ? 'Draw Offered' : '🤝 Offer Draw'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="chess-board-wrapper">
            <div className={`chess-board ${playerSymbol === 'b' ? 'flipped' : ''}`}>
              {board.map((row, rIndex) => (
                row.map((piece, cIndex) => {
                  const squareName = String.fromCharCode(97 + cIndex) + (8 - rIndex);
                  const isLight = (rIndex + cIndex) % 2 === 0;
                  return (
                    <div
                      key={`${rIndex}-${cIndex}`}
                      className={`chess-square ${isLight ? 'light' : 'dark'} 
                        ${selectedSquare === squareName ? 'selected' : ''}
                        ${lastMove?.from === squareName || lastMove?.to === squareName ? 'last-move' : ''}
                        ${kingInCheckSquare === squareName ? 'in-check' : ''}
                      `}
                      onClick={() => handleSquareClick(rIndex, cIndex)}
                    >
                      {cIndex === 0 && <span className="rank-label">{8 - rIndex}</span>}
                      {rIndex === 7 && <span className="file-label">{String.fromCharCode(97 + cIndex)}</span>}
                      {piece && <span className="chess-piece">{pieceMap[piece.type]}</span>}
                      {possibleMoves.includes(squareName) && (
                        <div className="possible-move-dot" />
                      )}
                    </div>
                  );
                })
              ))}
            </div>
          </div>

          {gameState.winner && (
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
        {promotionData && (
          <div className="promotion-overlay">
            <div className="promotion-modal">
              <h3>Promote Pawn to:</h3>
              <div className="promotion-choices">
                <button onClick={() => handlePromotion('q')}>{pieceMap[playerSymbol === 'w' ? 'q' : 'Q']}</button>
                <button onClick={() => handlePromotion('r')}>{pieceMap[playerSymbol === 'w' ? 'r' : 'R']}</button>
                <button onClick={() => handlePromotion('b')}>{pieceMap[playerSymbol === 'w' ? 'b' : 'B']}</button>
                <button onClick={() => handlePromotion('n')}>{pieceMap[playerSymbol === 'w' ? 'n' : 'N']}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chess;
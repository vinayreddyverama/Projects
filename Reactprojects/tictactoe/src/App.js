import React, { useState, useCallback, useRef, useEffect } from 'react';
import Confetti from 'react-confetti';
import './App.css';
import './GameHub.css';
import TicTacToe from './TicTacToe';
import Connect4 from './Connect4';
import Sequence from './Sequence';
import Chess from './Chess';
import { useSocket } from './useSocket';

const QUICK_EMOJIS = ['😂', '😎', '😢', '😡', '👍', '🎉'];

function SummarySocketManager({ onOpponentLeft, activeSocketRef, globalChat, globalPlayerName }) {
  // This component's only job is to keep a socket connection alive on the summary screen for chat.
  const { socket } = useSocket('summary', () => {}, onOpponentLeft, activeSocketRef, globalChat);
  const hasAutoJoined = useRef(false);
  useEffect(() => {
    if (socket && globalPlayerName && !hasAutoJoined.current) {
      hasAutoJoined.current = true;
      // Use a special gameType 'summary' to join a non-game room for chatting
      socket.emit('playerJoin', { playerName: globalPlayerName, gameType: 'summary' });
    }
  }, [socket, globalPlayerName]);
  return null;
}

function App() {
  const [activeTab, setActiveTab] = useState('tictactoe');
  const [globalPlayerName, setGlobalPlayerName] = useState('');
  const [lockedGameType, setLockedGameType] = useState(null);
  const [scores, setScores] = useState({
    tictactoe: { wins: 0, losses: 0, draws: 0, played: false },
    connect4: { wins: 0, losses: 0, draws: 0, played: false },
    sequence: { wins: 0, losses: 0, draws: 0, played: false },
    chess: { wins: 0, losses: 0, draws: 0, played: false }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [notification, setNotification] = useState('');
  const activeSocketRef = useRef(null);

  // Centralized Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const chatEndRef = useRef(null);
  const globalChat = { setChatMessages, setIsOpponentTyping };

  const handleScoreUpdate = useCallback((game, wins, losses, draws = 0) => {
    setScores(prev => {
      // Only trigger a state update if the score has actually changed
      if (prev[game].wins === wins && prev[game].losses === losses && prev[game].draws === draws && prev[game].played) {
        return prev;
      }
      return {
        ...prev,
        [game]: { wins, losses, draws, played: true }
      };
    });
  }, []);

  // Memoize the callbacks so they don't force games to needlessly re-render
  const handleTicTacToeScore = useCallback((wins, losses, draws) => handleScoreUpdate('tictactoe', wins, losses, draws), [handleScoreUpdate]);
  const handleConnect4Score = useCallback((wins, losses, draws) => handleScoreUpdate('connect4', wins, losses, draws), [handleScoreUpdate]);
  const handleSequenceScore = useCallback((wins, losses, draws) => handleScoreUpdate('sequence', wins, losses, draws), [handleScoreUpdate]);
  const handleChessScore = useCallback((wins, losses, draws) => handleScoreUpdate('chess', wins, losses, draws), [handleScoreUpdate]);

  const renderScore = (game) => {
    const score = scores[game];
    if (!score.played && score.wins === 0 && score.losses === 0 && score.draws === 0) return null;
    
    const isWinsHigh = score.wins > score.losses;
    const isLossesHigh = score.losses > score.wins;
    
    return (
      <span className="sidebar-score">
        <span style={{ color: isWinsHigh ? '#4ade80' : (score.wins === score.losses ? '#cbd5e1' : '#ff6b6b') }}>{score.wins}W</span>
        {' - '}
        <span style={{ color: isLossesHigh ? '#4ade80' : (score.wins === score.losses ? '#cbd5e1' : '#ff6b6b') }}>{score.losses}L</span>
        {score.draws > 0 && <span style={{ color: '#cbd5e1' }}> - {score.draws}D</span>}
      </span>
    );
  };

  const toggleMusic = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.log("Audio play failed:", err));
    }
    setIsPlaying(!isPlaying);
  };

  const playMusic = () => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.log("Audio play failed:", err));
    }
  };

  const resetSessionScores = useCallback(() => {
    setScores({
      tictactoe: { wins: 0, losses: 0, draws: 0, played: false },
      connect4: { wins: 0, losses: 0, draws: 0, played: false },
      sequence: { wins: 0, losses: 0, draws: 0, played: false },
      chess: { wins: 0, losses: 0, draws: 0, played: false }
    });
    setGlobalPlayerName('');
    setLockedGameType(null);
  }, []);

  const handleOpponentLeft = useCallback((reason, targetGame) => {
    // Delay unmounting to ensure WebSocket packets are successfully sent
    setTimeout(() => {
      if (reason === 'end') {
        setNotification('⚠️ The session was ended by your opponent.');
      } else {
        setNotification('⚠️ Your opponent disconnected and failed to return.');
      }
      setActiveTab('summary');
    }, 100);
  }, []);

  const handleTabChange = (tab) => {
    setNotification(''); // Clear notification when switching tabs
    setActiveTab(tab);
  };

  const resetSession = () => {
    resetSessionScores();
    handleTabChange('tictactoe');
  };

  const playCelebrationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'); // Crowd cheering
    audio.volume = 0.6;
    audio.play().catch(() => {});
  };

  const handleEndSession = (reason = 'end') => {
    playCelebrationSound();
    if (activeSocketRef.current) {
      if (reason === 'resign') {
        activeSocketRef.current.emit('resignSession');
        setNotification('⚠️ You resigned. The session has ended.');
      } else {
        activeSocketRef.current.emit('endSession');
        setNotification('⚠️ The session was ended by you.');
      }
      setTimeout(() => {
        handleTabChange('summary');
      }, 100);
      return;
    }
    // Fallback for when there is no active socket
    setNotification(reason === 'resign' ? '⚠️ You resigned. The session has ended.' : '⚠️ The session was ended by you.');
    handleTabChange('summary');
  };

  const playSendSound = () => new Audio('https://assets.mixkit.co/active_storage/sfx/3005/3005-preview.mp3').play();
  const playReceiveSound = () => new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3').play();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      // The sender name is now on the message object from the server
      if (lastMsg.senderName && lastMsg.senderName !== globalPlayerName) {
        playReceiveSound();
      }
    }
  }, [chatMessages, isOpponentTyping, globalPlayerName]);

  const sendMessage = (message) => {
    if (activeSocketRef.current && message.trim()) {
      playSendSound();
      activeSocketRef.current.emit('sendMessage', message);
    }
  };

  const handleChatChange = (e) => {
    setCurrentMessage(e.target.value);
    if (activeSocketRef.current) {
      if (e.target.value.trim() === '') {
        activeSocketRef.current.emit('stopTyping');
      } else {
        activeSocketRef.current.emit('typing');
      }
    }
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (currentMessage.trim()) {
      sendMessage(currentMessage);
      setCurrentMessage('');
      if (activeSocketRef.current) {
        activeSocketRef.current.emit('stopTyping');
      }
    }
  };

  const renderSummary = () => {
    const tt = scores.tictactoe;
    const c4 = scores.connect4;
    const seq = scores.sequence;
    const chess = scores.chess;
    const ttTotal = tt.wins + tt.losses + tt.draws;
    const c4Total = c4.wins + c4.losses + c4.draws;
    const seqTotal = seq.wins + seq.losses + seq.draws;
    const chessTotal = chess.wins + chess.losses + chess.draws;
    const overallWins = tt.wins + c4.wins + seq.wins + chess.wins;
    const overallLosses = tt.losses + c4.losses + seq.losses + chess.losses;
    const overallDraws = tt.draws + c4.draws + seq.draws + chess.draws;
    const overallTotal = ttTotal + c4Total + seqTotal;
    const overallWinRate = overallTotal > 0 ? ((overallWins / overallTotal) * 100).toFixed(1) : 0;
    const ttWinRate = ttTotal > 0 ? ((tt.wins / ttTotal) * 100).toFixed(1) : 0;

    return (
      <div className="summary-screen">
        {notification && (
          <div style={{
            background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
            color: '#333',
            padding: '15px 20px',
            borderRadius: '15px',
            marginBottom: '25px',
            fontWeight: 'bold',
            fontSize: '1.2em',
            boxShadow: '0 10px 20px rgba(246, 211, 101, 0.4)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            {notification}
          </div>
        )}
        <h1>🏆 Overall Performance</h1>
        {globalPlayerName && <h2>{globalPlayerName}</h2>}
        
        <div className="summary-cards">
          <div className="summary-card overall">
            <h3>Overall Performance</h3>
            <p>Games Played: <strong>{overallTotal}</strong></p>
            <p>Score: <strong style={{color: '#4ade80'}}>{overallWins}W</strong> - <strong style={{color: '#ff6b6b'}}>{overallLosses}L</strong> - <strong>{overallDraws}D</strong></p>
            <p>Win Rate: <strong>{overallWinRate}%</strong></p>
          </div>
          <div className="summary-card">
            <h3>Tic Tac Toe</h3>
            <p>Games Played: <strong>{ttTotal}</strong></p>
            <p>Score: <strong style={{color: '#4ade80'}}>{tt.wins}W</strong> - <strong style={{color: '#ff6b6b'}}>{tt.losses}L</strong> - <strong>{tt.draws}D</strong></p>
            <p>Win Rate: <strong>{ttWinRate}%</strong></p>
          </div>
          <div className="summary-card">
            <h3>Connect 4</h3>
            <p>Games Played: <strong>{scores.connect4.wins + scores.connect4.losses + scores.connect4.draws}</strong></p>
            <p>Score: <strong style={{color: '#4ade80'}}>{scores.connect4.wins}W</strong> - <strong style={{color: '#ff6b6b'}}>{scores.connect4.losses}L</strong> - <strong>{scores.connect4.draws}D</strong></p>
            <p>Win Rate: <strong>{( (scores.connect4.wins + scores.connect4.losses + scores.connect4.draws) > 0 ? ((scores.connect4.wins / (scores.connect4.wins + scores.connect4.losses + scores.connect4.draws)) * 100).toFixed(1) : 0)}%</strong></p>
          </div>
          <div className="summary-card">
            <h3>Sequence (5 in a Row)</h3>
            <p>Games Played: <strong>{scores.sequence.wins + scores.sequence.losses + scores.sequence.draws}</strong></p>
            <p>Score: <strong style={{color: '#4ade80'}}>{scores.sequence.wins}W</strong> - <strong style={{color: '#ff6b6b'}}>{scores.sequence.losses}L</strong> - <strong>{scores.sequence.draws}D</strong></p>
            <p>Win Rate: <strong>{( (scores.sequence.wins + scores.sequence.losses + scores.sequence.draws) > 0 ? ((scores.sequence.wins / (scores.sequence.wins + scores.sequence.losses + scores.sequence.draws)) * 100).toFixed(1) : 0)}%</strong></p>
          </div>
          <div className="summary-card">
            <h3>Chess</h3>
            <p>Games Played: <strong>{chessTotal}</strong></p>
            <p>Score: <strong style={{color: '#4ade80'}}>{chess.wins}W</strong> - <strong style={{color: '#ff6b6b'}}>{chess.losses}L</strong> - <strong>{chess.draws}D</strong></p>
            <p>Win Rate: <strong>{(chessTotal > 0 ? ((chess.wins / chessTotal) * 100).toFixed(1) : 0)}%</strong></p>
          </div>
        </div>
        <button className="reset-btn" onClick={resetSession} style={{ marginTop: '40px', padding: '15px 40px', fontSize: '1.3em' }}>
          🚀 Start a New Adventure! (Reset Scores)
        </button>
      </div>
    );
  };

  return (
    <div className="app-wrapper">
      <audio ref={audioRef} src="https://assets.mixkit.co/music/preview/mixkit-happy-times-158.mp3" loop preload="auto" />
      {activeTab === 'summary' && (
        <>
          {/* Top-down falling confetti */}
          <Confetti 
            width={window.innerWidth} 
            height={window.innerHeight} 
            recycle={false} 
            numberOfPieces={500} 
            gravity={0.15}
          />
          {/* Left cannon blast */}
          <Confetti 
            width={window.innerWidth} 
            height={window.innerHeight} 
            recycle={false} 
            numberOfPieces={300} 
            gravity={0.2}
            confettiSource={{ x: 0, y: window.innerHeight, w: 10, h: 10 }}
            initialVelocityX={15}
            initialVelocityY={-30}
          />
          {/* Right cannon blast */}
          <Confetti 
            width={window.innerWidth} 
            height={window.innerHeight} 
            recycle={false} 
            numberOfPieces={300} 
            gravity={0.2}
            confettiSource={{ x: window.innerWidth, y: window.innerHeight, w: 10, h: 10 }}
            initialVelocityX={-15}
            initialVelocityY={-30}
          />
        </>
      )}
      <div className="sidebar">
        <h2>Game Hub</h2>
        <div className="sidebar-links">
          <button 
            className={`sidebar-btn ${activeTab === 'tictactoe' ? 'active' : ''}`}
            onClick={() => setActiveTab('tictactoe')}
            disabled={lockedGameType && lockedGameType !== 'tictactoe'}
          >
            <span>Tic Tac Toe</span>
            {renderScore('tictactoe')}
          </button>
          <button 
            className={`sidebar-btn ${activeTab === 'connect4' ? 'active' : ''}`}
            onClick={() => setActiveTab('connect4')}
            disabled={lockedGameType && lockedGameType !== 'connect4'}
          >
            <span>Connect 4</span>
            {renderScore('connect4')}
          </button>
          <button 
            className={`sidebar-btn ${activeTab === 'sequence' ? 'active' : ''}`}
            onClick={() => setActiveTab('sequence')}
            disabled={lockedGameType && lockedGameType !== 'sequence'}
          >
            <span>Sequence</span>
            {renderScore('sequence')}
          </button>
          <button 
            className={`sidebar-btn ${activeTab === 'chess' ? 'active' : ''}`}
            onClick={() => setActiveTab('chess')}
            disabled={lockedGameType && lockedGameType !== 'chess'}
          >
            <span>Chess</span>
            {renderScore('chess')}
          </button>
          <button className="sidebar-btn" onClick={toggleMusic}>
            <span>{isPlaying ? '🔊 Music On' : '🔈 Music Off'}</span>
          </button>
        </div>
        <button 
          className={`sidebar-btn end-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => handleEndSession('end')}
        >
          <span>🏁 End & Summary</span>
        </button>
      </div>
      <div className="content-wrapper">
        <div className="main-content">
          {activeTab === 'summary' ? (
            <>
              <SummarySocketManager 
                onOpponentLeft={handleOpponentLeft} 
                activeSocketRef={activeSocketRef} 
                globalChat={globalChat}
                globalPlayerName={globalPlayerName}
              />
              {renderSummary()}
            </>
          ) : activeTab === 'connect4' ? (
            <Connect4 
              onScoreUpdate={handleConnect4Score} globalPlayerName={globalPlayerName} 
              setGlobalPlayerName={setGlobalPlayerName} onPlayMusic={playMusic}
              onOpponentLeft={handleOpponentLeft} setLockedGameType={setLockedGameType}
              onResign={() => handleEndSession('resign')} activeSocketRef={activeSocketRef}
              globalChat={globalChat}
            />
          ) : activeTab === 'sequence' ? (
            <Sequence 
              onScoreUpdate={handleSequenceScore} globalPlayerName={globalPlayerName} 
              setGlobalPlayerName={setGlobalPlayerName} onPlayMusic={playMusic}
              onOpponentLeft={handleOpponentLeft} setLockedGameType={setLockedGameType}
              onResign={() => handleEndSession('resign')} activeSocketRef={activeSocketRef}
              globalChat={globalChat}
            />
          ) : activeTab === 'chess' ? (
            <Chess
              onScoreUpdate={handleChessScore} globalPlayerName={globalPlayerName}
              setGlobalPlayerName={setGlobalPlayerName} onPlayMusic={playMusic}
              onOpponentLeft={handleOpponentLeft} setLockedGameType={setLockedGameType}
              onResign={() => handleEndSession('resign')} activeSocketRef={activeSocketRef}
              globalChat={globalChat}
            />
          ) : (
            <TicTacToe 
              onScoreUpdate={handleTicTacToeScore} globalPlayerName={globalPlayerName} 
              setGlobalPlayerName={setGlobalPlayerName} onPlayMusic={playMusic}
              onOpponentLeft={handleOpponentLeft} setLockedGameType={setLockedGameType}
              onResign={() => handleEndSession('resign')} activeSocketRef={activeSocketRef}
              globalChat={globalChat}
            />
          )}
        </div>
        <div className="chat-container">
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#fff', textAlign: 'center' }}>💬 Live Chat</h3>
            <div className="chat-messages">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.senderName === globalPlayerName ? 'self' : 'opponent'}`}>
                  <span className="chat-sender">
                    {msg.senderName === globalPlayerName ? 'You' : msg.senderName}
                    {msg.timestamp && <span className="chat-timestamp">{msg.timestamp}</span>}
                  </span>
                  <span className="chat-text">{msg.message}</span>
                </div>
              ))}
              {isOpponentTyping && (
                <div className="chat-message opponent typing-indicator">
                  <span className="chat-sender">Opponent</span>
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
              <input 
                type="text" 
                className="chat-input" 
                placeholder="Type a message..." 
                value={currentMessage} 
                onChange={handleChatChange} 
                maxLength="100" 
                disabled={!globalPlayerName} 
              />
              <button 
                type="submit" 
                className="send-btn" 
                disabled={!globalPlayerName || !currentMessage.trim()}
              >
                Send
              </button>
            </form>
          </div>
      </div>
    </div>
  );
}

export default App;

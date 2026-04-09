import React, { useState, useCallback, useRef } from 'react';
import Confetti from 'react-confetti';
import './App.css';
import './GameHub.css';
import TicTacToe from './TicTacToe';
import Connect4 from './Connect4';
import Sequence from './Sequence';

function App() {
  const [activeTab, setActiveTab] = useState('tictactoe');
  const [globalPlayerName, setGlobalPlayerName] = useState('');
  const [scores, setScores] = useState({
    tictactoe: { wins: 0, losses: 0, draws: 0, played: false },
    connect4: { wins: 0, losses: 0, draws: 0, played: false },
    sequence: { wins: 0, losses: 0, draws: 0, played: false }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [notification, setNotification] = useState('');
  const activeSocketRef = useRef(null);

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
      sequence: { wins: 0, losses: 0, draws: 0, played: false }
    });
    setGlobalPlayerName('');
  }, []);

  const handleOpponentLeft = useCallback((reason, targetGame) => {
    if (activeSocketRef.current) {
      activeSocketRef.current.emit('switchGame', 'summary');
    }
    
    // Delay unmounting to ensure WebSocket packets are successfully sent
    setTimeout(() => {
      if (reason === 'switch') {
        const names = { tictactoe: 'Tic Tac Toe', connect4: 'Connect 4', sequence: 'Sequence' };
        const gameName = names[targetGame];
        if (gameName) {
          setNotification(`⚠️ Your opponent moved to ${gameName}! Select it from the sidebar to follow.`);
        }
        // By not having an 'else', we prevent notifications for non-game tabs like 'summary'.
      } else if (reason === 'end') {
        setNotification('⚠️ The session was ended by your opponent.');
        resetSessionScores();
      } else {
        setNotification('⚠️ Your opponent disconnected and failed to return.');
      }
      setActiveTab('summary');
    }, 100);
  }, [resetSessionScores]);

  const handleTabChange = (tab) => {
    if (activeTab !== 'summary' && tab !== activeTab && activeSocketRef.current) {
      activeSocketRef.current.emit('switchGame', tab);
      setTimeout(() => {
        setNotification('');
        setActiveTab(tab);
      }, 100);
      return;
    }
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

  const handleEndSession = () => {
    playCelebrationSound();
    if (activeSocketRef.current) {
      activeSocketRef.current.emit('endSession');
      setTimeout(() => {
        handleTabChange('summary');
      }, 100);
      return;
    }
    handleTabChange('summary');
  };

  const renderSummary = () => {
    const tt = scores.tictactoe;
    const c4 = scores.connect4;
    const seq = scores.sequence;
    const ttTotal = tt.wins + tt.losses + tt.draws;
    const c4Total = c4.wins + c4.losses + c4.draws;
    const seqTotal = seq.wins + seq.losses + seq.draws;
    const overallWins = tt.wins + c4.wins + seq.wins;
    const overallLosses = tt.losses + c4.losses + seq.losses;
    const overallDraws = tt.draws + c4.draws + seq.draws;
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
            onClick={() => handleTabChange('tictactoe')}
          >
            <span>Tic Tac Toe</span>
            {renderScore('tictactoe')}
          </button>
          <button 
            className={`sidebar-btn ${activeTab === 'connect4' ? 'active' : ''}`}
            onClick={() => handleTabChange('connect4')}
          >
            <span>Connect 4</span>
            {renderScore('connect4')}
          </button>
          <button 
            className={`sidebar-btn ${activeTab === 'sequence' ? 'active' : ''}`}
            onClick={() => handleTabChange('sequence')}
          >
            <span>Sequence</span>
            {renderScore('sequence')}
          </button>
          <button className="sidebar-btn" onClick={toggleMusic}>
            <span>{isPlaying ? '🔊 Music On' : '🔈 Music Off'}</span>
          </button>
        </div>
        <button 
          className={`sidebar-btn end-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={handleEndSession}
        >
          <span>🏁 End & Summary</span>
        </button>
      </div>
      <div className="main-content">
        {activeTab === 'summary' ? (
          renderSummary()
        ) : activeTab === 'connect4' ? (
          <Connect4 
            onScoreUpdate={handleConnect4Score} 
            globalPlayerName={globalPlayerName} 
            setGlobalPlayerName={setGlobalPlayerName} 
            onPlayMusic={playMusic}
            onOpponentLeft={handleOpponentLeft}
            activeSocketRef={activeSocketRef}
          />
        ) : activeTab === 'sequence' ? (
          <Sequence 
            onScoreUpdate={handleSequenceScore} 
            globalPlayerName={globalPlayerName} 
            setGlobalPlayerName={setGlobalPlayerName} 
            onPlayMusic={playMusic}
            onOpponentLeft={handleOpponentLeft}
            activeSocketRef={activeSocketRef}
          />
        ) : (
          <TicTacToe 
            onScoreUpdate={handleTicTacToeScore} 
            globalPlayerName={globalPlayerName} 
            setGlobalPlayerName={setGlobalPlayerName} 
            onPlayMusic={playMusic}
            onOpponentLeft={handleOpponentLeft}
            activeSocketRef={activeSocketRef}
          />
        )}
      </div>
    </div>
  );
}

export default App;

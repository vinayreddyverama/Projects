import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import logger from './logger';

export const useSocket = (gameType, onScoreUpdate, onOpponentLeft) => {
  const [socket, setSocket] = useState(null);
  const [phase, setPhase] = useState('nameInput');
  const [gameState, setGameState] = useState(null);
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [status, setStatus] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(null);
  const activeSocketRef = useRef(null);

  const getEmoji = (sym) => {
    if (gameType === 'tictactoe') return sym;
    if (gameType === 'connect4') return sym === 'Red' ? '🍎' : '🥭';
    if (gameType === 'sequence') return sym === 'P1' ? '🔴' : '🟡';
    return '';
  };

  useEffect(() => {
    let isMounted = true;

    const updateStatus = (state, currentPlayerSymbol, oppName = '') => {
      if (!isMounted) return;
      if (state.winner) {
        if (state.winner === 'draw') {
          setStatus("It's a Draw! 🤝");
        } else {
          const winnerName = state.players[state.winner]?.name || state.winner;
          setStatus(state.winner === currentPlayerSymbol ? `You won! 🎉 ${getEmoji(currentPlayerSymbol)} (${winnerName})` : `Winner: ${winnerName} ${getEmoji(state.winner)}`);
        }
      } else {
        setStatus(state.currentPlayer === currentPlayerSymbol ? 'Your turn' : `${oppName}'s turn`);
      }
    };

    const checkScoreUpdate = (state, currentSocketId) => {
      if (!state || !state.players) return;
      const mySymbol = Object.keys(state.players).find(key => state.players[key]?.id === currentSocketId);
      if (mySymbol && state.players[mySymbol]?.score) {
        const { wins, losses, draws } = state.players[mySymbol].score;
        if (onScoreUpdate) onScoreUpdate(wins, losses, draws);
      }
    };

    const newSocket = io('/', { reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 });
    setSocket(newSocket);
    if (activeSocketRef) activeSocketRef.current = newSocket;

    newSocket.on('connect', () => {
      if (isMounted) logger.connection(newSocket.id);
    });

    newSocket.on('playerAssigned', (data) => {
      if (isMounted) {
        setPlayerSymbol(data.symbol);
        setGameId(data.game.gameId);
        setGameState(data.game);
        setPhase('waiting');
        setStatus('Waiting for another player to join...');
      }
    });

    newSocket.on('gameStart', (state) => {
      if (isMounted) {
        const mySymbol = Object.keys(state.players).find(key => state.players[key]?.id === newSocket.id);
        const oppSymbol = Object.keys(state.players).find(key => state.players[key]?.id !== newSocket.id);
        setPlayerSymbol(mySymbol);
        setOpponentName(state.players[oppSymbol]?.name || '');
        setGameState(state);
        setPhase('playing');
        updateStatus(state, mySymbol, state.players[oppSymbol]?.name);
        checkScoreUpdate(state, newSocket.id);
      }
    });

    newSocket.on('gameUpdate', (state) => {
      if (isMounted) {
        setDisconnectCountdown(null);
        setGameState(state);
        const mySymbol = Object.keys(state.players).find(key => state.players[key]?.id === newSocket.id);
        const oppSymbol = Object.keys(state.players).find(key => state.players[key]?.id !== newSocket.id);
        updateStatus(state, mySymbol, state.players[oppSymbol]?.name);
        checkScoreUpdate(state, newSocket.id);
      }
    });

    newSocket.on('gameEnd', (state) => {
      if (isMounted) {
        setPhase('finished');
        setGameState(state);
        const mySymbol = Object.keys(state.players).find(key => state.players[key]?.id === newSocket.id);
        const oppSymbol = Object.keys(state.players).find(key => state.players[key]?.id !== newSocket.id);
        updateStatus(state, mySymbol, state.players[oppSymbol]?.name);
        checkScoreUpdate(state, newSocket.id);
      }
    });

    newSocket.on('receiveMessage', (data) => {
      if (isMounted) {
        setChatMessages((prev) => [...prev.slice(-9), data]);
        setIsOpponentTyping(false);
      }
    });

    newSocket.on('opponentTyping', () => { if (isMounted) setIsOpponentTyping(true); });
    newSocket.on('opponentStoppedTyping', () => { if (isMounted) setIsOpponentTyping(false); });

    newSocket.on('opponentDisconnected', () => { if (isMounted) setDisconnectCountdown(30); });

    newSocket.on('opponentLeft', () => {
      if (isMounted) {
        setDisconnectCountdown(null);
        setPhase('ended');
        setStatus('Opponent disconnected!');
        if (onOpponentLeft) onOpponentLeft('disconnect');
      }
    });

    return () => {
      isMounted = false;
      newSocket.disconnect();
    };
  }, [gameType, onScoreUpdate, onOpponentLeft]);

  return { socket, phase, setPhase, gameState, playerSymbol, gameId, status, opponentName, chatMessages, setChatMessages, isOpponentTyping, disconnectCountdown, setDisconnectCountdown, getEmoji };
};
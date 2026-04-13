// logger.js - Universal logging utility for frontend and backend

class Logger {
  constructor() {
    // Detect environment
    this.isFrontend = typeof window !== 'undefined';
    this.isBackend = typeof process !== 'undefined' && process.versions && process.versions.node;

    // Set prefix based on environment
    this.prefix = this.isFrontend ? '[FRONT]' : '[BACK]';

    // Colors for different log levels (ANSI escape codes for backend)
    this.colors = {
      info: this.isFrontend ? '' : '\x1b[36m',    // Cyan
      success: this.isFrontend ? '' : '\x1b[32m',  // Green
      warn: this.isFrontend ? '' : '\x1b[33m',     // Yellow
      error: this.isFrontend ? '' : '\x1b[31m',    // Red
      reset: this.isFrontend ? '' : '\x1b[0m',     // Reset
    };
  }

  // Format timestamp
  getTimestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, -5);
  }

  // Format log message
  formatMessage(level, message, data = null) {
    const timestamp = this.getTimestamp();
    const color = this.colors[level] || '';
    const reset = this.colors.reset;

    let formatted = `${color}${this.prefix} ${timestamp} [${level.toUpperCase()}] ${message}${reset}`;

    if (data !== null) {
      if (this.isFrontend) {
        console.log(formatted, data);
      } else {
        formatted += ` ${JSON.stringify(data, null, 2)}`;
        console.log(formatted);
      }
    } else {
      console.log(formatted);
    }
  }

  // Info level logging
  info(message, data = null) {
    this.formatMessage('info', message, data);
  }

  // Success level logging
  success(message, data = null) {
    this.formatMessage('success', message, data);
  }

  // Warning level logging
  warn(message, data = null) {
    this.formatMessage('warn', message, data);
  }

  // Error level logging
  error(message, data = null) {
    this.formatMessage('error', message, data);
  }

  // Debug level logging (only in development)
  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development' || this.isFrontend) {
      this.formatMessage('debug', message, data);
    }
  }

  // Game-specific logging methods
  gameStart(gameId, players) {
    this.info(`🎮 Game ${gameId} started`, { players });
  }

  gameEnd(gameId, winner) {
    const message = winner === 'draw' ? `🤝 Game ${gameId} ended in draw` : `🏆 Game ${gameId} won by ${winner}`;
    this.success(message);
  }

  playerJoin(playerName, symbol, gameId) {
    this.info(`👤 Player joined: ${playerName} as ${symbol}`, { gameId });
  }

  playerMove(gameId, player, position) {
    const posStr = typeof position === 'object' ? JSON.stringify(position) : position;
    this.info(`🎯 Game ${gameId}: ${player} moved to position ${posStr}`);
  }

  playerDisconnect(playerName, gameId) {
    this.warn(`👋 Player disconnected: ${playerName}`, { gameId });
  }

  connection(socketId) {
    this.debug(`🔌 Socket connected: ${socketId}`);
  }

  disconnection(socketId) {
    this.debug(`🔌 Socket disconnected: ${socketId}`);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
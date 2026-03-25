const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const logger = require('./src/logger');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// server.js (handler for Lambda)
app.get('/', (req, res) => res.send('Tic Tac Toe! <div id="board"></div><script>/* your JS */</script>'));

exports.handler = async (event) => {
  // Lambda proxy integration
  const server = app.listen(0, () => {});
  // ... proxy logic or use serverless-express lib
  return { statusCode: 200, body: 'Tic Tac Toe live!' };
};

app.use(express.static(path.join(__dirname, 'build')));
app.use(express.json());
// ==================== AWS Lambda End ====================


// Initialize socket events
require('./src/socket')(io);

// ==================== HTTP ====================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.success(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} already in use`);
    process.exit(1);
  }
});

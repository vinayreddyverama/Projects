# Tic Tac Toe Multiplayer

A real-time multiplayer Tic Tac Toe game using React and Socket.IO.

## Features

- 2-player Tic Tac Toe game
- Real-time synchronization using Socket.IO
- Player name input
- Live game updates

## How to Run

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   node server.js
   ```

3. In a new terminal, start the React app:
   ```
   npm start
   ```

4. Open two browser tabs/windows to `http://localhost:3000`

5. In each tab, enter a player name when prompted.

6. Play the game! The moves will sync between both players.

## Game Rules

- Player 1 is X, Player 2 is O
- First to get 3 in a row (horizontally, vertically, or diagonally) wins
- If all 9 squares are filled without a winner, it's a draw

## Technologies Used

- React
- Socket.IO
- Express
- Node.js

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

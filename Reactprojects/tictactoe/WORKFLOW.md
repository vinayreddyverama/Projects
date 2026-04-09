# Game Hub Architecture & Workflow

This document maps out the architecture and component connections of the React Game Hub to make it easier to understand and maintain.

## 1. Project Component Structure

The application has been modularized and upgraded into a fully networked multiplayer hub:
- **`App.js`**: The **Game Hub Wrapper**. It manages the sidebar navigation, cross-game score tracking, global player names, background music, and the End & Summary dashboard (with Confetti!).
- **`TicTacToe.js`**: Contains the Socket.IO client logic and React UI for Tic Tac Toe (using 🔴 and 🔵 emojis).
- **`Connect4.js`**: Contains the Socket.IO client logic and React UI for Connect 4 (using 🍎 and 🥭 emojis).
- **`Sequence.js`**: Contains the Socket.IO client logic and React UI for Sequence 5-in-a-row (using 🦊 and 🐸 emojis).
- **`Game.js`, `Connect4Game.js`, & `SequenceGame.js` (Backend)**: The authoritative rule engines running on the Node.js server that validate all moves and determine winners.

## 2. Component Workflow Diagram

Below is a high-level mapping showing how the Front-End (React) interfaces with the Back-End (Node.js).

```mermaid
graph TD
    %% Frontend Components
    subgraph Frontend [React Application]
        App[App.js<br>Game Hub & State]
        TTT[TicTacToe.js<br>UI & Chat]
        C4[Connect4.js<br>UI & Chat]
        Seq[Sequence.js<br>UI & Chat]
        Summary[Summary Screen<br>Scores & Confetti]
        
        App -->|Active Tab: tictactoe| TTT
        App -->|Active Tab: connect4| C4
        App -->|Active Tab: sequence| Seq
        App -->|Active Tab: summary| Summary
    end

    %% Backend Server
    subgraph Backend [Node.js Server]
        Socket[socket.js<br>Socket.io Router]
        TTTEngine[Game.js<br>Tic Tac Toe Rules]
        C4Engine[Connect4Game.js<br>Connect 4 Rules]
        SeqEngine[SequenceGame.js<br>Sequence Rules]
        
        Socket <-->|Validates Moves| TTTEngine
        Socket <-->|Validates Moves| C4Engine
        Socket <-->|Validates Moves| SeqEngine
    end

    %% Connections
    TTT <-->|WebSockets| Socket
    C4 <-->|WebSockets| Socket
    Seq <-->|WebSockets| Socket
```

## 3. Multiplayer Matchmaking Sequence (Tic Tac Toe)

This specific sequence describes how Socket.IO passes payloads between two separate browser clients during the Tic Tac Toe loop.

```mermaid
sequenceDiagram
    participant P1 as Player 1 (Browser)
    participant S as Server (Node.js)
    participant P2 as Player 2 (Browser)

    P1->>S: connect & emit('playerJoin', "Alice")
    S-->>P1: emit('playerAssigned', assigned symbol X)
    
    P2->>S: connect & emit('playerJoin', "Bob")
    S-->>P2: emit('playerAssigned', assigned symbol O)
    S-->>P1: emit('gameStart', Opponent: Bob)
    S-->>P2: emit('gameStart', Opponent: Alice)
    
    P1->>S: emit('playerMove', index: 4)
    Note over S: Validates move in Game.js Rules Engine
    S-->>P1: emit('gameUpdate', New Board State)
    S-->>P2: emit('gameUpdate', New Board State)
```

## 4. State Management Principle
- **Connect 4** uses purely local state (`useState`) since it is a pass-and-play game located on the exact same screen instance.
- **Tic Tac Toe** pushes all UI moves to the Node.js server. The backend acts as the **single source of truth** so neither client can cheat!
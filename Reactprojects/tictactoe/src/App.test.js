import { render, screen } from '@testing-library/react';
import App from './App';

// Mock socket.io-client to prevent actual network requests during testing
jest.mock('socket.io-client', () => {
  return {
    io: () => ({
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    })
  };
});

test('renders Tic Tac Toe welcome screen', async () => {
  render(<App />);
  const linkElement = screen.getByText(/Tic Tac Toe/i);
  expect(linkElement).toBeInTheDocument();
  
  // Wait for the asynchronous socket connection to complete and update the UI
  // This prevents the "not wrapped in act(...)" React error
  const startButton = await screen.findByText(/Start Game/i);
  expect(startButton).toBeInTheDocument();
});

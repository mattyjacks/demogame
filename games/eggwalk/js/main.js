import { GameEngine } from './GameEngine.js';

// Boot the game when the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  const game = new GameEngine();
  game.init().catch(err => {
    console.error('Failed to initialize Egg Walk:', err);
  });
});

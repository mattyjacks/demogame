import { GameStates } from './GameEngine.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    
    // Screens
    this.menuScreen = document.getElementById('menu-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.victoryScreen = document.getElementById('victory-screen');
    
    // HUD Elements
    this.hud = document.getElementById('hud');
    this.distanceValue = document.getElementById('distance-value');
    this.progressBar = document.getElementById('progress-bar');
    this.speedValue = document.getElementById('speed-value');
    this.balanceIndicator = document.getElementById('balance-indicator');
    this.windWarning = document.getElementById('wind-warning');
    this.windArrow = document.getElementById('wind-arrow');

    // Buttons
    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.playAgainBtn = document.getElementById('play-again-btn');

    // Stats Labels on End Screens
    this.failDistance = document.getElementById('fail-distance');
    this.failWobbles = document.getElementById('fail-wobbles');
    this.winTime = document.getElementById('win-time');
    this.winStability = document.getElementById('win-stability');
  }

  init() {
    // Start game button click
    this.startBtn.addEventListener('click', () => {
      this.game.startGame();
    });

    // Try again button click
    this.restartBtn.addEventListener('click', () => {
      this.game.restartGame();
    });

    // Walk again button click
    this.playAgainBtn.addEventListener('click', () => {
      this.game.restartGame();
    });
  }

  showHUD(show) {
    if (show) {
      this.hud.classList.remove('hidden');
    } else {
      this.hud.classList.add('hidden');
    }
  }

  showScreen(state) {
    // Hide all screens first
    this.menuScreen.classList.add('hidden');
    this.menuScreen.classList.remove('active');
    this.gameoverScreen.classList.add('hidden');
    this.gameoverScreen.classList.remove('active');
    this.victoryScreen.classList.add('hidden');
    this.victoryScreen.classList.remove('active');

    // Show selected
    if (state === GameStates.MENU) {
      this.menuScreen.classList.remove('hidden');
      this.menuScreen.classList.add('active');
    } else if (state === GameStates.GAMEOVER) {
      this.gameoverScreen.classList.remove('hidden');
      this.gameoverScreen.classList.add('active');
    } else if (state === GameStates.VICTORY) {
      this.victoryScreen.classList.remove('hidden');
      this.victoryScreen.classList.add('active');
    }
  }

  showGameOverScreen(distance, wobbles) {
    this.failDistance.textContent = `${distance}m`;
    this.failWobbles.textContent = wobbles;
    this.showScreen(GameStates.GAMEOVER);
  }

  showVictoryScreen(time, stability) {
    this.winTime.textContent = `${Math.round(time)}s`;
    this.winStability.textContent = `${stability}%`;
    this.showScreen(GameStates.VICTORY);

    // Call Canvas-Confetti if loaded to make it extra premium
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    } else {
      // Lazy load confetti if not already available
      import('https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/+esm')
        .then((module) => {
          module.default({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        })
        .catch(err => console.log('Confetti load error:', err));
    }
  }

  updateHUD(distance, totalDistance, speedKmh, eggOffset, spoonTilt) {
    // 1. Update Distance
    const percent = Math.min(100, (distance / totalDistance) * 100);
    this.distanceValue.textContent = `${distance}m / ${totalDistance}m`;
    this.progressBar.style.width = `${percent}%`;

    // 2. Update Speed (Formatted to 1 decimal place)
    this.speedValue.textContent = `${speedKmh.toFixed(1)} km/h`;

    // 3. Update Balance Indicator Bubble
    // eggOffset runs from about -0.38 to +0.38 (radius of spoon)
    // Scale it to move inside the 70px diameter HUD meter (range of -30px to +30px translation)
    // We multiply offset by 70 or 80 to scale it visually
    const scaleFactor = 75; // translates offset units directly to pixel offset
    const px = eggOffset.x * scaleFactor;
    // Note: Y offset in physics maps to forward/backward (Z in scene), we map to vertical Y in HUD
    const py = -eggOffset.y * scaleFactor; // invert to match screen coordinates

    this.balanceIndicator.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
  }

  showWindWarning(show, windDirection) {
    if (show) {
      this.windWarning.classList.remove('hidden');
      
      // Point the arrow in the direction the wind is blowing
      // If windDirection > 0 (blowing left-to-right), rotate arrow to 0 deg (pointing right)
      // If windDirection < 0 (blowing right-to-left), rotate arrow to 180 deg (pointing left)
      if (windDirection > 0) {
        this.windArrow.style.transform = 'rotate(0deg)';
      } else {
        this.windArrow.style.transform = 'rotate(180deg)';
      }
    } else {
      this.windWarning.classList.add('hidden');
    }
  }
}

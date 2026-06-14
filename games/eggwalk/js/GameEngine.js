import { SceneManager } from './SceneManager.js';
import { PlayerController } from './PlayerController.js';
import { PhysicsEngine } from './PhysicsEngine.js';
import { SpoonComponent } from './SpoonComponent.js';
import { EggComponent } from './EggComponent.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { ObstacleManager } from './ObstacleManager.js';
import { UIManager } from './UIManager.js';
import { SoundManager } from './SoundManager.js';

export const GameStates = {
  MENU: 'menu',
  PLAYING: 'playing',
  FALLING: 'falling',
  GAMEOVER: 'gameover',
  VICTORY: 'victory'
};

export class GameEngine {
  constructor() {
    this.state = GameStates.MENU;
    
    // Components
    this.sceneManager = new SceneManager(this);
    this.playerController = new PlayerController(this);
    this.physicsEngine = new PhysicsEngine(this);
    this.spoon = new SpoonComponent(this);
    this.egg = new EggComponent(this);
    this.environment = new EnvironmentManager(this);
    this.obstacles = new ObstacleManager(this);
    this.ui = new UIManager(this);
    this.sound = new SoundManager(this);

    // Stats
    this.distanceWalked = 0;
    this.totalDistance = 100; // Finish line distance in meters
    this.elapsedTime = 0;
    this.wobblesCount = 0;
    this.totalStabilitySum = 0;
    this.stabilitySamples = 0;
    
    // Time tracking
    this.clock = null;
    this.lastTime = 0;
  }

  async init() {
    // 1. Init Sound (Web Audio)
    this.sound.init();

    // 2. Init UI listeners
    this.ui.init();

    // 3. Init Three.js Scene, Camera, Lights
    this.sceneManager.init();

    // 4. Init Objects in Scene
    this.environment.init(this.sceneManager.scene);
    this.spoon.init(this.sceneManager.scene, this.sceneManager.camera);
    this.egg.init(this.sceneManager.scene);
    this.obstacles.init(this.sceneManager.scene);

    // 5. Init Input listeners
    this.playerController.init();

    // Reset stats
    this.resetStats();

    // Start loop
    this.clock = new Date();
    this.lastTime = performance.now();
    this.animate();
  }

  resetStats() {
    this.distanceWalked = 0;
    this.elapsedTime = 0;
    this.wobblesCount = 0;
    this.totalStabilitySum = 0;
    this.stabilitySamples = 0;
    
    this.physicsEngine.reset();
    this.egg.reset();
    this.spoon.reset();
    this.playerController.reset();
    this.obstacles.reset();
    this.environment.reset();
    
    this.ui.updateHUD(0, this.totalDistance, 0, { x: 0, y: 0 }, 0);
  }

  startGame() {
    this.resetStats();
    this.state = GameStates.PLAYING;
    this.ui.showHUD(true);
    this.ui.showScreen(GameStates.PLAYING);
    this.sound.playWindAmbience(true);
    this.sound.playClick();
  }

  restartGame() {
    this.startGame();
  }

  triggerVictory() {
    this.state = GameStates.VICTORY;
    this.ui.showHUD(false);
    
    const avgStability = this.stabilitySamples > 0 
      ? Math.round((this.totalStabilitySum / this.stabilitySamples) * 100) 
      : 100;
    
    this.ui.showVictoryScreen(this.elapsedTime, avgStability);
    this.sound.playVictory();
    this.sound.playWindAmbience(false);
  }

  triggerEggFall() {
    if (this.state !== GameStates.PLAYING) return;
    this.state = GameStates.FALLING;
    this.wobblesCount++;
    this.egg.breakEgg();
    this.sound.playCrack();
    this.sound.playWindAmbience(false);
    
    // Give a short delay showing the broken egg before displaying gameover
    setTimeout(() => {
      this.state = GameStates.GAMEOVER;
      this.ui.showHUD(false);
      this.ui.showGameOverScreen(this.distanceWalked, this.wobblesCount);
    }, 2000);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap dt at 100ms
    this.lastTime = now;

    this.update(dt);
  }

  update(dt) {
    if (this.state === GameStates.PLAYING) {
      this.elapsedTime += dt;

      // Handle Inputs & Movement
      this.playerController.update(dt);
      
      // Update Environment and obstacles
      this.environment.update(dt, this.playerController.position.z);
      this.obstacles.update(dt, this.playerController.position.z);

      // Check for obstacles forces (e.g. Wind Gusts)
      const currentWind = this.obstacles.getCurrentWindForce(this.playerController.position.z);
      if (Math.abs(currentWind.x) > 0.01) {
        this.ui.showWindWarning(true, currentWind.x);
      } else {
        this.ui.showWindWarning(false, 0);
      }

      // Physics Simulation
      this.physicsEngine.update(dt, currentWind);

      // Wobble count
      const offset = this.physicsEngine.getEggOffset();
      const distFromCenter = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
      if (distFromCenter > 0.25) {
        this.totalStabilitySum += Math.max(0, 1 - (distFromCenter - 0.25) * 2);
      } else {
        this.totalStabilitySum += 1.0;
      }
      this.stabilitySamples++;

      // Egg slide volume
      if (distFromCenter > 0.1) {
        this.sound.setSlideIntensity(Math.min(1.0, (distFromCenter - 0.1) * 3));
      } else {
        this.sound.setSlideIntensity(0);
      }

      // Update spoon and egg components in 3D scene
      this.spoon.update(dt);
      this.egg.update(dt);

      // Update stats
      // Z distance walked (movement along the pathway)
      this.distanceWalked = Math.max(0, Math.floor(-this.playerController.position.z));
      const speedKmh = Math.abs(this.playerController.speed * 3.6);
      
      // Check if fell off
      if (this.physicsEngine.hasFallenOff) {
        this.triggerEggFall();
      }

      // Check victory
      if (this.distanceWalked >= this.totalDistance) {
        this.triggerVictory();
      }

      // Update UI
      this.ui.updateHUD(
        this.distanceWalked, 
        this.totalDistance, 
        speedKmh, 
        offset, 
        this.physicsEngine.spoonTilt
      );
    } else if (this.state === GameStates.FALLING) {
      // Just simulate egg falling and physics
      this.physicsEngine.updateFalling(dt);
      this.egg.update(dt);
      this.spoon.update(dt);
    } else {
      // MENU, GAMEOVER, VICTORY states: idle animations in scene
      this.environment.update(dt, 0);
      this.spoon.updateIdle(dt);
      this.egg.updateIdle(dt);
    }

    // Render scene
    this.sceneManager.render();
  }
}

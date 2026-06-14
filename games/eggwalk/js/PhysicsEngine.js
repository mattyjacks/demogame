import * as THREE from 'three';

export class PhysicsEngine {
  constructor(game) {
    this.game = game;
    
    // Egg position relative to spoon center (2D coordinate system)
    this.eggOffset = new THREE.Vector2(0, 0);
    this.eggVelocity = new THREE.Vector2(0, 0);
    
    // Physical Constants
    this.spoonRadius = 0.38; // Radius of spoon cup
    this.gravity = 9.81; // m/s^2
    this.friction = 3.5; // sliding friction factor
    this.bowlRestoringForce = 3.2; // keeps egg centered in the concave cup
    
    // Inertial forces
    this.lastPlayerSpeed = 0;
    this.lastPlayerX = 0;

    // Spoon actual tilts (smoothed)
    this.spoonTilt = new THREE.Vector2(0, 0);
    
    // State flags
    this.hasFallenOff = false;
    
    // 3D falling physics parameters (used once egg falls off)
    this.egg3DPosition = new THREE.Vector3();
    this.egg3DVelocity = new THREE.Vector3();
    this.egg3DRotation = new THREE.Euler();
    this.egg3DRotVelocity = new THREE.Vector3();
  }

  reset() {
    this.eggOffset.set(0, 0);
    this.eggVelocity.set(0, 0);
    this.spoonTilt.set(0, 0);
    this.hasFallenOff = false;
    this.lastPlayerSpeed = 0;
    this.lastPlayerX = this.game.playerController.position.x;
  }

  getEggOffset() {
    return this.eggOffset;
  }

  update(dt, windForce) {
    const player = this.game.playerController;

    // 1. Calculate accelerations of the player
    // Forward/backward acceleration
    const forwardAcc = (player.speed - this.lastPlayerSpeed) / dt;
    this.lastPlayerSpeed = player.speed;

    // Lateral steering acceleration
    const playerDeltaX = player.position.x - this.lastPlayerX;
    this.lastPlayerX = player.position.x;
    const lateralVel = playerDeltaX / dt;
    // rough lateral acceleration
    const lateralAcc = lateralVel * 0.8;

    // Bumpy terrain multiplier (influences wobbles randomly based on terrain difficulty)
    const terrainFactor = this.game.environment.getTerrainBumpiness(player.position.z);
    let bumpX = 0;
    let bumpY = 0;
    if (terrainFactor > 0.01 && Math.abs(player.speed) > 0.1) {
      // Simulate random bumps on the pathway
      bumpX = (Math.random() * 2 - 1) * terrainFactor * 4.5;
      bumpY = (Math.random() * 2 - 1) * terrainFactor * 4.5;
    }

    // 2. Compute the current spoon tilt
    // Combination of mouse controls, player acceleration, steering, and terrain bumps
    const targetTiltX = player.mouseCurrent.x + (lateralAcc * 0.08) + (bumpX * 0.02);
    const targetTiltY = player.mouseCurrent.y - (forwardAcc * 0.08) + (bumpY * 0.02);
    
    // Damp/smooth actual spoon tilt
    this.spoonTilt.x = THREE.MathUtils.lerp(this.spoonTilt.x, targetTiltX, 15 * dt);
    this.spoonTilt.y = THREE.MathUtils.lerp(this.spoonTilt.y, targetTiltY, 15 * dt);

    // 3. Compute Egg Accelerations inside Spoon (relative coordinate system)
    const eggAcc = new THREE.Vector2(0, 0);

    // Gravity force component pull from tilting the spoon (ax = g * sin(theta))
    // We add wind force pushing the egg (scaled down)
    const totalTiltX = this.spoonTilt.x + (windForce.x * 0.28);
    const totalTiltY = this.spoonTilt.y + (windForce.y * 0.28);

    eggAcc.x = this.gravity * Math.sin(totalTiltX);
    eggAcc.y = this.gravity * Math.sin(totalTiltY);

    // Inertial forces (egg slides back when player moves forward, slides right when turning left)
    eggAcc.x += -lateralAcc * 0.95;
    eggAcc.y += forwardAcc * 0.95;

    // Restoring force towards center due to the concave bowl shape of the spoon
    // The force is proportional to distance, mimicking a sphere in a spherical bowl
    eggAcc.x += -this.eggOffset.x * this.bowlRestoringForce;
    eggAcc.y += -this.eggOffset.y * this.bowlRestoringForce;

    // Apply friction/damping
    eggAcc.x += -this.eggVelocity.x * this.friction;
    eggAcc.y += -this.eggVelocity.y * this.friction;

    // 4. Update Velocity and Offset
    this.eggVelocity.x += eggAcc.x * dt;
    this.eggVelocity.y += eggAcc.y * dt;

    this.eggOffset.x += this.eggVelocity.x * dt;
    this.eggOffset.y += this.eggVelocity.y * dt;

    // 5. Check if egg rolled off the spoon cup radius
    const distanceSquared = this.eggOffset.x * this.eggOffset.x + this.eggOffset.y * this.eggOffset.y;
    if (distanceSquared > this.spoonRadius * this.spoonRadius) {
      this.hasFallenOff = true;
      this.initiate3DFall();
    }
  }

  initiate3DFall() {
    // Convert 2D relative offset to 3D world space coordinates
    // Get absolute spoon position in 3D scene
    const spoonObj = this.game.spoon.group;
    const eggObj = this.game.egg.mesh;
    
    // Capture position in world coordinates
    const worldPos = new THREE.Vector3();
    eggObj.getWorldPosition(worldPos);

    this.egg3DPosition.copy(worldPos);

    // Initial velocity comes from walking speed and slide velocity
    const pSpeed = this.game.playerController.speed;
    this.egg3DVelocity.set(
      this.eggVelocity.x * 2.0, 
      0.8, // small bounce upwards as it slips off
      -pSpeed + (this.eggVelocity.y * 2.0)
    );

    // Give it a random rotation spin as it falls
    this.egg3DRotVelocity.set(
      Math.random() * 8 - 4,
      Math.random() * 8 - 4,
      Math.random() * 8 - 4
    );

    this.egg3DRotation.copy(eggObj.rotation);
  }

  updateFalling(dt) {
    // Simulate falling under gravity in 3D space
    this.egg3DVelocity.y -= this.gravity * dt;
    
    this.egg3DPosition.addScaledVector(this.egg3DVelocity, dt);
    
    // Rotate egg
    this.egg3DRotation.x += this.egg3DRotVelocity.x * dt;
    this.egg3DRotation.y += this.egg3DRotVelocity.y * dt;
    this.egg3DRotation.z += this.egg3DRotVelocity.z * dt;

    // Cap at ground height (y = 0)
    const groundLevel = 0.05;
    if (this.egg3DPosition.y <= groundLevel) {
      this.egg3DPosition.y = groundLevel;
      this.egg3DVelocity.set(0, 0, 0);
      this.egg3DRotVelocity.set(0, 0, 0);
    }
  }
}

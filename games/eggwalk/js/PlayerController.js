import * as THREE from 'three';

export class PlayerController {
  constructor(game) {
    this.game = game;
    
    // Player movement
    this.position = new THREE.Vector3(0, 0, 0); // start at z = 0
    this.speed = 0;
    this.targetSpeed = 0;
    this.walkDirection = new THREE.Vector3(0, 0, -1);
    
    // Movement configuration
    this.maxSpeed = 3.5; // meters per second
    this.acceleration = 4.0;
    this.deceleration = 6.0;
    
    // Key states
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false
    };

    // Spoon tilt controls (mouse target coordinates)
    this.mouseTarget = new THREE.Vector2(0, 0);
    this.mouseCurrent = new THREE.Vector2(0, 0);
    this.tiltSensitivity = 0.8;
    this.tiltSmoothing = 12.0; // lerp speed

    // Camera bobbing parameters
    this.bobTime = 0;
    this.bobFrequency = 10.0;
    this.bobAmplitude = 0.05;
  }

  init() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Mouse movement inside screen
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Touch screen dragging support
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
  }

  reset() {
    this.position.set(0, 0, 0);
    this.speed = 0;
    this.targetSpeed = 0;
    this.mouseTarget.set(0, 0);
    this.mouseCurrent.set(0, 0);
    this.bobTime = 0;
    
    for (const key in this.keys) {
      this.keys[key] = false;
    }
  }

  onKeyDown(e) {
    if (e.key in this.keys) {
      this.keys[e.key] = true;
    }
  }

  onKeyUp(e) {
    if (e.key in this.keys) {
      this.keys[e.key] = false;
    }
  }

  onMouseMove(e) {
    if (this.game.state !== 'playing') return;
    
    // Normalize mouse screen position to range [-1, 1]
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1; // invert Y

    // Clamp values
    this.mouseTarget.x = THREE.MathUtils.clamp(x * this.tiltSensitivity, -0.6, 0.6);
    this.mouseTarget.y = THREE.MathUtils.clamp(y * this.tiltSensitivity, -0.6, 0.6);
  }

  onTouchStart(e) {
    if (this.game.state !== 'playing') return;
    this.updateTouchTarget(e.touches[0]);
  }

  onTouchMove(e) {
    if (this.game.state !== 'playing') return;
    e.preventDefault(); // prevent default scrolling
    this.updateTouchTarget(e.touches[0]);
  }

  updateTouchTarget(touch) {
    const x = (touch.clientX / window.innerWidth) * 2 - 1;
    const y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    this.mouseTarget.x = THREE.MathUtils.clamp(x * this.tiltSensitivity * 1.2, -0.7, 0.7);
    this.mouseTarget.y = THREE.MathUtils.clamp(y * this.tiltSensitivity * 1.2, -0.7, 0.7);
  }

  update(dt) {
    // 1. Calculate desired forward/backward speed
    const isMovingForward = this.keys.w || this.keys.ArrowUp;
    const isMovingBackward = this.keys.s || this.keys.ArrowDown;
    const isSteeringLeft = this.keys.a || this.keys.ArrowLeft;
    const isSteeringRight = this.keys.d || this.keys.ArrowRight;

    if (isMovingForward) {
      this.targetSpeed = this.maxSpeed;
    } else if (isMovingBackward) {
      this.targetSpeed = -this.maxSpeed * 0.5;
    } else {
      this.targetSpeed = 0;
    }

    // Smooth speed change
    if (this.speed < this.targetSpeed) {
      this.speed = Math.min(this.targetSpeed, this.speed + this.acceleration * dt);
    } else if (this.speed > this.targetSpeed) {
      this.speed = Math.max(this.targetSpeed, this.speed - this.deceleration * dt);
    }

    // 2. Perform sideways steering
    let steerForce = 0;
    if (isSteeringLeft) steerForce = -1.8;
    if (isSteeringRight) steerForce = 1.8;

    // Apply forward and sideways speed to position
    this.position.z += this.walkDirection.z * this.speed * dt;
    this.position.x += steerForce * dt;

    // Keep player on the pathway borders (environment width constraint)
    const currentRoadWidth = this.game.environment.getRoadWidthAtZ(this.position.z);
    this.position.x = THREE.MathUtils.clamp(this.position.x, -currentRoadWidth + 0.3, currentRoadWidth - 0.3);

    // 3. Smoothly interpolate mouse tilt values
    this.mouseCurrent.lerp(this.mouseTarget, this.tiltSmoothing * dt);

    // 4. Update camera position and camera bobbing
    const camera = this.game.sceneManager.camera;
    
    // Head bobbing based on walking speed
    let bobY = 0;
    let bobX = 0;
    if (Math.abs(this.speed) > 0.1) {
      this.bobTime += dt * this.bobFrequency * (Math.abs(this.speed) / this.maxSpeed);
      bobY = Math.sin(this.bobTime) * this.bobAmplitude;
      bobX = Math.cos(this.bobTime * 0.5) * this.bobAmplitude * 0.5;
      
      // Update footsteps audio
      this.game.sound.updateFootsteps(dt, Math.abs(this.speed));
    }

    // Anchor camera behind player's X position
    const targetCamX = this.position.x * 0.7; // slight lag behind player x position
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX + bobX, 6 * dt);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 2.5 + bobY, 6 * dt);
    camera.position.z = this.position.z + 3.2;

    // Camera look target with slight offset
    const lookTarget = new THREE.Vector3(this.position.x * 0.5, 1.2, this.position.z - 1.5);
    camera.lookAt(lookTarget);
  }
}

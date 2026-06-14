import * as THREE from 'three';

export class SpoonComponent {
  constructor(game) {
    this.game = game;
    this.group = null; // Container for the spoon
    
    // Materials
    this.spoonMaterial = null;
  }

  init(scene, camera) {
    // 1. Create a group to handle positioning and tilting
    this.group = new THREE.Group();

    // 2. Define Spoon Material: Shiny Chrome/Silver Metal
    this.spoonMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.95,
      roughness: 0.08,
      envMapIntensity: 1.0,
      flatShading: false
    });

    // 3. Create the Spoon Cup (The bowl where the egg sits)
    // We can create a sphere geometry, clip it in half, and scale it
    const cupGeom = new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const cupMesh = new THREE.Mesh(cupGeom, this.spoonMaterial);
    
    // Rotate cup to face upwards and scale it to look like a shallow spoon bowl
    cupMesh.rotation.x = -Math.PI / 2; // face upwards
    cupMesh.scale.set(1.0, 1.25, 0.48); // oval and shallow
    cupMesh.castShadow = true;
    cupMesh.receiveShadow = true;
    this.group.add(cupMesh);

    // 4. Create the Spoon Handle
    // Extruded rectangle or simple cylinders
    const handleGeom = new THREE.BoxGeometry(0.06, 0.015, 1.5);
    // Offset handle so it starts at the cup border and extends backwards
    handleGeom.translate(0, -0.015, 0.8);
    
    const handleMesh = new THREE.Mesh(handleGeom, this.spoonMaterial);
    handleMesh.castShadow = true;
    handleMesh.receiveShadow = true;
    this.group.add(handleMesh);

    // Position the whole spoon relative to the player/camera view
    // Since it's in world coordinates, we place it in front of the camera
    this.scene = scene;
    this.scene.add(this.group);
  }

  reset() {
    this.group.position.set(0, 1.1, -1.0);
    this.group.rotation.set(0, 0, 0);
  }

  update(dt) {
    const player = this.game.playerController;
    const physics = this.game.physicsEngine;

    // The spoon follows the player's 3D position but is offset in front
    // We position it so it looks like it's held in the first-person hand
    const targetX = player.position.x;
    const targetY = 1.15 + (Math.sin(player.bobTime * 2.0) * 0.02 * (player.speed / player.maxSpeed));
    const targetZ = player.position.z - 1.0; // in front of player

    this.group.position.set(targetX, targetY, targetZ);

    // Tilt the spoon according to the physics engine spoonTilt values
    // Z rotation controls lateral tilting, X rotation controls forward/backward tilting
    this.group.rotation.x = physics.spoonTilt.y; // pitch
    this.group.rotation.z = -physics.spoonTilt.x; // roll
    this.group.rotation.y = -physics.spoonTilt.x * 0.4; // yaw slightly into the tilt
  }

  updateIdle(dt) {
    // Soft hovering animation in main menu
    const time = performance.now() * 0.001;
    this.group.position.x = Math.sin(time * 1.5) * 0.1;
    this.group.position.y = 1.15 + Math.cos(time * 2.0) * 0.05;
    this.group.position.z = -1.0;
    
    this.group.rotation.x = Math.sin(time * 0.8) * 0.05;
    this.group.rotation.z = Math.cos(time * 1.1) * 0.05;
    this.group.rotation.y = 0;
  }
}

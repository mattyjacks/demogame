import * as THREE from 'three';

export class ObstacleManager {
  constructor(game) {
    this.game = game;
    this.scene = null;
    this.obstaclesGroup = null;
    
    // List of active wind generators in the scene
    // We store wind zone positions, directions, intensities, and mesh parts to animate
    this.windZones = [
      {
        startZ: -32,
        endZ: -48,
        direction: 1, // 1 = blowing left-to-right (positive X), -1 = right-to-left
        baseIntensity: 1.8,
        active: true,
        fans: []
      },
      {
        startZ: -72,
        endZ: -88,
        direction: -1, // blowing right-to-left
        baseIntensity: 2.6,
        active: true,
        fans: []
      }
    ];

    // Fan rotation speed accumulator
    this.fanAngle = 0;
  }

  init(scene) {
    this.scene = scene;
    this.obstaclesGroup = new THREE.Group();
    this.scene.add(this.obstaclesGroup);

    // Build visual representations for the wind zones (Giant Fans)
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x457b9d, metalness: 0.8, roughness: 0.3 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe63946, metalness: 0.9, roughness: 0.1 });
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1d3557 });

    this.windZones.forEach((zone) => {
      // Put a fan on the side of the path every 6 meters in the wind zone
      const length = Math.abs(zone.startZ - zone.endZ);
      const fanSpacing = 6;
      const fanCount = Math.floor(length / fanSpacing) + 1;

      for (let i = 0; i < fanCount; i++) {
        const zPos = zone.startZ - (i * fanSpacing);
        const roadWidth = this.game.environment.getRoadWidthAtZ(zPos);
        
        // Position fan on the side it blows FROM
        // If direction is 1, blows left-to-right, so fan is on the LEFT (-X)
        // If direction is -1, blows right-to-left, so fan is on the RIGHT (+X)
        const fanX = zone.direction === 1 ? -(roadWidth + 1.2) : (roadWidth + 1.2);
        
        const fanGroup = new THREE.Group();
        fanGroup.position.set(fanX, 0, zPos);
        
        // Face the fan towards the road
        // Blows left-to-right: face direction is right (+X), rotation angle = -Math.PI/2
        // Blows right-to-left: face direction is left (-X), rotation angle = Math.PI/2
        fanGroup.rotation.y = zone.direction === 1 ? -Math.PI / 2 : Math.PI / 2;

        // 1. Build Stand
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.8, 8), standMat);
        stand.position.y = 0.9;
        stand.castShadow = true;
        fanGroup.add(stand);

        // 2. Build Fan Housing (Cylinder)
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12), fanMat);
        housing.rotation.x = Math.PI / 2;
        housing.position.y = 1.8;
        housing.castShadow = true;
        fanGroup.add(housing);

        // 3. Build Blades Center Hub
        const bladeHub = new THREE.Group();
        bladeHub.position.set(0, 1.8, 0.2); // front of housing
        
        const hubCenter = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), standMat);
        bladeHub.add(hubCenter);

        // 4. Build Blades
        const bladeGeom = new THREE.BoxGeometry(0.08, 0.8, 0.015);
        bladeGeom.translate(0, 0.4, 0); // origin at base of blade

        const blade1 = new THREE.Mesh(bladeGeom, bladeMat);
        bladeHub.add(blade1);

        const blade2 = blade1.clone();
        blade2.rotation.z = (Math.PI * 2) / 3;
        bladeHub.add(blade2);

        const blade3 = blade1.clone();
        blade3.rotation.z = (Math.PI * 4) / 3;
        bladeHub.add(blade3);

        fanGroup.add(bladeHub);

        // Add to scene and save reference to animate rotation
        this.obstaclesGroup.add(fanGroup);
        zone.fans.push(bladeHub);

        // Spawn a wind sock ribbon on the OPPOSITE side to show wind direction
        const sockX = zone.direction === 1 ? (roadWidth + 0.3) : -(roadWidth + 0.3);
        this.createWindSock(sockX, zPos, zone.direction);
      }
    });
  }

  createWindSock(x, z, direction) {
    const sockGroup = new THREE.Group();
    sockGroup.position.set(x, 0, z);

    // Pole
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), poleMat);
    pole.position.y = 0.75;
    sockGroup.add(pole);

    // Sock cloth (cone)
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xff4d6d, roughness: 0.8 });
    const clothGeom = new THREE.ConeGeometry(0.12, 0.5, 8);
    // Offset center of gravity so it rotates about the tip/base
    clothGeom.translate(0, -0.25, 0);
    const cloth = new THREE.Mesh(clothGeom, clothMat);
    
    // Position at top of pole, pointing horizontal
    cloth.position.set(0, 1.45, 0);
    cloth.rotation.z = -Math.PI / 2; // point outwards
    cloth.rotation.y = direction === 1 ? 0 : Math.PI; // point with wind direction

    sockGroup.add(cloth);
    this.obstaclesGroup.add(sockGroup);

    // Save cloth reference to wobble it slightly in update
    this.sceneryWobbles = this.sceneryWobbles || [];
    this.sceneryWobbles.push({
      mesh: cloth,
      baseRotZ: -Math.PI / 2,
      baseRotY: direction === 1 ? 0 : Math.PI,
      dir: direction
    });
  }

  reset() {
    this.fanAngle = 0;
  }

  getCurrentWindForce(playerZ) {
    // Determine if player is inside any wind zone
    const force = new THREE.Vector2(0, 0);
    const time = performance.now() * 0.0015;

    for (const zone of this.windZones) {
      // Check if player Z is inside the wind zone borders
      if (playerZ <= zone.startZ && playerZ >= zone.endZ) {
        // Compute variable wind force using Sine waves (creates gusts!)
        // Wind gusts peak and valley, making balancing interesting
        const gustFactor = 0.5 + 0.5 * Math.sin(time * 3.5); // ranges 0 to 1
        force.x = zone.direction * zone.baseIntensity * gustFactor;
        
        // Add tiny turbulence vertical wobble
        force.y = (Math.random() * 2 - 1) * 0.15;
        break; // active wind zone matches
      }
    }

    return force;
  }

  update(dt, playerZ) {
    // 1. Rotate the fan blades
    this.fanAngle += 12 * dt; // speed of fans
    
    this.windZones.forEach((zone) => {
      const isPlayerInside = playerZ <= zone.startZ && playerZ >= zone.endZ;
      const rotateSpeed = isPlayerInside ? 16 * dt : 3 * dt; // spin faster if player is inside
      
      zone.fans.forEach((bladeHub) => {
        bladeHub.rotation.z += rotateSpeed;
      });
    });

    // 2. Wobble wind socks cloths
    const time = performance.now() * 0.001;
    if (this.sceneryWobbles) {
      this.sceneryWobbles.forEach((sock) => {
        // Sock tilts down if wind is low, horizontal if wind is high
        const windIntensity = Math.abs(this.getCurrentWindForce(sock.mesh.parent.position.z).x);
        const targetTilt = -Math.PI / 2 + (windIntensity * 0.15) + Math.sin(time * 8) * 0.06;
        
        sock.mesh.rotation.z = THREE.MathUtils.lerp(sock.mesh.rotation.z, targetTilt, 5 * dt);
      });
    }
  }
}

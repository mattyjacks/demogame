import * as THREE from 'three';

export class EggComponent {
  constructor(game) {
    this.game = game;
    this.mesh = null;
    
    // Yolk and Shell shards for the splatter effect
    this.splatterGroup = null;
    this.shards = [];
    this.splattered = false;
    
    // Materials
    this.eggMaterial = null;
    this.yolkMaterial = null;
    this.whiteMaterial = null;
  }

  init(scene) {
    this.scene = scene;
    
    // 1. Create Egg Material (Glossy, creamy organic shell)
    this.eggMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff9e6, // creamy white
      roughness: 0.25,
      metalness: 0.0,
      bumpScale: 0.05
    });

    // Splatter Materials
    this.yolkMaterial = new THREE.MeshBasicMaterial({ color: 0xffb703 }); // vibrant yellow
    this.whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xfdf0d5, transparent: true, opacity: 0.95 });

    // 2. Generate Egg Geometry (Pinch the top of a sphere to make an egg)
    const sphereGeom = new THREE.SphereGeometry(0.25, 32, 32);
    
    // Deform the vertices to make an egg shape
    const positionAttribute = sphereGeom.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
      let x = positionAttribute.getX(i);
      let y = positionAttribute.getY(i);
      let z = positionAttribute.getZ(i);

      // Scale X & Z based on Y position (pinch the top)
      // Standard egg shape: top (y > 0) is narrower, bottom (y < 0) is wider
      const factor = 1.0 - (y * 0.25);
      x *= factor;
      z *= factor;

      // Stretch vertically a little
      y *= 1.2;

      positionAttribute.setXYZ(i, x, y, z);
    }
    // Recompute normals for lighting
    sphereGeom.computeVertexNormals();

    this.mesh = new THREE.Mesh(sphereGeom, this.eggMaterial);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    // 3. Prepare Splatter Group (hidden initially)
    this.splatterGroup = new THREE.Group();
    this.scene.add(this.splatterGroup);
  }

  reset() {
    this.mesh.visible = true;
    this.mesh.position.set(0, 1.35, -1.0);
    this.mesh.rotation.set(0, 0, 0);
    
    // Clean up splatters
    while (this.splatterGroup.children.length > 0) {
      const child = this.splatterGroup.children[0];
      this.splatterGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }
    this.shards = [];
    this.splattered = false;
  }

  update(dt) {
    const physics = this.game.physicsEngine;
    const spoon = this.game.spoon;

    if (this.game.state === 'playing') {
      // 1. Position egg relative to the spoon group
      // Spoon is at spoon.group.position.
      // Offset physics.eggOffset gives relative position in spoon space
      
      // Calculate 3D position by shifting along spoon axes
      const localOffset = new THREE.Vector3(
        physics.eggOffset.x,
        0.18 + (physics.spoonRadius * 0.12) - (Math.max(0, physics.eggOffset.length()) * 0.15), // sit lower when sliding out
        physics.eggOffset.y
      );

      // Rotate local offset with spoon tilt
      localOffset.applyEuler(spoon.group.rotation);
      
      // Add spoon world position to place the egg correctly
      this.mesh.position.copy(spoon.group.position).add(localOffset);

      // 2. Rotate the egg as it rolls
      // Simulating rolling: rotation angle is proportional to movement offset
      this.mesh.rotation.z = -physics.eggOffset.x * 4.0;
      this.mesh.rotation.x = physics.eggOffset.y * 4.0;
      this.mesh.rotation.y = (physics.eggOffset.x - physics.eggOffset.y) * 2.0;

    } else if (this.game.state === 'falling') {
      // Use falling 3D physics from engine
      this.mesh.position.copy(physics.egg3DPosition);
      this.mesh.rotation.copy(physics.egg3DRotation);

      // Check ground collision to spawn splatter
      if (physics.egg3DPosition.y <= 0.055 && !this.splattered) {
        this.triggerSplatter();
      }
    }

    // Update shards motion if any
    if (this.shards.length > 0) {
      for (const shard of this.shards) {
        shard.velocity.y -= 9.8 * dt; // gravity
        shard.mesh.position.addScaledVector(shard.velocity, dt);
        shard.mesh.rotation.x += shard.rotVelocity.x * dt;
        shard.mesh.rotation.y += shard.rotVelocity.y * dt;
        
        // bounce on ground
        if (shard.mesh.position.y <= 0.02) {
          shard.mesh.position.y = 0.02;
          shard.velocity.y *= -0.3; // bounce absorption
          shard.velocity.x *= 0.5;
          shard.velocity.z *= 0.5;
        }
      }
    }
  }

  updateIdle(dt) {
    // Egg follows spoon idle motion in menu screen
    const spoon = this.game.spoon;
    this.mesh.position.copy(spoon.group.position).add(new THREE.Vector3(0, 0.20, 0));
    this.mesh.rotation.set(0, 0, 0);
  }

  breakEgg() {
    // Switch mesh to falling state
  }

  triggerSplatter() {
    this.splattered = true;
    this.mesh.visible = false; // Hide the whole egg

    const px = this.mesh.position.x;
    const pz = this.mesh.position.z;

    // 1. Spawn egg white splatter (oval shape on the ground)
    const whiteGeom = new THREE.CircleGeometry(0.35, 16);
    const eggWhite = new THREE.Mesh(whiteGeom, this.whiteMaterial);
    eggWhite.rotation.x = -Math.PI / 2; // flat on floor
    eggWhite.position.set(px, 0.015, pz);
    eggWhite.scale.set(1.0 + Math.random() * 0.2, 0.8 + Math.random() * 0.2, 1.0);
    eggWhite.receiveShadow = true;
    this.splatterGroup.add(eggWhite);

    // 2. Spawn egg yolk splatter (centered dome on ground)
    const yolkGeom = new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const eggYolk = new THREE.Mesh(yolkGeom, this.yolkMaterial);
    eggYolk.position.set(px, 0.016, pz);
    eggYolk.scale.set(1.2, 0.3, 1.2); // flat dome
    eggYolk.castShadow = true;
    this.splatterGroup.add(eggYolk);

    // 3. Spawn broken shell shards shooting outwards
    const shardCount = 8;
    const shardGeom = new THREE.ConeGeometry(0.06, 0.03, 4);
    
    for (let i = 0; i < shardCount; i++) {
      const shardMesh = new THREE.Mesh(shardGeom, this.eggMaterial);
      shardMesh.position.set(px + (Math.random() * 0.1 - 0.05), 0.06, pz + (Math.random() * 0.1 - 0.05));
      shardMesh.castShadow = true;
      
      this.splatterGroup.add(shardMesh);

      // Radial velocities
      const angle = (i / shardCount) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 0.5 + Math.random() * 1.5;
      
      this.shards.push({
        mesh: shardMesh,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 1.2 + Math.random() * 1.5, Math.sin(angle) * speed),
        rotVelocity: new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5)
      });
    }
  }
}

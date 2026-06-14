import * as THREE from 'three';

export class EnvironmentManager {
  constructor(game) {
    this.game = game;
    this.scene = null;
    this.environmentGroup = null;
    
    // Width limits of the road along the path
    // We can vary the width to create bottleneck zones!
    this.defaultWidth = 1.8; // half width (so total width 3.6)
    
    // Obstacles, decorations, trees
    this.sceneryObjects = [];
  }

  init(scene) {
    this.scene = scene;
    this.environmentGroup = new THREE.Group();
    this.scene.add(this.environmentGroup);

    // 1. Create Ground Plane (Infinite green pasture)
    const groundGeom = new THREE.PlaneGeometry(100, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x7ec850, // vibrant light green grass
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -50);
    ground.receiveShadow = true;
    this.environmentGroup.add(ground);

    // 2. Create the Walking Pathway (Smooth grey stone/brick pathway)
    // We make multiple segments so we can paint bumpy zones differently!
    const segmentLength = 5;
    const segmentCount = 24; // 120 meters total length
    
    for (let i = 0; i < segmentCount; i++) {
      const zCenter = -i * segmentLength;
      const width = this.getRoadWidthAtZ(zCenter) * 2;
      
      const pathGeom = new THREE.PlaneGeometry(width, segmentLength);
      
      // If segment is in a bumpy zone, make it darker terracotta color
      const isBumpy = this.getTerrainBumpiness(zCenter) > 0.01;
      const pathMat = new THREE.MeshStandardMaterial({
        color: isBumpy ? 0xcc8a64 : 0xdfdfdf, // terracotta bumpy cobblestone vs light grey
        roughness: isBumpy ? 0.95 : 0.75,
        metalness: 0.05
      });
      
      const pathSeg = new THREE.Mesh(pathGeom, pathMat);
      pathSeg.rotation.x = -Math.PI / 2;
      pathSeg.position.set(0, 0.005, zCenter - (segmentLength / 2));
      pathSeg.receiveShadow = true;
      this.environmentGroup.add(pathSeg);

      // Add borders/curbs to define the pathway
      this.createPathwayCurb(width, segmentLength, zCenter - (segmentLength / 2), isBumpy);
    }

    // 3. Add Start and Finish Archways
    this.createStartArch();
    this.createFinishArch();

    // 4. Populate Scenery (Procedural trees, flowers, rocks)
    this.spawnScenery();
  }

  reset() {
    // Soft reset if needed (most environment items are static)
  }

  getRoadWidthAtZ(z) {
    // Dynamic road width: path gets narrower at challenging stages
    // Start is wide, middle has narrow wooden bridge sections
    const absZ = Math.abs(z);
    
    if (absZ > 35 && absZ < 50) {
      // Narrow neck
      return 1.1; // total width 2.2m
    } else if (absZ > 70 && absZ < 85) {
      // Very narrow!
      return 0.8; // total width 1.6m
    }
    
    return this.defaultWidth; // 1.8m (total width 3.6m)
  }

  getTerrainBumpiness(z) {
    // Returns a bump factor (0 to 1) representing terrain roughness
    const absZ = Math.abs(z);
    
    // Bumpy zone between 15m and 30m
    if (absZ >= 15 && absZ <= 30) {
      return 0.12; 
    }
    // Very bumpy zone between 55m and 68m
    if (absZ >= 55 && absZ <= 68) {
      return 0.22;
    }
    
    return 0;
  }

  createPathwayCurb(width, length, zPos, isBumpy) {
    // Small curb rails along the sides of the path
    const curbMat = new THREE.MeshStandardMaterial({
      color: isBumpy ? 0x8d5c41 : 0xa5a5a5,
      roughness: 0.8
    });
    
    const curbGeom = new THREE.BoxGeometry(0.12, 0.08, length);
    
    // Left curb
    const leftCurb = new THREE.Mesh(curbGeom, curbMat);
    leftCurb.position.set(-width/2 - 0.06, 0.04, zPos);
    leftCurb.receiveShadow = true;
    leftCurb.castShadow = true;
    this.environmentGroup.add(leftCurb);

    // Right curb
    const rightCurb = new THREE.Mesh(curbGeom, curbMat);
    rightCurb.position.set(width/2 + 0.06, 0.04, zPos);
    rightCurb.receiveShadow = true;
    rightCurb.castShadow = true;
    this.environmentGroup.add(rightCurb);
  }

  createStartArch() {
    const archMat = new THREE.MeshStandardMaterial({ color: 0xef8354, roughness: 0.6 }); // orange pillars
    
    // Left pillar
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), archMat);
    leftPillar.position.set(-2.2, 1.5, 0);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    this.environmentGroup.add(leftPillar);

    // Right pillar
    const rightPillar = leftPillar.clone();
    rightPillar.position.x = 2.2;
    this.environmentGroup.add(rightPillar);

    // Crossbar
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.3, 0.3), archMat);
    crossbar.position.set(0, 3.15, 0);
    crossbar.castShadow = true;
    this.environmentGroup.add(crossbar);
  }

  createFinishArch() {
    const finishZ = -100;
    
    // Checkered columns
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.5 }); // slate blue pillars
    
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), pillarMat);
    leftPillar.position.set(-2.2, 2.0, finishZ);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    this.environmentGroup.add(leftPillar);

    const rightPillar = leftPillar.clone();
    rightPillar.position.x = 2.2;
    this.environmentGroup.add(rightPillar);

    // Arch top board: "FINISH"
    const topBoard = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.8, 0.2), pillarMat);
    topBoard.position.set(0, 4.2, finishZ);
    topBoard.castShadow = true;
    this.environmentGroup.add(topBoard);
    
    // Add red and white check banners
    const bannerMat = new THREE.MeshBasicMaterial({ color: 0xe63946 });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 0.22), bannerMat);
    banner.position.set(0, 3.8, finishZ);
    this.environmentGroup.add(banner);
  }

  spawnScenery() {
    // Let's create reusable low-poly tree geometries
    // 1. Trunk
    const trunkGeom = new THREE.CylinderGeometry(0.12, 0.2, 1.2, 5);
    trunkGeom.translate(0, 0.6, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7f5539, roughness: 0.9 });
    
    // 2. Pine foliage (stacked cones)
    const foliageGeom1 = new THREE.ConeGeometry(0.8, 1.4, 5);
    foliageGeom1.translate(0, 1.5, 0);
    const foliageGeom2 = new THREE.ConeGeometry(0.6, 1.1, 5);
    foliageGeom2.translate(0, 2.2, 0);
    
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x386641, roughness: 0.8 }); // deep green
    
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.castShadow = true;
    treeGroup.add(trunk);
    
    const f1 = new THREE.Mesh(foliageGeom1, pineMat);
    f1.castShadow = true;
    treeGroup.add(f1);
    
    const f2 = new THREE.Mesh(foliageGeom2, pineMat);
    f2.castShadow = true;
    treeGroup.add(f2);
    
    // Standard Round Tree
    const roundTreeGroup = new THREE.Group();
    const rTrunk = new THREE.Mesh(trunkGeom, trunkMat);
    rTrunk.castShadow = true;
    roundTreeGroup.add(rTrunk);
    
    const roundFoliage = new THREE.Mesh(new THREE.SphereGeometry(0.75, 6, 6), new THREE.MeshStandardMaterial({ color: 0x6a994e, roughness: 0.7 }));
    roundFoliage.position.set(0, 1.7, 0);
    roundFoliage.castShadow = true;
    roundTreeGroup.add(roundFoliage);

    // Flowers / Rocks Geometries
    const rockGeom = new THREE.DodecahedronGeometry(0.3);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.8 });

    // Spawn objects randomly along the sides of the path (from z = 0 to -110)
    for (let z = 2; z > -110; z -= 3) {
      // Left side
      const leftDist = this.getRoadWidthAtZ(z) + 1.2 + Math.random() * 8.0;
      // Right side
      const rightDist = this.getRoadWidthAtZ(z) + 1.2 + Math.random() * 8.0;

      // Spawn Left object
      const sideItemL = Math.random();
      let meshL;
      if (sideItemL < 0.35) {
        meshL = treeGroup.clone();
      } else if (sideItemL < 0.7) {
        meshL = roundTreeGroup.clone();
      } else {
        meshL = new THREE.Mesh(rockGeom, rockMat);
        meshL.position.y = 0.15;
        meshL.castShadow = true;
      }
      meshL.position.set(-leftDist, 0, z + (Math.random() * 1.5 - 0.75));
      const scaleL = 0.8 + Math.random() * 0.5;
      meshL.scale.set(scaleL, scaleL, scaleL);
      this.environmentGroup.add(meshL);

      // Spawn Right object
      const sideItemR = Math.random();
      let meshR;
      if (sideItemR < 0.35) {
        meshR = treeGroup.clone();
      } else if (sideItemR < 0.7) {
        meshR = roundTreeGroup.clone();
      } else {
        meshR = new THREE.Mesh(rockGeom, rockMat);
        meshR.position.y = 0.15;
        meshR.castShadow = true;
      }
      meshR.position.set(rightDist, 0, z + (Math.random() * 1.5 - 0.75));
      const scaleR = 0.8 + Math.random() * 0.5;
      meshR.scale.set(scaleR, scaleR, scaleR);
      this.environmentGroup.add(meshR);

      // Spawn decorative colorful flowers near the road borders
      if (Math.random() < 0.6) {
        const flowerMat = new THREE.MeshBasicMaterial({
          color: [0xff4d6d, 0xffb703, 0x06d6a0, 0x3a86c8, 0xfae1ff][Math.floor(Math.random() * 5)]
        });
        const flowerGeom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const flower = new THREE.Mesh(flowerGeom, flowerMat);
        // Put flower just slightly off-road
        const sideX = (Math.random() > 0.5 ? 1 : -1) * (this.getRoadWidthAtZ(z) + 0.2 + Math.random() * 0.4);
        flower.position.set(sideX, 0.05, z);
        this.environmentGroup.add(flower);
      }
    }
  }

  update(dt, playerZ) {
    // Environment is mostly static, but we can animate flower or wind sock meshes if needed
  }
}

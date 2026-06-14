import * as THREE from 'three';

export class SceneManager {
  constructor(game) {
    this.game = game;
    this.container = document.getElementById('canvas-container');
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    
    // Lighting
    this.dirLight = null;
    this.ambientLight = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // Create Scene
    this.scene = new THREE.Scene();
    
    // Create sky blue fog that fades to sky color
    this.scene.background = new THREE.Color(0xbfe3f7);
    this.scene.fog = new THREE.FogExp2(0xbfe3f7, 0.012);

    // Create Camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    // Position camera slightly behind and above the player/spoon, angled downwards
    this.camera.position.set(0, 2.5, 3.2);
    this.camera.lookAt(0, 1.2, -1.5);

    // Create Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Append to DOM
    this.container.appendChild(this.renderer.domElement);

    // Add Lights
    this.setupLights();

    // Listen to resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupLights() {
    // Ambient light for general soft illumination
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    // Directional light representing the sun, with shadow maps
    this.dirLight = new THREE.DirectionalLight(0xfffbe6, 1.2);
    this.dirLight.position.set(20, 40, 20);
    this.dirLight.castShadow = true;
    
    // Shadow resolution and camera bounds
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 150;
    
    const d = 30;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;

    this.scene.add(this.dirLight);

    // Add hemisphere light for sky/ground color reflection
    const hemiLight = new THREE.HemisphereLight(0xbfe3f7, 0x5a7e3c, 0.4);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);
  }

  updateLightPosition(targetZ) {
    // Move the directional light shadow camera with the player to keep high shadow quality
    this.dirLight.position.z = targetZ + 20;
    this.dirLight.target.position.set(0, 0, targetZ);
    this.dirLight.target.updateMatrixWorld();
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  render() {
    // If playing, let the directional light shadow map follow the camera/spoon position
    if (this.game.playerController) {
      this.updateLightPosition(this.game.playerController.position.z);
    }
    
    this.renderer.render(this.scene, this.camera);
  }
}

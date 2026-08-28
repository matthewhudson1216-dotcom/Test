// Game State for 3D City Tactical Shooter: Cops vs Robbers
let gameState = {
  cash: 800,
  health: 100,
  maxHealth: 100,
  armor: 0,
  maxArmor: 100,
  round: 1,
  isRoundActive: false,
  sfxMuted: false,
  inventory: {
    pistol: true,
    shotgun: false,
    rifle: false
  },
  attachments: {
    reddot: false,
    laser: false
  },
  equippedWeapon: 'pistol',
  grenades: 2,
  ammo: {
    pistol: { clip: 12, maxClip: 12, reserve: Infinity },
    shotgun: { clip: 6, maxClip: 6, reserve: 24 },
    rifle: { clip: 30, maxClip: 30, reserve: 90 }
  }
};

let isAimingDownSights = false;
let isReloadingAnimation = 0; // 0 to 1

// Weapon Stats Definition
const weaponsDef = {
  pistol: { name: 'Service Pistol', damage: 25, speed: 0.5, color: 0x38bdf8, reloadTime: 1200, isAuto: false },
  shotgun: { name: 'Tactical Shotgun', damage: 18, speed: 0.45, color: 0xef4444, reloadTime: 2000, isAuto: false, pellets: 6 },
  rifle: { name: 'Assault Rifle', damage: 28, speed: 0.6, color: 0xfbbf24, reloadTime: 1500, isAuto: true, fireRateMs: 140 }
};

let autoFireInterval = null;
let isPointerDown = false;

// Player 3D Position & Camera Look State
let playerPos = { x: 0, y: -0.9, z: 4.2 };
let cameraRotation = { yaw: 0, pitch: 0 }; // Yaw (y-axis), Pitch (x-axis)
let isPointerLocked = false;
let isPaused = false;
let isGameExited = false;

let keysPressed = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
const moveSpeed = 0.08;
const mouseSensitivity = 0.002;

// Web Audio API Sound Synthesizer
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
}

function playSound(type) {
  if (gameState.sfxMuted) return;
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'pistol') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'shotgun') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'rifle') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.06);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === 'reload') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'hit') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.06);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === 'headshot') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (type === 'explosion') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'footstep') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'buy') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.08);
    osc.frequency.setValueAtTime(783.99, now + 0.16);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

// DOM Elements
const roundDisplay = document.getElementById('round-display');
const cashDisplay = document.getElementById('cash-display');
const sfxToggleBtn = document.getElementById('sfx-toggle');

const healthText = document.getElementById('health-text');
const healthBarFill = document.getElementById('health-bar-fill');
const armorText = document.getElementById('armor-text');
const armorBarFill = document.getElementById('armor-bar-fill');

const hudWeaponName = document.getElementById('hud-weapon-name');
const ammoClip = document.getElementById('ammo-clip');
const ammoReserve = document.getElementById('ammo-reserve');
const hudGrenades = document.getElementById('hud-grenades');

const canvasContainer = document.getElementById('canvas-container');
const floatingContainer = document.getElementById('floating-text-container');
const damageVignetteEl = document.getElementById('damage-vignette');
const hitmarkerEl = document.getElementById('hitmarker');

const pauseHeaderBtn = document.getElementById('pause-btn');
const openBuyMenuBtn = document.getElementById('open-buy-menu-btn');
const startRoundBtn = document.getElementById('start-round-btn');
const buyMenuModal = document.getElementById('buy-menu-modal');
const closeBuyMenuBtn = document.getElementById('close-buy-menu-btn');
const buyMenuCash = document.getElementById('buy-menu-cash');

// Pause & Exit Modal Elements
const pauseModal = document.getElementById('pause-modal');
const resumeGameBtn = document.getElementById('resume-game-btn');
const exitGameBtn = document.getElementById('exit-game-btn');
const exitScreen = document.getElementById('exit-screen');
const restartGameBtn = document.getElementById('restart-game-btn');

// Buy Items Buttons
const buyWpnPistolBtn = document.getElementById('buy-wpn-pistol');
const buyWpnShotgunBtn = document.getElementById('buy-wpn-shotgun');
const buyWpnRifleBtn = document.getElementById('buy-wpn-rifle');
const buyArmorKevlarBtn = document.getElementById('buy-armor-kevlar');
const buyArmorHeavyBtn = document.getElementById('buy-armor-heavy');
const buyMedkitBtn = document.getElementById('buy-medkit');
const buyAttReddotBtn = document.getElementById('buy-att-reddot');
const buyAttLaserBtn = document.getElementById('buy-att-laser');

const toastContainer = document.getElementById('toast-container');

// Three.js Variables
let scene, camera, renderer;
let copPlayerMesh;
let cityGroup;
let policeSirenLightRed, policeSirenLightBlue;

let activeEnemies = [];
let activeProjectiles = [];
let barricadeObstacles = [];
let enemiesToSpawnInRound = 0;
let raycaster, mouse;
let isReloading = false;

// FPS 3D Weapon Variables
let fpsWeaponGroup;
let currentWeaponMesh;
let muzzleFlashPoint;
let weaponRecoil = 0;
let weaponBob = 0;

// Initialization
function init() {
  init3D();
  setupEventListeners();
  updateUI();
  showToast('👋 Welcome Officer! Move with WASD, Aim & Click to Shoot.');
}

// Initialize Three.js 3D City Scene
function init3D() {
  const container = canvasContainer;
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 380;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);

  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
  updateCameraTransform();

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Flashing Police Emergency Lights
  policeSirenLightRed = new THREE.PointLight(0xef4444, 3, 25);
  policeSirenLightRed.position.set(-3, 4, 3);
  scene.add(policeSirenLightRed);

  policeSirenLightBlue = new THREE.PointLight(0x0284c7, 3, 25);
  policeSirenLightBlue.position.set(3, 4, 3);
  scene.add(policeSirenLightBlue);

  createProceduralCity();
  createCopPlayerMesh();
  initFPSWeaponGroup();

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  window.addEventListener('resize', onWindowResize);
  animate();
}

function initFPSWeaponGroup() {
  fpsWeaponGroup = new THREE.Group();
  camera.add(fpsWeaponGroup);
  scene.add(camera);

  // Muzzle flash point light
  muzzleFlashPoint = new THREE.PointLight(0xfbbf24, 0, 4);
  fpsWeaponGroup.add(muzzleFlashPoint);

  updateFPSWeaponMesh();
}

function updateFPSWeaponMesh() {
  if (!fpsWeaponGroup) return;

  if (currentWeaponMesh) {
    fpsWeaponGroup.remove(currentWeaponMesh);
  }

  const type = gameState.equippedWeapon;
  const group = new THREE.Group();

  const wpnCamoTex = createWeaponTexture('#1e293b', '#0f172a');
  const gunMetalMat = new THREE.MeshStandardMaterial({ map: wpnCamoTex, metalness: 0.8, roughness: 0.3 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.1 });

  // Optional Tactical Red Laser Sight Beam
  if (gameState.attachments.laser) {
    const laserGeom = new THREE.CylinderGeometry(0.003, 0.003, 10, 6);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7 });
    const laserBeam = new THREE.Mesh(laserGeom, laserMat);
    laserBeam.rotation.x = Math.PI / 2;
    laserBeam.position.set(0, 0, -5);
    group.add(laserBeam);
  }

  // Optional Red Dot Sight Optic
  if (gameState.attachments.reddot) {
    const sightGroup = new THREE.Group();
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.12), darkMetalMat);
    mount.position.set(0, 0, 0);
    sightGroup.add(mount);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 8, 16), darkMetalMat);
    ring.position.set(0, 0.05, 0);
    sightGroup.add(ring);

    const dotGeom = new THREE.SphereGeometry(0.008, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    dotMesh.position.set(0, 0.05, 0);
    sightGroup.add(dotMesh);

    if (type === 'pistol') {
      sightGroup.position.set(0, 0.1, -0.15);
    } else if (type === 'shotgun') {
      sightGroup.position.set(0, 0.1, -0.2);
    } else if (type === 'rifle') {
      sightGroup.position.set(0, 0.1, -0.2);
    }
    group.add(sightGroup);
  }

  if (type === 'pistol') {
    // Service Pistol Model
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.35), gunMetalMat);
    barrel.position.set(0, 0.04, -0.15);
    group.add(barrel);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.36), darkMetalMat);
    slide.position.set(0, 0.05, -0.15);
    group.add(slide);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), gripMat);
    grip.position.set(0, -0.09, -0.05);
    grip.rotation.x = -0.25;
    group.add(grip);

    group.position.set(0.24, -0.22, -0.45);
    muzzleFlashPoint.position.set(0.24, -0.16, -0.8);
  } else if (type === 'shotgun') {
    // Tactical Shotgun Model
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.65, 8), darkMetalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, -0.3);
    group.add(barrel);

    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 8), gripMat);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, 0.02, -0.25);
    group.add(pump);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), gunMetalMat);
    body.position.set(0, 0.02, -0.05);
    group.add(body);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.22), gripMat);
    stock.position.set(0, -0.06, 0.15);
    group.add(stock);

    group.position.set(0.26, -0.24, -0.5);
    muzzleFlashPoint.position.set(0.26, -0.18, -0.98);
  } else if (type === 'rifle') {
    // Assault Rifle Model
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.45), gunMetalMat);
    body.position.set(0, 0.03, -0.12);
    group.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), darkMetalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, -0.45);
    group.add(barrel);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.3), gripMat);
    handguard.position.set(0, 0.03, -0.32);
    group.add(handguard);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.1), goldMat);
    mag.position.set(0, -0.12, -0.15);
    mag.rotation.x = 0.2;
    group.add(mag);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), gripMat);
    grip.position.set(0, -0.1, 0.02);
    grip.rotation.x = -0.3;
    group.add(grip);

    group.position.set(0.25, -0.22, -0.52);
    muzzleFlashPoint.position.set(0.25, -0.16, -1.05);
  }

  currentWeaponMesh = group;
  fpsWeaponGroup.add(currentWeaponMesh);
}

function updateCameraTransform() {
  if (!camera) return;
  // Position camera slightly above player mesh
  camera.position.set(playerPos.x, playerPos.y + 1.2, playerPos.z + 0.5);

  // Calculate look direction from yaw and pitch angles
  const euler = new THREE.Euler(cameraRotation.pitch, cameraRotation.yaw, 0, 'YXZ');
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);

  camera.lookAt(camera.position.clone().add(forward));
}

function createCopPlayerMesh() {
  if (copPlayerMesh) scene.remove(copPlayerMesh);

  const geom = new THREE.CylinderGeometry(0.25, 0.25, 0.7, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x0369a1,
    emissiveIntensity: 0.6
  });
  copPlayerMesh = new THREE.Mesh(geom, mat);
  copPlayerMesh.position.set(playerPos.x, playerPos.y, playerPos.z);
  scene.add(copPlayerMesh);
}

// Procedural Canvas Texture Generator Helpers
function createAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 256);

  // Noise specks
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() < 0.5 ? '#1e293b' : '#090d16';
    ctx.fillRect(x, y, 2, 2);
  }

  // Yellow road lines
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 6;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createBuildingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 256);

  // Concrete grid lines
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Glowing window squares
  for (let x = 8; x < 256; x += 32) {
    for (let y = 8; y < 256; y += 32) {
      if (Math.random() < 0.65) {
        ctx.fillStyle = Math.random() < 0.2 ? '#38bdf8' : '#fbbf24';
        ctx.fillRect(x, y, 16, 16);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createWeaponTexture(baseHex, camoHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = camoHex;
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const r = 8 + Math.random() * 18;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

function createProceduralCity() {
  if (cityGroup) scene.remove(cityGroup);
  cityGroup = new THREE.Group();

  const asphaltTex = createAsphaltTexture();
  const buildingTex = createBuildingTexture();

  // Expanded Asphalt Ground (50x50 map)
  const groundGeom = new THREE.PlaneGeometry(50, 50);
  const groundMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.7 });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.2;
  cityGroup.add(ground);

  // Expanded Buildings Grid
  const buildingMat = new THREE.MeshStandardMaterial({
    map: buildingTex,
    metalness: 0.5,
    roughness: 0.4
  });

  for (let x = -20; x <= 20; x += 3.8) {
    for (let z = -20; z <= 4; z += 3.8) {
      if (Math.abs(x) < 3.2 && z > -6) continue; // Keep main boulevard corridor clear

      const h = 3.0 + Math.random() * 7.0;
      const bGeom = new THREE.BoxGeometry(2.6, h, 2.6);
      const bMesh = new THREE.Mesh(bGeom, buildingMat);
      bMesh.position.set(x + (Math.random() - 0.5) * 0.4, -1.2 + h / 2, z + (Math.random() - 0.5) * 0.4);
      cityGroup.add(bMesh);
    }
  }

  // Solid Fortified Barricade Wall Props
  barricadeObstacles = [];
  const cruiserMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.2 });
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.2, roughness: 0.8 });

  // Add prominent barricade walls in the street
  const barricadeConfigs = [
    { x: 0, y: -0.6, z: -2.0, w: 3.5, h: 1.2, d: 0.6 },
    { x: -4.5, y: -0.6, z: -1.0, w: 2.8, h: 1.2, d: 0.6 },
    { x: 4.5, y: -0.6, z: -1.0, w: 2.8, h: 1.2, d: 0.6 },
    { x: -2.5, y: -0.6, z: 2.0, w: 2.5, h: 1.2, d: 0.6 },
    { x: 2.5, y: -0.6, z: 2.0, w: 2.5, h: 1.2, d: 0.6 }
  ];

  barricadeConfigs.forEach(cfg => {
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), barrierMat);
    wallMesh.position.set(cfg.x, cfg.y, cfg.z);
    cityGroup.add(wallMesh);

    // Stripe detail on barricade
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(cfg.w * 0.95, 0.15, cfg.d + 0.02), stripeMat);
    stripe.position.set(cfg.x, cfg.y + 0.3, cfg.z);
    cityGroup.add(stripe);

    // Store collision bounding box
    const box = new THREE.Box3().setFromObject(wallMesh);
    barricadeObstacles.push(box);
  });

  // Parked Police Cruisers (also solid obstacles)
  for (let i = -2; i <= 2; i += 4) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 2.4), cruiserMat);
    car.add(body);
    car.position.set(i * 2.2, -0.85, -4.0);
    cityGroup.add(car);

    const carBox = new THREE.Box3().setFromObject(car);
    barricadeObstacles.push(carBox);
  }

  scene.add(cityGroup);
}

function spawnRobberEnemy() {
  if (!scene) return;

  // Determine enemy archetype
  const randType = Math.random();
  let type = 'standard'; // standard, runner, shooter, shield
  if (randType < 0.25) type = 'runner';
  else if (randType < 0.55) type = 'shooter';
  else if (randType < 0.75) type = 'shield';

  const robberGroup = new THREE.Group();

  // Color scheme based on archetype
  const clothColor = type === 'runner' ? 0x0284c7 : (type === 'shield' ? 0x334155 : 0x1e1e24);
  const beanieColor = type === 'shooter' ? 0xd97706 : (type === 'runner' ? 0x10b981 : 0xef4444);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 });
  const clothMat = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const beanieMat = new THREE.MeshStandardMaterial({ color: beanieColor, roughness: 0.9 });
  const maskMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

  // Head
  const headGeom = new THREE.SphereGeometry(0.14, 12, 12);
  const headMesh = new THREE.Mesh(headGeom, skinMat);
  headMesh.position.y = 0.52;
  headMesh.userData.bodyPart = 'head';
  robberGroup.add(headMesh);

  // Beanie Cap
  const beanieGeom = new THREE.SphereGeometry(0.145, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const beanieMesh = new THREE.Mesh(beanieGeom, beanieMat);
  beanieMesh.position.y = 0.55;
  beanieMesh.userData.bodyPart = 'head';
  robberGroup.add(beanieMesh);

  // Eye Mask
  const maskGeom = new THREE.BoxGeometry(0.22, 0.06, 0.08);
  const maskMesh = new THREE.Mesh(maskGeom, maskMat);
  maskMesh.position.set(0, 0.53, 0.1);
  maskMesh.userData.bodyPart = 'head';
  robberGroup.add(maskMesh);

  // Torso
  const torsoGeom = new THREE.BoxGeometry(0.36, 0.42, 0.22);
  const torsoMesh = new THREE.Mesh(torsoGeom, clothMat);
  torsoMesh.position.y = 0.22;
  torsoMesh.userData.bodyPart = 'torso';
  robberGroup.add(torsoMesh);

  // Arms
  const armGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.38);
  const leftArm = new THREE.Mesh(armGeom, clothMat);
  leftArm.position.set(-0.23, 0.22, 0);
  leftArm.rotation.z = 0.15;
  leftArm.userData.bodyPart = 'limb';
  robberGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeom, clothMat);
  rightArm.position.set(0.23, 0.22, 0);
  rightArm.rotation.z = -0.15;
  rightArm.userData.bodyPart = 'limb';
  robberGroup.add(rightArm);

  // Heavy Shield Prop
  if (type === 'shield') {
    const shieldGeom = new THREE.BoxGeometry(0.5, 0.75, 0.06);
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
    const shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
    shieldMesh.position.set(0, 0.2, 0.25);
    shieldMesh.userData.bodyPart = 'torso';
    robberGroup.add(shieldMesh);
  }

  // Shooter Weapon Prop
  if (type === 'shooter') {
    const gunGeom = new THREE.BoxGeometry(0.06, 0.08, 0.3);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const gunMesh = new THREE.Mesh(gunGeom, gunMat);
    gunMesh.position.set(0.22, 0.2, 0.2);
    robberGroup.add(gunMesh);
  }

  // Legs
  const legGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.4);
  const leftLeg = new THREE.Mesh(legGeom, pantsMat);
  leftLeg.position.set(-0.1, -0.18, 0);
  leftLeg.userData.bodyPart = 'limb';
  robberGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeom, pantsMat);
  rightLeg.position.set(0.1, -0.18, 0);
  rightLeg.userData.bodyPart = 'limb';
  robberGroup.add(rightLeg);

  // 3D Health Bar Group above head
  const hpBarGroup = new THREE.Group();
  hpBarGroup.position.set(0, 0.78, 0);

  const hpBgGeom = new THREE.PlaneGeometry(0.6, 0.08);
  const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide });
  const hpBgMesh = new THREE.Mesh(hpBgGeom, hpBgMat);
  hpBarGroup.add(hpBgMesh);

  const hpFillGeom = new THREE.PlaneGeometry(0.58, 0.06);
  const hpFillMat = new THREE.MeshBasicMaterial({ color: type === 'shield' ? 0x38bdf8 : 0xef4444, side: THREE.DoubleSide });
  const hpFillMesh = new THREE.Mesh(hpFillGeom, hpFillMat);
  hpFillMesh.position.z = 0.001;
  hpBarGroup.add(hpFillMesh);

  robberGroup.add(hpBarGroup);

  const spawnX = (Math.random() - 0.5) * 12;
  const spawnZ = -8.0 - Math.random() * 4;
  robberGroup.position.set(spawnX, -0.9, spawnZ);

  let hp = 30 + gameState.round * 10;
  let speed = 0.02 + Math.random() * 0.015 + gameState.round * 0.003;

  if (type === 'runner') {
    speed *= 1.8;
    hp *= 0.7;
  } else if (type === 'shield') {
    speed *= 0.6;
    hp *= 2.2;
  }

  const enemy = {
    type,
    mesh: robberGroup,
    hpBarFill: hpFillMesh,
    hpBarGroup: hpBarGroup,
    hp,
    maxHp: hp,
    speed,
    walkCycle: Math.random() * 10,
    shootCooldown: 0,
    meleeCooldown: 0,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm
  };
  scene.add(robberGroup);
  activeEnemies.push(enemy);
}

function animate() {
  requestAnimationFrame(animate);

  // Smooth weapon recoil decay & movement weapon bobbing
  if (weaponRecoil > 0) weaponRecoil *= 0.82;
  if (muzzleFlashPoint && muzzleFlashPoint.intensity > 0) muzzleFlashPoint.intensity *= 0.7;

  // Handle WASD Keyboard Movement (Relative to Camera Yaw Direction)
  if (!isPaused && !isGameExited) {
    let moveX = 0;
    let moveZ = 0;

    if (keysPressed.KeyW || keysPressed.Keyw) moveZ -= 1;
    if (keysPressed.KeyS || keysPressed.Keys) moveZ += 1;
    if (keysPressed.KeyA || keysPressed.Keya) moveX -= 1;
    if (keysPressed.KeyD || keysPressed.Keyd) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      weaponBob += 0.12;
      if (Math.sin(weaponBob) > 0.95) {
        playSound('footstep');
      }
      const moveVec = new THREE.Vector3(moveX, 0, moveZ).normalize().multiplyScalar(moveSpeed);
      // Rotate movement vector according to camera yaw angle
      moveVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.yaw);

      // Calculate tentative target position
      let targetX = Math.min(Math.max(-12.0, playerPos.x + moveVec.x), 12.0);
      let targetZ = Math.min(Math.max(-8.0, playerPos.z + moveVec.z), 12.0);

      // Check collision against solid barricade walls (player radius ~0.35)
      let canMoveX = true;
      let canMoveZ = true;

      barricadeObstacles.forEach(box => {
        if (targetX >= box.min.x - 0.35 && targetX <= box.max.x + 0.35 &&
            playerPos.z >= box.min.z - 0.35 && playerPos.z <= box.max.z + 0.35) {
          canMoveX = false;
        }
        if (playerPos.x >= box.min.x - 0.35 && playerPos.x <= box.max.x + 0.35 &&
            targetZ >= box.min.z - 0.35 && targetZ <= box.max.z + 0.35) {
          canMoveZ = false;
        }
      });

      if (canMoveX) playerPos.x = targetX;
      if (canMoveZ) playerPos.z = targetZ;

      copPlayerMesh.position.set(playerPos.x, playerPos.y, playerPos.z);
      updateCameraTransform();
    }
  }

  // Handle ADS Camera FOV Zoom
  const targetFov = isAimingDownSights ? 38 : 55;
  camera.fov += (targetFov - camera.fov) * 0.2;
  camera.updateProjectionMatrix();

  // Handle Weapon Reload Rotation Animation
  if (isReloading) {
    isReloadingAnimation = Math.min(1.0, isReloadingAnimation + 0.08);
  } else {
    isReloadingAnimation = Math.max(0, isReloadingAnimation - 0.08);
  }

  // Apply weapon recoil, bob, ADS centering, and reload tilt to FPS weapon model
  if (currentWeaponMesh) {
    const bobOffset = Math.sin(weaponBob) * (isAimingDownSights ? 0.004 : 0.015);

    // Target X position: centered (0) in ADS mode, offset to right when hip-firing
    const targetX = isAimingDownSights ? 0 : (gameState.equippedWeapon === 'shotgun' ? 0.26 : 0.24);
    currentWeaponMesh.position.x += (targetX - currentWeaponMesh.position.x) * 0.2;

    // Adjust Y position during ADS so iron sights / Red Dot Sight align directly with center eye line
    const basePosY = gameState.equippedWeapon === 'shotgun' ? -0.24 : -0.22;
    const adsYOffset = isAimingDownSights ? (gameState.attachments.reddot ? 0.07 : 0.04) : 0;

    currentWeaponMesh.position.y = basePosY + adsYOffset + bobOffset - weaponRecoil * 0.05 - isReloadingAnimation * 0.15;
    currentWeaponMesh.position.z = (gameState.equippedWeapon === 'pistol' ? -0.45 : -0.52) + weaponRecoil * 0.1;
    currentWeaponMesh.rotation.x = weaponRecoil * 0.3 + isReloadingAnimation * 0.6;
    currentWeaponMesh.rotation.z = isReloadingAnimation * -0.4;
  }

  // Police Siren Emergency Lights Flashing
  const time = Date.now() * 0.005;
  if (policeSirenLightRed && policeSirenLightBlue) {
    policeSirenLightRed.intensity = Math.sin(time) > 0 ? 4 : 0.5;
    policeSirenLightBlue.intensity = Math.cos(time) > 0 ? 4 : 0.5;
  }

  // Animate Projectiles
  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const proj = activeProjectiles[i];
    proj.mesh.position.add(proj.velocity);
    proj.life -= 1;

    if (proj.life <= 0) {
      scene.remove(proj.mesh);
      activeProjectiles.splice(i, 1);
    }
  }

  // Animate Robber Enemies advancing on Cop
  if (gameState.isRoundActive) {
    for (let i = activeEnemies.length - 1; i >= 0; i--) {
      const enemy = activeEnemies[i];

      // Face toward player position
      const playerVec = new THREE.Vector3(playerPos.x, -0.9, playerPos.z);
      enemy.mesh.lookAt(playerVec.x, enemy.mesh.position.y, playerVec.z);

      // Shooter enemy shoots at player periodically
      if (enemy.type === 'shooter') {
        enemy.shootCooldown += 1;
        if (enemy.shootCooldown > 120) {
          enemy.shootCooldown = 0;
          fireBulletTracerFromEnemy(enemy.mesh.position, camera.position, 0xef4444);
          damagePlayer(8);
        }
      }

      // Move toward player position with barricade collision checking
      const dir = playerVec.clone().sub(enemy.mesh.position).normalize();
      const nextPos = enemy.mesh.position.clone().addScaledVector(dir, enemy.speed);

      // Check if enemy next step hits a solid barricade
      let blockedByBarricade = false;
      barricadeObstacles.forEach(box => {
        if (nextPos.x >= box.min.x - 0.3 && nextPos.x <= box.max.x + 0.3 &&
            nextPos.z >= box.min.z - 0.3 && nextPos.z <= box.max.z + 0.3) {
          blockedByBarricade = true;
        }
      });

      if (!blockedByBarricade) {
        enemy.mesh.position.copy(nextPos);
      } else {
        // Slide around barricade along X or Z axis
        const slideX = enemy.mesh.position.clone();
        slideX.x += dir.x * enemy.speed;
        let blockedX = false;
        barricadeObstacles.forEach(box => {
          if (slideX.x >= box.min.x - 0.3 && slideX.x <= box.max.x + 0.3 &&
              slideX.z >= box.min.z - 0.3 && slideX.z <= box.max.z + 0.3) blockedX = true;
        });

        if (!blockedX) {
          enemy.mesh.position.x = slideX.x;
        } else {
          const slideZ = enemy.mesh.position.clone();
          slideZ.z += dir.z * enemy.speed;
          let blockedZ = false;
          barricadeObstacles.forEach(box => {
            if (slideZ.x >= box.min.x - 0.3 && slideZ.x <= box.max.x + 0.3 &&
                slideZ.z >= box.min.z - 0.3 && slideZ.z <= box.max.z + 0.3) blockedZ = true;
          });
          if (!blockedZ) enemy.mesh.position.z = slideZ.z;
        }
      }

      // Human walking animation (leg & arm swinging)
      enemy.walkCycle += 0.15;
      if (enemy.leftLeg && enemy.rightLeg && enemy.leftArm && enemy.rightArm) {
        enemy.leftLeg.rotation.x = Math.sin(enemy.walkCycle) * 0.4;
        enemy.rightLeg.rotation.x = -Math.sin(enemy.walkCycle) * 0.4;
        enemy.leftArm.rotation.x = -Math.sin(enemy.walkCycle) * 0.4;
        enemy.rightArm.rotation.x = Math.sin(enemy.walkCycle) * 0.4;
      }

      // Keep 3D Health Bar billboarding facing camera
      if (enemy.hpBarGroup && camera) {
        enemy.hpBarGroup.quaternion.copy(camera.quaternion);
      }

      // Check proximity for Melee Attack Animation & Damage Loop
      const dist = enemy.mesh.position.distanceTo(copPlayerMesh.position);
      if (dist < 1.1) {
        // Close-quarters Melee Combat State (Attacking Animation)
        enemy.meleeCooldown += 1;

        // Perform arm punch/swing animation towards player
        const swingAngle = Math.sin(enemy.meleeCooldown * 0.3) * 0.8;
        if (enemy.rightArm) enemy.rightArm.rotation.x = -Math.PI / 3 + swingAngle;
        if (enemy.leftArm) enemy.leftArm.rotation.x = -Math.PI / 3 - swingAngle;

        // Apply continuous melee damage on attack interval (every 35 frames)
        if (enemy.meleeCooldown % 35 === 0) {
          damagePlayer(10);
          playSound('hit');
        }
      } else {
        // Reset arm elevation when not in melee range
        enemy.meleeCooldown = 0;
      }
    }

    // Spawn queued enemies for active round
    if (enemiesToSpawnInRound > 0 && Math.random() < 0.04) {
      spawnRobberEnemy();
      enemiesToSpawnInRound -= 1;
    }
  }

  renderer.render(scene, camera);
}

function damagePlayer(amount) {
  let remainingDamage = amount;
  if (gameState.armor > 0) {
    const armorAbsorb = Math.min(gameState.armor, Math.floor(amount * 0.8));
    gameState.armor -= armorAbsorb;
    remainingDamage -= armorAbsorb;
  }

  gameState.health = Math.max(0, gameState.health - remainingDamage);

  // Trigger Red Screen Vignette Flash
  if (damageVignetteEl) {
    damageVignetteEl.classList.remove('hidden');
    setTimeout(() => damageVignetteEl.classList.add('hidden'), 350);
  }

  updateUI();

  if (gameState.health <= 0) {
    gameState.isRoundActive = false;
    showToast('💀 YOU WERE ELIMINATED! Precinct Medics Rescued You.');
    gameState.health = 100;
    gameState.armor = 0;
    activeEnemies.forEach(e => scene.remove(e.mesh));
    activeEnemies = [];
    updateUI();
  }
}

function handleShooterClick(event) {
  if (isPaused || isGameExited) return;

  // Request Pointer Lock for immersive 3D mouse look
  if (document.pointerLockElement !== canvasContainer && !buyMenuModal.classList.contains('hidden') === false) {
    canvasContainer.requestPointerLock();
  }

  if (!gameState.isRoundActive) {
    showToast('⚠️ Click "START NEXT ROUND" or open Buy Menu to prepare!');
    return;
  }

  const currentWpnKey = gameState.equippedWeapon;
  const currentAmmo = gameState.ammo[currentWpnKey];

  if (isReloading) {
    showToast('⏳ Reloading weapon...');
    return;
  }

  if (currentAmmo.clip <= 0) {
    reloadWeapon();
    return;
  }

  currentAmmo.clip -= 1;

  const wpnDef = weaponsDef[currentWpnKey];
  // Raycast down center of camera viewport (crosshair position)
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const rect = renderer.domElement.getBoundingClientRect();
  const screenCenterX = rect.width / 2;
  const screenCenterY = rect.height / 2;

  // Trigger weapon kick / recoil animation and muzzle flash
  weaponRecoil = 1.0;
  if (muzzleFlashPoint) muzzleFlashPoint.intensity = 5.0;

  if (currentWpnKey === 'shotgun') {
    // Shotgun Multi-Pellet Spread Logic
    const pelletsCount = wpnDef.pellets || 6;
    for (let p = 0; p < pelletsCount; p++) {
      // Add random spread angle offset to camera center
      const spreadX = (Math.random() - 0.5) * 0.12;
      const spreadY = (Math.random() - 0.5) * 0.12;

      const pelletRaycaster = new THREE.Raycaster();
      pelletRaycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);

      let targetPoint = pelletRaycaster.ray.at(25, new THREE.Vector3());
      let hitEnemyIndex = -1;
      let hitBodyPart = 'torso';

      for (let i = activeEnemies.length - 1; i >= 0; i--) {
        const enemy = activeEnemies[i];
        const intersects = pelletRaycaster.intersectObject(enemy.mesh, true);
        if (intersects.length > 0) {
          targetPoint = intersects[0].point;
          hitEnemyIndex = i;
          if (intersects[0].object && intersects[0].object.userData.bodyPart) {
            hitBodyPart = intersects[0].object.userData.bodyPart;
          }
          break;
        }
      }

      spawnSparkParticles(targetPoint, wpnDef.color);
      fireBulletTracer(targetPoint, wpnDef.color);

      if (hitEnemyIndex !== -1) {
        const enemy = activeEnemies[hitEnemyIndex];

        let mult = 1.0;
        if (hitBodyPart === 'head') mult = 2.0;
        else if (hitBodyPart === 'limb') mult = 0.75;

        const appliedDamage = Math.round(wpnDef.damage * mult);
        enemy.hp -= appliedDamage;

        if (enemy.hp <= 0) {
          scene.remove(enemy.mesh);
          const enemyIdx = activeEnemies.indexOf(enemy);
          if (enemyIdx !== -1) activeEnemies.splice(enemyIdx, 1);
          const reward = 100 + gameState.round * 20;
          gameState.cash += reward;
          spawnFloatingText(`+$${reward}`, screenCenterX, screenCenterY, false);
          checkRoundStatus();
        } else {
          const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
          enemy.hpBarFill.scale.x = hpRatio;
          enemy.hpBarFill.position.x = -0.29 * (1 - hpRatio);
        }
      }
    }
    spawnFloatingText(`SHOTGUN BLAST!`, screenCenterX, screenCenterY, true);
    playSound('shotgun');
  } else {
    // Single Bullet Firing (Pistol / Rifle)
    let targetPoint = raycaster.ray.at(30, new THREE.Vector3());
    let hitEnemyIndex = -1;
    let hitBodyPart = 'torso';

    for (let i = activeEnemies.length - 1; i >= 0; i--) {
      const enemy = activeEnemies[i];
      const intersects = raycaster.intersectObject(enemy.mesh, true);
      if (intersects.length > 0) {
        targetPoint = intersects[0].point;
        hitEnemyIndex = i;
        if (intersects[0].object && intersects[0].object.userData.bodyPart) {
          hitBodyPart = intersects[0].object.userData.bodyPart;
        }
        break;
      }
    }

    spawnSparkParticles(targetPoint, wpnDef.color);
    fireBulletTracer(targetPoint, wpnDef.color);

    if (hitEnemyIndex !== -1) {
      const enemy = activeEnemies[hitEnemyIndex];

      let mult = 1.0;
      let label = '';
      if (hitBodyPart === 'head') {
        mult = 2.0;
        label = 'CRITICAL HEADSHOT! ';
      } else if (hitBodyPart === 'limb') {
        mult = 0.75;
        label = 'LIMB HIT ';
      }

      const appliedDamage = Math.round(wpnDef.damage * mult);
      enemy.hp -= appliedDamage;

      spawnFloatingText(`${label}-${appliedDamage}`, screenCenterX, screenCenterY, hitBodyPart === 'head');

      // Trigger Hitmarker Visual & Sound
      if (hitmarkerEl) {
        hitmarkerEl.classList.remove('hidden');
        setTimeout(() => hitmarkerEl.classList.add('hidden'), 150);
      }
      playSound(hitBodyPart === 'head' ? 'headshot' : 'hit');

      if (enemy.hp <= 0) {
        scene.remove(enemy.mesh);
        activeEnemies.splice(hitEnemyIndex, 1);
        const reward = 100 + gameState.round * 20;
        gameState.cash += reward;
        spawnFloatingText(`+$${reward}`, screenCenterX, screenCenterY, false);
        checkRoundStatus();
      } else {
        const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
        enemy.hpBarFill.scale.x = hpRatio;
        enemy.hpBarFill.position.x = -0.29 * (1 - hpRatio);
      }
    }
  }

  updateUI();
}

function spawnSparkParticles(hitPoint, hexColor) {
  if (!scene) return;
  for (let i = 0; i < 4; i++) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const mat = new THREE.PointsMaterial({ color: hexColor, size: 0.08, transparent: true, opacity: 0.9 });
    const p = new THREE.Points(geom, mat);
    p.position.copy(hitPoint);
    scene.add(p);

    const vel = new THREE.Vector3((Math.random() - 0.5) * 0.2, Math.random() * 0.2, (Math.random() - 0.5) * 0.2);
    activeProjectiles.push({ mesh: p, velocity: vel, life: 8 });
  }
}

function fireBulletTracer(worldTargetPoint, hexColor) {
  if (!scene || !camera) return;

  const geom = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: hexColor });
  const proj = new THREE.Mesh(geom, mat);

  // Get barrel tip position in world space
  let barrelPos = new THREE.Vector3(0.24, -0.16, -0.6);
  if (muzzleFlashPoint) {
    muzzleFlashPoint.getWorldPosition(barrelPos);
  } else {
    barrelPos = camera.position.clone();
  }

  proj.position.copy(barrelPos);

  const dir = worldTargetPoint.clone().sub(barrelPos).normalize();
  const vel = dir.multiplyScalar(0.7);

  proj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

  scene.add(proj);
  activeProjectiles.push({ mesh: proj, velocity: vel, life: 18 });
  playSound(gameState.equippedWeapon);
}

function fireBulletTracerFromEnemy(startPos, targetPos, hexColor) {
  if (!scene) return;
  const geom = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: hexColor });
  const proj = new THREE.Mesh(geom, mat);

  proj.position.copy(startPos);
  const dir = targetPos.clone().sub(startPos).normalize();
  const vel = dir.multiplyScalar(0.5);

  proj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(proj);
  activeProjectiles.push({ mesh: proj, velocity: vel, life: 18 });
}

function reloadWeapon() {
  if (isReloading) return;
  const currentWpnKey = gameState.equippedWeapon;
  const ammoObj = gameState.ammo[currentWpnKey];
  const wpnDef = weaponsDef[currentWpnKey];

  if (ammoObj.clip === ammoObj.maxClip) return;
  if (ammoObj.reserve <= 0 && ammoObj.reserve !== Infinity) {
    showToast('⚠️ OUT OF AMMO! Open Buy Menu to restock.');
    return;
  }

  isReloading = true;
  playSound('reload');
  showToast('🔄 Reloading...');

  setTimeout(() => {
    const needed = ammoObj.maxClip - ammoObj.clip;
    if (ammoObj.reserve === Infinity) {
      ammoObj.clip = ammoObj.maxClip;
    } else {
      const take = Math.min(needed, ammoObj.reserve);
      ammoObj.clip += take;
      ammoObj.reserve -= take;
    }
    isReloading = false;
    updateUI();
  }, wpnDef.reloadTime);
}

function startNextRound() {
  if (gameState.isRoundActive) return;

  gameState.isRoundActive = true;
  enemiesToSpawnInRound = 4 + gameState.round * 3;
  buyMenuModal.classList.add('hidden');

  showToast(`🚨 ROUND ${gameState.round} STARTED! Neutralize all Robbers!`);
  updateUI();
}

function checkRoundStatus() {
  if (gameState.isRoundActive && activeEnemies.length === 0 && enemiesToSpawnInRound === 0) {
    gameState.isRoundActive = false;
    const roundBonus = 300 + gameState.round * 150;
    gameState.cash += roundBonus;
    gameState.round += 1;

    showToast(`🎉 ROUND COMPLETED! Earned +$${roundBonus} Intermission Bonus!`);
    openBuyMenu();
    updateUI();
  }
}

function openBuyMenu() {
  if (document.exitPointerLock) document.exitPointerLock();
  buyMenuModal.classList.remove('hidden');
  updateBuyMenuUI();
}

function togglePauseMenu() {
  if (isPaused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

function pauseGame() {
  isPaused = true;
  if (document.exitPointerLock) document.exitPointerLock();
  pauseModal.classList.remove('hidden');
}

function resumeGame() {
  isPaused = false;
  pauseModal.classList.add('hidden');
}

function exitGame() {
  isPaused = false;
  isGameExited = true;
  if (document.exitPointerLock) document.exitPointerLock();
  pauseModal.classList.add('hidden');
  buyMenuModal.classList.add('hidden');
  exitScreen.classList.remove('hidden');
  gameState.isRoundActive = false;
}

function restartGame() {
  isGameExited = false;
  isPaused = false;
  exitScreen.classList.add('hidden');

  // Reset Game State
  gameState = {
    cash: 800,
    health: 100,
    maxHealth: 100,
    armor: 0,
    maxArmor: 100,
    round: 1,
    isRoundActive: false,
    sfxMuted: gameState.sfxMuted,
    inventory: { pistol: true, shotgun: false, rifle: false },
    equippedWeapon: 'pistol',
    ammo: {
      pistol: { clip: 12, maxClip: 12, reserve: Infinity },
      shotgun: { clip: 6, maxClip: 6, reserve: 24 },
      rifle: { clip: 30, maxClip: 30, reserve: 90 }
    }
  };

  playerPos = { x: 0, y: -0.9, z: 4.2 };
  cameraRotation = { yaw: 0, pitch: 0 };
  copPlayerMesh.position.set(playerPos.x, playerPos.y, playerPos.z);
  updateCameraTransform();

  activeEnemies.forEach(e => scene.remove(e.mesh));
  activeEnemies = [];

  updateFPSWeaponMesh();
  updateUI();
  showToast('🚨 Back on Duty! Good luck Officer.');
}

function setupEventListeners() {
  // Prevent default context menu on right click for ADS
  canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());

  canvasContainer.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
      // Right Click ADS
      isAimingDownSights = true;
      return;
    }

    if (e.button === 0) {
      isPointerDown = true;
      handleShooterClick(e);

      const currentWpnKey = gameState.equippedWeapon;
      const wpnDef = weaponsDef[currentWpnKey];

      if (wpnDef.isAuto && !autoFireInterval) {
        autoFireInterval = setInterval(() => {
          if (isPointerDown && gameState.isRoundActive && !isPaused && !isGameExited) {
            handleShooterClick(e);
          } else {
            stopAutoFire();
          }
        }, wpnDef.fireRateMs);
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
      isAimingDownSights = false;
    }
    if (e.button === 0) {
      isPointerDown = false;
      stopAutoFire();
    }
  });

  window.addEventListener('pointercancel', () => {
    isPointerDown = false;
    stopAutoFire();
  });

  // Pointer Lock & 3D Mouse Look Event Listeners
  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = (document.pointerLockElement === canvasContainer);
  });

  document.addEventListener('mousemove', (e) => {
    if (isPointerLocked && !isPaused && !isGameExited) {
      cameraRotation.yaw -= e.movementX * mouseSensitivity;
      cameraRotation.pitch -= e.movementY * mouseSensitivity;

      // Clamp pitch rotation (looking up/down) to avoid flip
      const maxPitch = Math.PI / 2.5;
      cameraRotation.pitch = Math.max(-maxPitch, Math.min(maxPitch, cameraRotation.pitch));

      updateCameraTransform();
    }
  });

  // WASD, Reload, Grenade & Escape Keyboard Listeners
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (!isGameExited) {
        togglePauseMenu();
      }
      return;
    }

    if (keysPressed.hasOwnProperty(e.code)) {
      keysPressed[e.code] = true;
    }
    if (e.code === 'KeyR' || e.code === 'Keyr') {
      reloadWeapon();
    }
    if (e.code === 'KeyG' || e.code === 'Keyg') {
      throwGrenade();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keysPressed.hasOwnProperty(e.code)) {
      keysPressed[e.code] = false;
    }
  });

  // Pause & Exit Modal Button Handlers
  resumeGameBtn.addEventListener('click', resumeGame);
  exitGameBtn.addEventListener('click', exitGame);
  restartGameBtn.addEventListener('click', restartGame);

  if (pauseHeaderBtn) {
    pauseHeaderBtn.addEventListener('click', togglePauseMenu);
  }

  openBuyMenuBtn.addEventListener('click', openBuyMenu);
  closeBuyMenuBtn.addEventListener('click', () => {
    buyMenuModal.classList.add('hidden');
  });

  startRoundBtn.addEventListener('click', startNextRound);

  // Buy Menu Purchases
  buyWpnPistolBtn.addEventListener('click', () => equipWeapon('pistol'));

  buyWpnShotgunBtn.addEventListener('click', () => {
    if (!gameState.inventory.shotgun) {
      if (gameState.cash >= 500) {
        gameState.cash -= 500;
        gameState.inventory.shotgun = true;
        playSound('buy');
        equipWeapon('shotgun');
      } else {
        showToast('❌ Not enough cash for Tactical Shotgun!');
      }
    } else {
      equipWeapon('shotgun');
    }
  });

  buyWpnRifleBtn.addEventListener('click', () => {
    if (!gameState.inventory.rifle) {
      if (gameState.cash >= 1200) {
        gameState.cash -= 1200;
        gameState.inventory.rifle = true;
        playSound('buy');
        equipWeapon('rifle');
      } else {
        showToast('❌ Not enough cash for Assault Rifle!');
      }
    } else {
      equipWeapon('rifle');
    }
  });

  buyArmorKevlarBtn.addEventListener('click', () => {
    if (gameState.cash >= 300) {
      gameState.cash -= 300;
      gameState.armor = Math.min(gameState.maxArmor, gameState.armor + 50);
      playSound('buy');
      showToast('🛡️ Kevlar Vest Equipped (+50 Armor)!');
      updateUI();
      updateBuyMenuUI();
    } else {
      showToast('❌ Not enough cash for Kevlar Vest!');
    }
  });

  buyArmorHeavyBtn.addEventListener('click', () => {
    if (gameState.cash >= 600) {
      gameState.cash -= 600;
      gameState.armor = gameState.maxArmor;
      playSound('buy');
      showToast('🛡️ Heavy Tactical Suit Equipped (+100 Armor)!');
      updateUI();
      updateBuyMenuUI();
    } else {
      showToast('❌ Not enough cash for Heavy Suit!');
    }
  });

  buyMedkitBtn.addEventListener('click', () => {
    if (gameState.cash >= 250) {
      if (gameState.health < gameState.maxHealth) {
        gameState.cash -= 250;
        gameState.health = Math.min(gameState.maxHealth, gameState.health + 50);
        playSound('buy');
        showToast('💉 Applied First Aid Kit (+50 Health)!');
        updateUI();
        updateBuyMenuUI();
      } else {
        showToast('❤️ Health is already full!');
      }
    } else {
      showToast('❌ Not enough cash for Medkit!');
    }
  });

  if (buyAttReddotBtn) {
    buyAttReddotBtn.addEventListener('click', () => {
      if (!gameState.attachments.reddot) {
        if (gameState.cash >= 200) {
          gameState.cash -= 200;
          gameState.attachments.reddot = true;
          playSound('buy');
          showToast('🔧 Red Dot Sight Mounted!');
        } else {
          showToast('❌ Not enough cash for Red Dot Sight!');
        }
      } else {
        gameState.attachments.reddot = false;
        showToast('🔧 Red Dot Sight Removed.');
      }
      updateFPSWeaponMesh();
      updateUI();
      updateBuyMenuUI();
    });
  }

  if (buyAttLaserBtn) {
    buyAttLaserBtn.addEventListener('click', () => {
      if (!gameState.attachments.laser) {
        if (gameState.cash >= 150) {
          gameState.cash -= 150;
          gameState.attachments.laser = true;
          playSound('buy');
          showToast('🔦 Tactical Laser Sight Mounted!');
        } else {
          showToast('❌ Not enough cash for Laser Sight!');
        }
      } else {
        gameState.attachments.laser = false;
        showToast('🔦 Tactical Laser Sight Removed.');
      }
      updateFPSWeaponMesh();
      updateUI();
      updateBuyMenuUI();
    });
  }

  sfxToggleBtn.addEventListener('click', () => {
    gameState.sfxMuted = !gameState.sfxMuted;
    sfxToggleBtn.textContent = gameState.sfxMuted ? '🔇 SFX Off' : '🔊 SFX On';
  });
}

function stopAutoFire() {
  if (autoFireInterval) {
    clearInterval(autoFireInterval);
    autoFireInterval = null;
  }
}

function equipWeapon(wpnKey) {
  if (gameState.inventory[wpnKey]) {
    stopAutoFire();
    gameState.equippedWeapon = wpnKey;
    playSound('buy');
    showToast(`🔫 Equipped ${weaponsDef[wpnKey].name}!`);
    updateFPSWeaponMesh();
    updateUI();
    updateBuyMenuUI();
  }
}

function throwGrenade() {
  if (gameState.grenades <= 0) {
    showToast('⚠️ OUT OF GRENADES! Restock in Buy Menu.');
    return;
  }
  if (!gameState.isRoundActive || isPaused || isGameExited) return;

  gameState.grenades -= 1;
  updateUI();
  showToast('💣 GRENADE OUT!');

  // Create Grenade Mesh
  const grenadeGeom = new THREE.SphereGeometry(0.12, 8, 8);
  const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x059669, metalness: 0.8 });
  const grenadeMesh = new THREE.Mesh(grenadeGeom, grenadeMat);

  let startPos = camera.position.clone();
  grenadeMesh.position.copy(startPos);
  scene.add(grenadeMesh);

  const euler = new THREE.Euler(cameraRotation.pitch, cameraRotation.yaw, 0, 'YXZ');
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(euler);

  let throwVelocity = dir.multiplyScalar(0.32);
  throwVelocity.y += 0.12; // upward arc

  let ticks = 0;
  const throwInterval = setInterval(() => {
    ticks += 1;
    grenadeMesh.position.add(throwVelocity);
    throwVelocity.y -= 0.015; // Gravity

    if (grenadeMesh.position.y <= -0.9 || ticks > 40) {
      clearInterval(throwInterval);
      triggerGrenadeExplosion(grenadeMesh.position);
      scene.remove(grenadeMesh);
    }
  }, 30);
}

function triggerGrenadeExplosion(explosionPos) {
  playSound('explosion');

  // Flash explosion light
  const explLight = new THREE.PointLight(0xfbbf24, 8, 12);
  explLight.position.copy(explosionPos);
  scene.add(explLight);

  setTimeout(() => scene.remove(explLight), 300);

  // AOE Damage to enemies within radius
  const explosionRadius = 4.0;
  const rect = renderer.domElement.getBoundingClientRect();

  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const enemy = activeEnemies[i];
    const dist = enemy.mesh.position.distanceTo(explosionPos);
    if (dist <= explosionRadius) {
      const aoeDamage = Math.round(120 * (1 - dist / explosionRadius));
      enemy.hp -= aoeDamage;
      spawnFloatingText(`💥 GRENADE -${aoeDamage}`, rect.width / 2, rect.height / 2, true);

      if (enemy.hp <= 0) {
        scene.remove(enemy.mesh);
        activeEnemies.splice(i, 1);
        const reward = 100 + gameState.round * 20;
        gameState.cash += reward;
        checkRoundStatus();
      } else {
        const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
        enemy.hpBarFill.scale.x = hpRatio;
        enemy.hpBarFill.position.x = -0.29 * (1 - hpRatio);
      }
    }
  }
}

function updateUI() {
  roundDisplay.textContent = `ROUND ${gameState.round}`;
  cashDisplay.textContent = `💵 CASH: $${gameState.cash}`;

  healthText.textContent = `${gameState.health} / ${gameState.maxHealth}`;
  healthBarFill.style.width = `${(gameState.health / gameState.maxHealth) * 100}%`;

  armorText.textContent = `${gameState.armor} / ${gameState.maxArmor}`;
  armorBarFill.style.width = `${(gameState.armor / gameState.maxArmor) * 100}%`;

  const wpnKey = gameState.equippedWeapon;
  hudWeaponName.textContent = weaponsDef[wpnKey].name.toUpperCase();
  ammoClip.textContent = gameState.ammo[wpnKey].clip;
  ammoReserve.textContent = gameState.ammo[wpnKey].reserve === Infinity ? '∞' : gameState.ammo[wpnKey].reserve;
  if (hudGrenades) hudGrenades.textContent = gameState.grenades;

  startRoundBtn.disabled = gameState.isRoundActive;
}

function updateBuyMenuUI() {
  buyMenuCash.textContent = `$${gameState.cash}`;

  // Pistol Button
  buyWpnPistolBtn.textContent = gameState.equippedWeapon === 'pistol' ? 'EQUIPPED' : 'EQUIP';
  buyWpnPistolBtn.className = `buy-item-btn ${gameState.equippedWeapon === 'pistol' ? 'equipped' : ''}`;

  // Shotgun Button
  if (!gameState.inventory.shotgun) {
    buyWpnShotgunBtn.textContent = 'BUY ($500)';
    buyWpnShotgunBtn.className = 'buy-item-btn';
    buyWpnShotgunBtn.disabled = gameState.cash < 500;
  } else {
    buyWpnShotgunBtn.textContent = gameState.equippedWeapon === 'shotgun' ? 'EQUIPPED' : 'EQUIP';
    buyWpnShotgunBtn.className = `buy-item-btn ${gameState.equippedWeapon === 'shotgun' ? 'equipped' : ''}`;
    buyWpnShotgunBtn.disabled = false;
  }

  // Rifle Button
  if (!gameState.inventory.rifle) {
    buyWpnRifleBtn.textContent = 'BUY ($1,200)';
    buyWpnRifleBtn.className = 'buy-item-btn';
    buyWpnRifleBtn.disabled = gameState.cash < 1200;
  } else {
    buyWpnRifleBtn.textContent = gameState.equippedWeapon === 'rifle' ? 'EQUIPPED' : 'EQUIP';
    buyWpnRifleBtn.className = `buy-item-btn ${gameState.equippedWeapon === 'rifle' ? 'equipped' : ''}`;
    buyWpnRifleBtn.disabled = false;
  }

  // Red Dot Attachment Button
  if (buyAttReddotBtn) {
    if (gameState.attachments.reddot) {
      buyAttReddotBtn.textContent = 'MOUNTED (REMOVE)';
      buyAttReddotBtn.className = 'buy-item-btn equipped';
      buyAttReddotBtn.disabled = false;
    } else {
      buyAttReddotBtn.textContent = 'BUY ($200)';
      buyAttReddotBtn.className = 'buy-item-btn';
      buyAttReddotBtn.disabled = gameState.cash < 200;
    }
  }

  // Laser Attachment Button
  if (buyAttLaserBtn) {
    if (gameState.attachments.laser) {
      buyAttLaserBtn.textContent = 'MOUNTED (REMOVE)';
      buyAttLaserBtn.className = 'buy-item-btn equipped';
      buyAttLaserBtn.disabled = false;
    } else {
      buyAttLaserBtn.textContent = 'BUY ($150)';
      buyAttLaserBtn.className = 'buy-item-btn';
      buyAttLaserBtn.disabled = gameState.cash < 150;
    }
  }
}

function spawnFloatingText(text, x, y, isDamage = false) {
  const el = document.createElement('div');
  el.className = `floating-number ${isDamage ? 'golden' : ''}`;
  el.textContent = text;
  el.style.left = `${Math.min(Math.max(x - 15, 10), canvasContainer.clientWidth - 50)}px`;
  el.style.top = `${Math.min(Math.max(y - 15, 10), canvasContainer.clientHeight - 30)}px`;
  floatingContainer.appendChild(el);

  setTimeout(() => el.remove(), 800);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => { toast.remove(); }, 3500);
}

function onWindowResize() {
  const container = canvasContainer;
  if (!container || !renderer || !camera) return;
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Start Game
init();
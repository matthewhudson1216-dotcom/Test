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
    smg: false,
    shotgun: false,
    rifle: false
  },
  attachments: {
    reddot: false,
    laser: false
  },
  equippedWeapon: 'pistol',
  grenades: 2,
  xp: 0,
  rank: 'CADET',
  camos: { black: true, urban: true, gold: false },
  equippedCamo: 'black',
  swatPartnerMode: 'squad',
  ammo: {
    pistol: { clip: 12, maxClip: 12, reserve: Infinity },
    smg: { clip: 30, maxClip: 30, reserve: 120 },
    shotgun: { clip: 6, maxClip: 6, reserve: 24 },
    rifle: { clip: 30, maxClip: 30, reserve: 90 }
  }
};

let isAimingDownSights = false;
let isReloadingAnimation = 0; // 0 to 1
let isSprinting = false;
let isHoldingBreath = false;
let adsSwayTimer = 0;
let isJumping = false;
let playerYVel = 0;
let knifeAnimFrame = 0;
let knifeAnimDuration = 38;
let knifeDamageTriggered = false;

// Weapon Stats Definition
const weaponsDef = {
  pistol: { name: 'Service Pistol', damage: 25, speed: 0.5, color: 0x38bdf8, reloadTime: 1200, isAuto: false },
  smg: { name: 'Tactical SMG', damage: 20, speed: 0.7, color: 0x10b981, reloadTime: 1200, isAuto: true, fireRateMs: 95 },
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

// Crouch & Tactical Flashlight State
let isCrouched = false;
let cameraHeightOffset = 1.2; // Standing: 1.2, Crouched: 0.6
let isFlashlightOn = false;
let tacticalFlashlight = null;

let keysPressed = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
const moveSpeed = 0.08;
let mouseSensitivity = parseFloat(localStorage.getItem('cop_sens') || '1.0') * 0.002;
let baseFOV = parseInt(localStorage.getItem('cop_fov') || '65', 10);
let masterVolume = parseInt(localStorage.getItem('cop_vol_master') || '100', 10) / 100;
let sfxVolume = parseInt(localStorage.getItem('cop_vol') || '100', 10) / 100;
let voiceVolume = parseInt(localStorage.getItem('cop_vol_voice') || '100', 10) / 100;
let musicVolume = parseInt(localStorage.getItem('cop_vol_music') || '100', 10) / 100;

// Web Audio API Sound Synthesizer
let audioCtx = null;

let audioListener = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (camera && !audioListener && window.THREE && THREE.AudioListener) {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
  }
}

function playVoiceCallout(calloutType) {
  if (gameState.sfxMuted || sfxVolume <= 0) return;
  initAudio();

  const phrases = {
    swat_reload: 'Cover me, reloading!',
    swat_cover: 'Moving up, providing cover fire!',
    swat_down: 'Suspect neutralized!',
    robber_flank: 'Flank the police officers!',
    robber_fire: 'Taking heavy fire!'
  };

  const text = phrases[calloutType] || calloutType;
  showToast(`🗣️ "${text}"`);

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = Math.min(1.0, sfxVolume * masterVolume * voiceVolume);
      utterance.pitch = calloutType.startsWith('swat') ? 0.95 : 0.75;
      utterance.rate = 1.15;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.log('Speech synthesis error:', e);
    }
  }
}

function playSound(type) {
  if (gameState.sfxMuted || sfxVolume <= 0) return;
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const volMult = sfxVolume * masterVolume;

  const now = audioCtx.currentTime;

  if (type === 'pistol') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(0.25 * volMult, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'shell') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04);
    gain.gain.setValueAtTime(0.12 * volMult, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
    osc.start(now);
    osc.stop(now + 0.04);
  } else if (type === 'flashlight') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(1200, now + 0.02);
    gain.gain.setValueAtTime(0.15 * volMult, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
    osc.start(now);
    osc.stop(now + 0.03);
  } else if (type === 'pin') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    gain.gain.setValueAtTime(0.2 * volMult, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'map') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(880, now + 0.05);
    gain.gain.setValueAtTime(0.15 * volMult, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
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
  } else if (type === 'smg') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.045);
    gain.gain.setValueAtTime(0.22 * volMult, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);
    osc.start(now);
    osc.stop(now + 0.045);
  } else if (type === 'knife') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
    gain.gain.setValueAtTime(0.25 * volMult, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  }
}

// DOM Elements
const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas ? radarCanvas.getContext('2d') : null;
const largeMapCanvas = document.getElementById('large-tactical-map');
const largeMapCtx = largeMapCanvas ? largeMapCanvas.getContext('2d') : null;
const tacticalMapModal = document.getElementById('tactical-map-modal');
const closeMapBtn = document.getElementById('close-map-btn');
const dynamicCrosshair = document.getElementById('dynamic-crosshair');

// Settings Sliders DOM
const settingSens = document.getElementById('setting-sens');
const settingFov = document.getElementById('setting-fov');
const settingVol = document.getElementById('setting-vol');
const valSens = document.getElementById('val-sens');
const valFov = document.getElementById('val-fov');
const valVol = document.getElementById('val-vol');

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
const mainPauseTriggerBtn = document.getElementById('main-pause-trigger-btn');
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
const buyGrenadesBtn = document.getElementById('buy-grenades');
const buyAttReddotBtn = document.getElementById('buy-att-reddot');
const buyAttLaserBtn = document.getElementById('buy-att-laser');

const toastContainer = document.getElementById('toast-container');

// Three.js Variables
let scene, camera, renderer;
let copPlayerMesh;
let cityGroup;
let policeSirenLightRed, policeSirenLightBlue;
let ambientLight;
let isNVGOn = false;
const nvgOverlayEl = document.getElementById('nvg-overlay');

let activeEnemies = [];
let activeProjectiles = [];
let activeSmokeClouds = [];
let barricadeObstacles = [];
let currentMap = 'street';
let obstacleMeshes = [];
let destructibleMeshes = [];
let swatPartnerMesh = null;
let swatPartnerTimer = 0;
let enemiesToSpawnInRound = 0;
let raycaster, mouse;
let roundStats = { shotsFired: 0, shotsHit: 0, headshots: 0, damageDealt: 0, cashEarned: 0 };
const roundStatsModal = document.getElementById('round-stats-modal');
const closeStatsBtn = document.getElementById('close-stats-btn');
let isGameStarted = false;
let isReloading = false;
let isVaultDefenseActive = false;
let vaultHp = 500;
let vaultMesh = null;
let lastRadioTime = 0;

function playRadioChatter(messageText) {
  if (gameState.sfxMuted || sfxVolume <= 0 || masterVolume <= 0) return;
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const now = audioCtx.currentTime;
  if (now - lastRadioTime < 3.0) return;
  lastRadioTime = now;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.setValueAtTime(800, now + 0.04);
  gain.gain.setValueAtTime(0.12 * sfxVolume * masterVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.08);

  if (messageText) {
    showToast(`📻 [DISPATCH]: "${messageText}"`);
  }
}
const mainMenuModal = document.getElementById('main-menu-modal');
const startGameBtn = document.getElementById('start-game-btn');

// FPS 3D Weapon Variables
let fpsWeaponGroup;
let fpsKnifeMesh;
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

  camera = new THREE.PerspectiveCamera(baseFOV, width / height, 0.1, 1000);
  updateCameraTransform();

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  ambientLight = new THREE.AmbientLight(0xffffff, isNVGOn ? 2.8 : 0.5);
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
  createSwatPartner();
  initFPSWeaponGroup();

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  window.addEventListener('resize', onWindowResize);
  animate();
}

function createFPSKnifeMesh() {
  const knifeGroup = new THREE.Group();

  const handleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });

  // Handle / Grip
  const handleGeom = new THREE.BoxGeometry(0.035, 0.2, 0.045);
  const handleMesh = new THREE.Mesh(handleGeom, handleMat);
  handleMesh.position.y = -0.1;
  knifeGroup.add(handleMesh);

  // Guard
  const guardGeom = new THREE.BoxGeometry(0.08, 0.025, 0.05);
  const guardMesh = new THREE.Mesh(guardGeom, guardMat);
  guardMesh.position.y = 0.01;
  knifeGroup.add(guardMesh);

  // Blade
  const bladeGeom = new THREE.BoxGeometry(0.015, 0.32, 0.055);
  const bladeMesh = new THREE.Mesh(bladeGeom, bladeMat);
  bladeMesh.position.set(0, 0.17, 0);
  knifeGroup.add(bladeMesh);

  knifeGroup.visible = false;
  return knifeGroup;
}

function initFPSWeaponGroup() {
  fpsWeaponGroup = new THREE.Group();
  camera.add(fpsWeaponGroup);
  scene.add(camera);

  // Muzzle flash point light
  muzzleFlashPoint = new THREE.PointLight(0xfbbf24, 0, 4);
  fpsWeaponGroup.add(muzzleFlashPoint);

  // Tactical Weapon Flashlight (SpotLight attached to camera)
  tacticalFlashlight = new THREE.SpotLight(0xffffff, 0, 25, Math.PI / 6, 0.4, 1);
  tacticalFlashlight.position.set(0, 0, 0);
  tacticalFlashlight.target.position.set(0, 0, -1);
  camera.add(tacticalFlashlight);
  camera.add(tacticalFlashlight.target);

  // Create 3D FPS Combat Knife Mesh
  fpsKnifeMesh = createFPSKnifeMesh();
  fpsWeaponGroup.add(fpsKnifeMesh);

  updateFPSWeaponMesh();
}

function updateFPSWeaponMesh() {
  if (!fpsWeaponGroup) return;

  if (currentWeaponMesh) {
    fpsWeaponGroup.remove(currentWeaponMesh);
  }

  const type = gameState.equippedWeapon;
  const group = new THREE.Group();

  let wpnCamoTex;
  if (gameState.equippedCamo === 'urban') {
    wpnCamoTex = createWeaponTexture('#64748b', '#334155');
  } else if (gameState.equippedCamo === 'gold') {
    wpnCamoTex = createWeaponTexture('#fbbf24', '#d97706');
  } else {
    wpnCamoTex = createWeaponTexture('#1e293b', '#0f172a');
  }
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
    } else if (type === 'smg') {
      sightGroup.position.set(0, 0.09, -0.18);
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
  } else if (type === 'smg') {
    // Tactical SMG Model
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.32), darkMetalMat);
    body.position.set(0, 0.03, -0.1);
    group.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8), gunMetalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, -0.3);
    group.add(barrel);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.08), darkMetalMat);
    mag.position.set(0, -0.1, -0.08);
    mag.rotation.x = 0.15;
    group.add(mag);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), gripMat);
    grip.position.set(0, -0.08, 0.02);
    grip.rotation.x = -0.25;
    group.add(grip);

    group.position.set(0.22, -0.2, -0.42);
    muzzleFlashPoint.position.set(0.22, -0.14, -0.78);
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

  // Smoothly interpolate camera height between crouching, standing, and jumping
  const targetOffset = isCrouched ? 0.55 : 1.2;
  cameraHeightOffset += (targetOffset - cameraHeightOffset) * 0.25;

  camera.position.set(playerPos.x, playerPos.y + cameraHeightOffset, playerPos.z + 0.5);

  // Calculate look direction from yaw and pitch angles
  const euler = new THREE.Euler(cameraRotation.pitch, cameraRotation.yaw, 0, 'YXZ');
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);

  camera.lookAt(camera.position.clone().add(forward));

  if (copPlayerMesh) {
    copPlayerMesh.position.set(playerPos.x, playerPos.y, playerPos.z);
    copPlayerMesh.rotation.y = cameraRotation.yaw;
  }
}

function updateSwatPartnerVisibility() {
  if (gameState.swatPartnerMode === 'solo') {
    if (swatPartnerMesh) swatPartnerMesh.visible = false;
  } else {
    if (!swatPartnerMesh) createSwatPartner();
    if (swatPartnerMesh) swatPartnerMesh.visible = true;
  }
}

function createSwatPartner() {
  if (!scene) return;
  if (swatPartnerMesh) scene.remove(swatPartnerMesh);

  const swatGroup = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.3 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.4 });

  // Body
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), vestMat);
  bodyMesh.position.y = 0.35;
  swatGroup.add(bodyMesh);

  // Helmet
  const helmetMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), helmetMat);
  helmetMesh.position.y = 0.88;
  swatGroup.add(helmetMesh);

  // Legs
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.2), suitMat);
  legL.position.set(-0.14, -0.25, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.2), suitMat);
  legR.position.set(0.14, -0.25, 0);
  swatGroup.add(legL);
  swatGroup.add(legR);

  // Rifle Prop
  const rifleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), helmetMat);
  rifleMesh.position.set(0.25, 0.35, -0.3);
  swatGroup.add(rifleMesh);

  swatGroup.position.set(playerPos.x - 1.5, -0.9, playerPos.z + 1);
  swatGroup.visible = gameState.swatPartnerMode !== 'solo';
  scene.add(swatGroup);
  swatPartnerMesh = swatGroup;
}

function createCopPlayerMesh() {
  if (copPlayerMesh) scene.remove(copPlayerMesh);

  const swatGroup = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.3 });
  const badgeMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.1 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.9 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });

  // Torso / SWAT Vest
  const torsoGeom = new THREE.BoxGeometry(0.5, 0.6, 0.3);
  const torsoMesh = new THREE.Mesh(torsoGeom, vestMat);
  torsoMesh.position.y = -0.3;
  swatGroup.add(torsoMesh);

  // Police Badge on Chest
  const badgeGeom = new THREE.BoxGeometry(0.08, 0.1, 0.02);
  const badgeMesh = new THREE.Mesh(badgeGeom, badgeMat);
  badgeMesh.position.set(-0.15, -0.2, 0.16);
  swatGroup.add(badgeMesh);

  // Utility Belt
  const beltGeom = new THREE.BoxGeometry(0.52, 0.08, 0.32);
  const beltMesh = new THREE.Mesh(beltGeom, bootMat);
  beltMesh.position.y = -0.62;
  swatGroup.add(beltMesh);

  // Holster on right thigh
  const holsterGeom = new THREE.BoxGeometry(0.12, 0.2, 0.12);
  const holsterMesh = new THREE.Mesh(holsterGeom, bootMat);
  holsterMesh.position.set(0.28, -0.75, 0);
  swatGroup.add(holsterMesh);

  // Left Leg & Boot
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.2), suitMat);
  legL.position.set(-0.14, -0.92, 0);
  const padL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.06), padMat);
  padL.position.set(-0.14, -0.88, 0.1);
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.28), bootMat);
  bootL.position.set(-0.14, -1.22, 0.04);
  swatGroup.add(legL);
  swatGroup.add(padL);
  swatGroup.add(bootL);

  // Right Leg & Boot
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.2), suitMat);
  legR.position.set(0.14, -0.92, 0);
  const padR = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.06), padMat);
  padR.position.set(0.14, -0.88, 0.1);
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.28), bootMat);
  bootR.position.set(0.14, -1.22, 0.04);
  swatGroup.add(legR);
  swatGroup.add(padR);
  swatGroup.add(bootR);

  swatGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
  scene.add(swatGroup);
  copPlayerMesh = swatGroup;
}

const rankBadgeEl = document.getElementById('rank-badge');

function addXP(amount) {
  gameState.xp += amount;
  let newRank = '🎖️ CADET';
  if (gameState.xp >= 1800) newRank = '👑 TACTICAL COMMANDER';
  else if (gameState.xp >= 800) newRank = '🛡️ SWAT SPECIALIST';
  else if (gameState.xp >= 300) newRank = '👮 PATROL OFFICER';

  if (gameState.rank !== newRank) {
    gameState.rank = newRank;
    showToast(`🎉 RANK PROMOTION: You are now a ${newRank}!`);
    playVoiceCallout('swat_cover');
  }

  if (rankBadgeEl) rankBadgeEl.textContent = gameState.rank;
  showToast(`⭐ +${amount} XP GAINED!`);
}

// Procedural Canvas Texture Generator Helpers
function createAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark asphalt base
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, 512, 512);

  // Micro-texture asphalt grain & noise specks
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = Math.random();
    ctx.fillStyle = shade < 0.4 ? '#1e293b' : (shade < 0.8 ? '#050811' : '#334155');
    ctx.fillRect(x, y, 2, 2);
  }

  // Sidewalk curb borders on edges
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 32, 512);
  ctx.fillRect(480, 0, 32, 512);

  // Curb tile division lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  for (let y = 0; y <= 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(32, y);
    ctx.moveTo(480, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Yellow double center lane divider
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 6;
  ctx.setLineDash([32, 32]);

  ctx.beginPath();
  ctx.moveTo(250, 0);
  ctx.lineTo(250, 512);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(262, 0);
  ctx.lineTo(262, 512);
  ctx.stroke();

  // White crosswalk pedestrian stripes
  ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.setLineDash([]);
  for (let x = 60; x <= 420; x += 36) {
    ctx.fillRect(x, 220, 20, 72);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createBuildingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Concrete building base color
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 512, 512);

  // Architectural panel bevels / dark grid borders
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 6;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Architectural trim ledges
  ctx.fillStyle = '#475569';
  for (let y = 0; y < 512; y += 128) {
    ctx.fillRect(0, y, 512, 10);
  }

  // Glowing window squares with metallic frames & varied lighting
  for (let x = 12; x < 512; x += 64) {
    for (let y = 16; y < 512; y += 64) {
      // Window frame border
      ctx.fillStyle = '#334155';
      ctx.fillRect(x - 2, y - 2, 42, 38);

      const rand = Math.random();
      if (rand < 0.7) {
        // Lit window (blue, cyan, or warm amber glow)
        if (rand < 0.25) ctx.fillStyle = '#38bdf8';
        else if (rand < 0.5) ctx.fillStyle = '#fbbf24';
        else ctx.fillStyle = '#0284c7';
      } else {
        // Unlit window reflect
        ctx.fillStyle = '#050811';
      }
      ctx.fillRect(x, y, 38, 34);

      // Glass inner reflection line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 28);
      ctx.lineTo(x + 24, y + 4);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createWeaponTexture(baseHex, camoHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Tactical camo speckles
  ctx.fillStyle = camoHex;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 12 + Math.random() * 24;
    const h = 8 + Math.random() * 18;
    ctx.fillRect(x, y, w, h);
  }

  // Metallic scratch details
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    ctx.lineTo(Math.random() * 256, Math.random() * 256);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function createProceduralCity() {
  if (cityGroup) scene.remove(cityGroup);
  cityGroup = new THREE.Group();
  obstacleMeshes = [];
  destructibleMeshes = [];

  if (currentMap === 'bank') {
    // 🏦 First National Bank Interior Map
    const floorGeom = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.2 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    cityGroup.add(floor);

    // Marble Pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
    for (let px = -10; px <= 10; px += 10) {
      for (let pz = -14; pz <= 2; pz += 8) {
        if (px === 0 && pz === -6) continue;
        const pGeom = new THREE.CylinderGeometry(0.5, 0.5, 5, 16);
        const pMesh = new THREE.Mesh(pGeom, pillarMat);
        pMesh.position.set(px, 1.3, pz);
        cityGroup.add(pMesh);
        obstacleMeshes.push(pMesh);
      }
    }

    // Destructible Glass Teller Partitions
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, roughness: 0.1 });
    for (let gx = -6; gx <= 6; gx += 4) {
      const gGeom = new THREE.BoxGeometry(1.8, 1.2, 0.1);
      const gMesh = new THREE.Mesh(gGeom, glassMat);
      gMesh.position.set(gx, -0.6, -4);
      gMesh.userData = { isDestructible: true, hp: 40, destructColor: 0x38bdf8 };
      cityGroup.add(gMesh);
      obstacleMeshes.push(gMesh);
      destructibleMeshes.push(gMesh);
    }
  } else if (currentMap === 'range') {
    // 🎯 Tactical Shooting Range Map
    const floorGeom = new THREE.PlaneGeometry(30, 40);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    cityGroup.add(floor);

    // Target Dummies at 5m, 10m, 15m, 20m
    const distances = [-5, -10, -15, -20];
    distances.forEach((dist, idx) => {
      const dummyGroup = new THREE.Group();

      // Wooden Post
      const postGeom = new THREE.BoxGeometry(0.15, 1.8, 0.15);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const post = new THREE.Mesh(postGeom, postMat);
      dummyGroup.add(post);

      // Target Ring
      const ringGeom = new THREE.CircleGeometry(0.5, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(0, 0.4, 0.08);
      dummyGroup.add(ring);

      const centerGeom = new THREE.CircleGeometry(0.2, 16);
      const centerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const center = new THREE.Mesh(centerGeom, centerMat);
      center.position.set(0, 0.4, 0.09);
      dummyGroup.add(center);

      dummyGroup.position.set((idx % 2 === 0 ? -2 : 2), -0.3, dist);
      dummyGroup.userData = { isTargetDummy: true };
      cityGroup.add(dummyGroup);
      obstacleMeshes.push(dummyGroup);
    });

    showToast('🎯 SHOOTING RANGE: Practice weapon recoil & aim on moving targets!');
  } else if (currentMap === 'warehouse') {
    // 🏭 Industrial Warehouse Map
    const floorGeom = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    cityGroup.add(floor);

    // Shipping Containers
    const containerMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.3 });
    for (let cx = -12; cx <= 12; cx += 8) {
      const cGeom = new THREE.BoxGeometry(2.4, 2.4, 5.0);
      const cMesh = new THREE.Mesh(cGeom, containerMat);
      cMesh.position.set(cx, 0, -8);
      cityGroup.add(cMesh);
      obstacleMeshes.push(cMesh);
    }

    // Destructible Wooden Crates
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });
    for (let bx = -8; bx <= 8; bx += 3.5) {
      const crateGeom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const crateMesh = new THREE.Mesh(crateGeom, crateMat);
      crateMesh.position.set(bx, -0.6, -3);
      crateMesh.userData = { isDestructible: true, hp: 60, destructColor: 0xd97706 };
      cityGroup.add(crateMesh);
      obstacleMeshes.push(crateMesh);
      destructibleMeshes.push(crateMesh);
    }
  } else {
    // 🏙️ Precinct Plaza Street (Default)
    const asphaltTex = createAsphaltTexture();
    const buildingTex = createBuildingTexture();

    const groundGeom = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.7 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    cityGroup.add(ground);

    const buildingMat = new THREE.MeshStandardMaterial({ map: buildingTex, metalness: 0.5, roughness: 0.4 });
    for (let x = -20; x <= 20; x += 3.8) {
      for (let z = -20; z <= 4; z += 3.8) {
        if (Math.abs(x) < 3.2 && z > -6) continue;
        const h = 3.0 + Math.random() * 7.0;
        const bGeom = new THREE.BoxGeometry(2.6, h, 2.6);
        const bMesh = new THREE.Mesh(bGeom, buildingMat);
        bMesh.position.set(x + (Math.random() - 0.5) * 0.4, -1.2 + h / 2, z + (Math.random() - 0.5) * 0.4);
        cityGroup.add(bMesh);
        obstacleMeshes.push(bMesh);
      }
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
    obstacleMeshes.push(wallMesh);

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
    obstacleMeshes.push(body);

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

let lastGamepadButtonState = {};

function updateGamepadInput() {
  if (!navigator.getGamepads) return;
  const gamepads = navigator.getGamepads();
  if (!gamepads) return;

  for (let i = 0; i < gamepads.length; i++) {
    const gp = gamepads[i];
    if (gp && gp.connected) {
      const deadzone = 0.15;

      // Left Thumbstick (Movement: X, Z)
      const lx = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
      const ly = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0;

      // Right Thumbstick (Camera Look: Yaw, Pitch)
      const rx = Math.abs(gp.axes[2]) > deadzone ? gp.axes[2] : 0;
      const ry = Math.abs(gp.axes[3]) > deadzone ? gp.axes[3] : 0;

      if (rx !== 0) cameraRotation.yaw -= rx * 0.03;
      if (ry !== 0) {
        cameraRotation.pitch -= ry * 0.03;
        cameraRotation.pitch = Math.max(-1.4, Math.min(1.4, cameraRotation.pitch));
      }

      // Movement application
      if (lx !== 0 || ly !== 0) {
        const euler = new THREE.Euler(0, cameraRotation.yaw, 0, 'YXZ');
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);

        const moveSpeed = (isSprinting ? 0.18 : 0.1) * (isCrouched ? 0.5 : 1.0);
        playerPos.x += (forward.x * -ly + right.x * lx) * moveSpeed;
        playerPos.z += (forward.z * -ly + right.z * lx) * moveSpeed;
      }

      // Triggers: R2 Fire (7), L2 ADS (6)
      if (gp.buttons[7] && gp.buttons[7].pressed) {
        if (!lastGamepadButtonState['r2']) {
          lastGamepadButtonState['r2'] = true;
          handleShooterClick();
        }
      } else {
        lastGamepadButtonState['r2'] = false;
      }

      isAimingDownSights = gp.buttons[6] && gp.buttons[6].pressed;

      // Buttons: A (0 Jump), B (1 Crouch), X (2 Reload), Y (3 Knife)
      if (gp.buttons[0] && gp.buttons[0].pressed && !lastGamepadButtonState['a']) {
        lastGamepadButtonState['a'] = true;
        if (!isJumping && playerPos.y <= -0.89) {
          isJumping = true;
          playerYVel = 0.22;
        }
      } else if (!gp.buttons[0] || !gp.buttons[0].pressed) {
        lastGamepadButtonState['a'] = false;
      }

      if (gp.buttons[1] && gp.buttons[1].pressed && !lastGamepadButtonState['b']) {
        lastGamepadButtonState['b'] = true;
        toggleCrouch();
      } else if (!gp.buttons[1] || !gp.buttons[1].pressed) {
        lastGamepadButtonState['b'] = false;
      }

      if (gp.buttons[2] && gp.buttons[2].pressed && !lastGamepadButtonState['x']) {
        lastGamepadButtonState['x'] = true;
        reloadWeapon();
      } else if (!gp.buttons[2] || !gp.buttons[2].pressed) {
        lastGamepadButtonState['x'] = false;
      }

      if (gp.buttons[3] && gp.buttons[3].pressed && !lastGamepadButtonState['y']) {
        lastGamepadButtonState['y'] = true;
        performQuickMeleeKnife();
      } else if (!gp.buttons[3] || !gp.buttons[3].pressed) {
        lastGamepadButtonState['y'] = false;
      }

      break;
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (!isGameStarted) {
    // Cinematic background camera orbit on main menu screen
    const time = Date.now() * 0.0003;
    if (camera) {
      camera.position.x = Math.sin(time) * 12;
      camera.position.z = Math.cos(time) * 12;
      camera.position.y = 2.5;
      camera.lookAt(0, 0, -5);
    }
    renderer.render(scene, camera);
    return;
  }

  // Animate Shooting Range Target Dummies
  if (currentMap === 'range') {
    obstacleMeshes.forEach(obs => {
      if (obs.userData && obs.userData.isTargetDummy) {
        obs.position.x += Math.sin(Date.now() * 0.003) * 0.015;
      }
    });
  }

  // Animate active Smoke Clouds
  for (let i = activeSmokeClouds.length - 1; i >= 0; i--) {
    const cloud = activeSmokeClouds[i];
    cloud.life -= 1;
    cloud.mesh.scale.addScalar(0.003);
    if (cloud.life <= 0) {
      scene.remove(cloud.mesh);
      activeSmokeClouds.splice(i, 1);
    }
  }
  updateGamepadInput();

  // Update SWAT AI Squadmate
  if (swatPartnerMesh && gameState.isRoundActive && gameState.swatPartnerMode !== 'solo') {
    swatPartnerTimer++;

    // Target closest enemy in Line-of-Sight
    const swatEye = swatPartnerMesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    let closestEnemy = null;
    let closestDist = Infinity;

    activeEnemies.forEach(enemy => {
      const enemyEye = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));
      const d = swatPartnerMesh.position.distanceTo(enemy.mesh.position);
      if (d < closestDist && hasLineOfSight(swatEye, enemyEye)) {
        closestDist = d;
        closestEnemy = enemy;
      }
    });

    // Independent Tactical Navigation Movement
    let swatMoveTarget = null;
    if (closestEnemy) {
      const distToEnemy = swatPartnerMesh.position.distanceTo(closestEnemy.mesh.position);
      if (distToEnemy > 4.5) {
        swatMoveTarget = closestEnemy.mesh.position.clone();
      }
    } else {
      const patrolX = Math.sin(swatPartnerTimer * 0.02) * 5.0;
      const patrolZ = -4.0 + Math.cos(swatPartnerTimer * 0.02) * 3.0;
      swatMoveTarget = new THREE.Vector3(patrolX, -0.9, patrolZ);
    }

    if (swatMoveTarget) {
      const swatDir = swatMoveTarget.clone().sub(swatPartnerMesh.position);
      swatDir.y = 0;
      if (swatDir.length() > 0.5) {
        swatDir.normalize();
        const swatSpeed = 0.04;
        const nextSwatPos = swatPartnerMesh.position.clone().addScaledVector(swatDir, swatSpeed);

        let blocked = false;
        barricadeObstacles.forEach(box => {
          if (nextSwatPos.x >= box.min.x - 0.3 && nextSwatPos.x <= box.max.x + 0.3 &&
              nextSwatPos.z >= box.min.z - 0.3 && nextSwatPos.z <= box.max.z + 0.3) {
            blocked = true;
          }
        });

        if (!blocked) {
          swatPartnerMesh.position.copy(nextSwatPos);
        }
      }
    }

    if (closestEnemy && closestDist < 18) {
      swatPartnerMesh.lookAt(closestEnemy.mesh.position);

      if (swatPartnerTimer % 45 === 0) {
        const enemyEye = closestEnemy.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));

        fireBulletTracerFromEnemy(swatEye, enemyEye, 0x38bdf8);
        closestEnemy.hp -= 18;
        closestEnemy.hitRecoil = 0.8;
        playSound('pistol');

        if (swatPartnerTimer % 180 === 0) {
          playVoiceCallout('swat_cover');
        }

        if (closestEnemy.hp <= 0) {
          scene.remove(closestEnemy.mesh);
          const idx = activeEnemies.indexOf(closestEnemy);
          if (idx !== -1) activeEnemies.splice(idx, 1);
          checkRoundStatus();
        } else {
          const hpRatio = Math.max(0, closestEnemy.hp / closestEnemy.maxHp);
          closestEnemy.hpBarFill.scale.x = hpRatio;
          closestEnemy.hpBarFill.position.x = -0.29 * (1 - hpRatio);
        }
      }
    }
  }

  // Smooth weapon recoil decay & movement weapon bobbing
  if (weaponRecoil > 0) weaponRecoil *= 0.82;
  if (muzzleFlashPoint && muzzleFlashPoint.intensity > 0) muzzleFlashPoint.intensity *= 0.7;

  // Dynamic Crosshair Spread based on Movement, Crouching, & Recoil
  let moveActive = keysPressed.KeyW || keysPressed.Keyw || keysPressed.KeyS || keysPressed.Keys || keysPressed.KeyA || keysPressed.Keya || keysPressed.KeyD || keysPressed.Keyd;
  let baseSpread = moveActive ? 12 : 0;
  if (isCrouched) baseSpread = Math.max(0, baseSpread - 6);
  updateDynamicCrosshair(baseSpread + weaponRecoil * 18);

  // Update Camera position height smoothly during Crouch & Jump transitions
  updateCameraTransform();

  // Handle Jump Physics (Y Position & Velocity)
  if (isJumping || playerPos.y > -0.9) {
    playerPos.y += playerYVel;
    playerYVel -= 0.015; // Gravity
    if (playerPos.y <= -0.9) {
      playerPos.y = -0.9;
      playerYVel = 0;
      isJumping = false;
    }
  }

  // Handle WASD Keyboard Movement (Relative to Camera Yaw Direction)
  if (!isPaused && !isGameExited) {
    let moveX = 0;
    let moveZ = 0;

    if (keysPressed.KeyW || keysPressed.Keyw) moveZ -= 1;
    if (keysPressed.KeyS || keysPressed.Keys) moveZ += 1;
    if (keysPressed.KeyA || keysPressed.Keya) moveX -= 1;
    if (keysPressed.KeyD || keysPressed.Keyd) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      let activeSpeed = isCrouched ? moveSpeed * 0.5 : moveSpeed;
      if (isSprinting && !isCrouched) activeSpeed *= 1.7;

      weaponBob += isCrouched ? 0.07 : (isSprinting ? 0.2 : 0.12);
      if (Math.sin(weaponBob) > 0.95) {
        playSound('footstep');
      }
      const moveVec = new THREE.Vector3(moveX, 0, moveZ).normalize().multiplyScalar(activeSpeed);
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

  // Handle ADS Camera FOV Zoom & Sprint FOV Expansion
  let targetFov = baseFOV;
  if (isAimingDownSights) {
    targetFov = Math.min(38, baseFOV - 15);
  } else if (isSprinting && (keysPressed.KeyW || keysPressed.Keyw)) {
    targetFov = baseFOV + 8;
  }
  camera.fov += (targetFov - camera.fov) * 0.2;
  camera.updateProjectionMatrix();

  // Handle Weapon Reload Rotation Animation
  if (isReloading) {
    isReloadingAnimation = Math.min(1.0, isReloadingAnimation + 0.08);
  } else {
    isReloadingAnimation = Math.max(0, isReloadingAnimation - 0.08);
  }

  // Apply weapon recoil, bob, ADS centering, reload tilt, & knife slash animation
  if (currentWeaponMesh) {
    const bobOffset = Math.sin(weaponBob) * (isAimingDownSights ? 0.004 : 0.015);
    const sideBobOffset = Math.cos(weaponBob * 0.5) * (isAimingDownSights ? 0.002 : 0.01);

    let gunAnimY = 0;
    let gunAnimX = 0;
    let gunAnimRotX = 0;
    let gunAnimRotZ = 0;

    if (knifeAnimFrame > 0) {
      knifeAnimFrame++;
      const t = knifeAnimFrame / knifeAnimDuration;

      if (t <= 0.28) {
        // Phase 1: Stow active gun & bring knife up
        const p1 = t / 0.28;
        if (gameState.equippedWeapon === 'pistol') {
          gunAnimY = -0.45 * p1;
          gunAnimX = 0.22 * p1;
          gunAnimRotZ = -0.3 * p1;
        } else {
          gunAnimY = -0.5 * p1;
          gunAnimRotX = 1.2 * p1;
          gunAnimRotZ = 0.4 * p1;
        }

        if (fpsKnifeMesh) {
          fpsKnifeMesh.visible = true;
          fpsKnifeMesh.position.set(-0.2 + 0.15 * p1, -0.4 + 0.25 * p1, -0.35);
          fpsKnifeMesh.rotation.set(-0.2, 0.4, -0.6 + 0.6 * p1);
        }
      } else if (t <= 0.62) {
        // Phase 2: Knife Slash Arc Swing across screen
        const p2 = (t - 0.28) / 0.34;

        if (gameState.equippedWeapon === 'pistol') {
          gunAnimY = -0.45;
          gunAnimX = 0.22;
          gunAnimRotZ = -0.3;
        } else {
          gunAnimY = -0.5;
          gunAnimRotX = 1.2;
          gunAnimRotZ = 0.4;
        }

        if (!knifeDamageTriggered && p2 >= 0.2) {
          knifeDamageTriggered = true;
          playSound('knife');
          executeKnifeDamageCheck();
        }

        if (fpsKnifeMesh) {
          fpsKnifeMesh.visible = true;
          fpsKnifeMesh.position.set(-0.15 + 0.38 * p2, -0.15 + Math.sin(p2 * Math.PI) * 0.18, -0.32);
          fpsKnifeMesh.rotation.set(-0.3, 0.5 - p2 * 1.2, 0 + p2 * 2.4);
        }
      } else if (t <= 1.0) {
        // Phase 3: Sheathe knife & unholster/draw gun back into hands
        const p3 = (t - 0.62) / 0.38;

        if (gameState.equippedWeapon === 'pistol') {
          gunAnimY = -0.45 * (1 - p3);
          gunAnimX = 0.22 * (1 - p3);
          gunAnimRotZ = -0.3 * (1 - p3);
        } else {
          gunAnimY = -0.5 * (1 - p3);
          gunAnimRotX = 1.2 * (1 - p3);
          gunAnimRotZ = 0.4 * (1 - p3);
        }

        if (fpsKnifeMesh) {
          fpsKnifeMesh.position.set(0.23, -0.15 - 0.35 * p3, -0.32);
          if (p3 >= 0.9) fpsKnifeMesh.visible = false;
        }
      }

      if (knifeAnimFrame >= knifeAnimDuration) {
        knifeAnimFrame = 0;
        if (fpsKnifeMesh) fpsKnifeMesh.visible = false;
      }
    }

    let adsSwayX = 0;
    let adsSwayY = 0;
    if (isAimingDownSights) {
      adsSwayTimer += isHoldingBreath ? 0.02 : 0.06;
      const swayMult = isHoldingBreath ? 0.001 : 0.006;
      adsSwayX = Math.sin(adsSwayTimer) * swayMult;
      adsSwayY = Math.cos(adsSwayTimer * 2) * swayMult;
    }

    // Target X position: centered (0) in ADS mode, offset to right when hip-firing
    const targetX = isAimingDownSights ? 0 : (gameState.equippedWeapon === 'shotgun' ? 0.26 : 0.24);
    currentWeaponMesh.position.x += (targetX + sideBobOffset + gunAnimX + adsSwayX - currentWeaponMesh.position.x) * 0.2;

    // Adjust Y position during ADS so iron sights / Red Dot Sight align directly with center eye line
    const basePosY = gameState.equippedWeapon === 'shotgun' ? -0.24 : -0.22;
    const adsYOffset = isAimingDownSights ? (gameState.attachments.reddot ? 0.07 : 0.04) : 0;

    currentWeaponMesh.position.y = basePosY + adsYOffset + bobOffset + gunAnimY + adsSwayY - weaponRecoil * 0.06 - isReloadingAnimation * 0.15;
    currentWeaponMesh.position.z = (gameState.equippedWeapon === 'pistol' ? -0.45 : -0.52) + weaponRecoil * 0.12;
    currentWeaponMesh.rotation.x = weaponRecoil * 0.35 + isReloadingAnimation * 0.6 + gunAnimRotX;
    currentWeaponMesh.rotation.y = sideBobOffset * 0.5;
    currentWeaponMesh.rotation.z = weaponRecoil * -0.15 + isReloadingAnimation * -0.4 + gunAnimRotZ;
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

      // Shooter enemy shoots at player periodically ONLY if line-of-sight is not blocked by walls/barricades
      if (enemy.type === 'shooter') {
        enemy.shootCooldown += 1;
        if (enemy.shootCooldown > 120) {
          enemy.shootCooldown = 0;
          const enemyEyePos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));
          const playerEyePos = camera.position.clone();

          if (hasLineOfSight(enemyEyePos, playerEyePos)) {
            fireBulletTracerFromEnemy(enemyEyePos, playerEyePos, 0xef4444);
            damagePlayer(8);
          }
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
        enemy.leftLeg.rotation.x = Math.sin(enemy.walkCycle) * 0.45;
        enemy.rightLeg.rotation.x = -Math.sin(enemy.walkCycle) * 0.45;
        enemy.leftArm.rotation.x = -Math.sin(enemy.walkCycle) * 0.45;
        enemy.rightArm.rotation.x = Math.sin(enemy.walkCycle) * 0.45;
      }

      // Hit recoil physical reaction animation (tilt back on shot)
      if (enemy.hitRecoil && enemy.hitRecoil > 0) {
        enemy.mesh.rotation.x = -enemy.hitRecoil * 0.3;
        enemy.hitRecoil *= 0.8;
        if (enemy.hitRecoil < 0.02) enemy.hitRecoil = 0;
      } else {
        enemy.mesh.rotation.x = 0;
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

  renderRadar();
  renderer.render(scene, camera);
}

function deployEnemySmokeGrenade(pos) {
  if (!scene) return;
  const cloudGroup = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const geom = new THREE.SphereGeometry(1.2 + Math.random() * 0.8, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7, roughness: 0.9 });
    const p = new THREE.Mesh(geom, mat);
    p.position.set((Math.random() - 0.5) * 1.5, Math.random() * 1.0, (Math.random() - 0.5) * 1.5);
    cloudGroup.add(p);
  }
  cloudGroup.position.copy(pos);
  scene.add(cloudGroup);

  const cloudObj = { mesh: cloudGroup, life: 300, pos: pos.clone(), radius: 3.2 };
  activeSmokeClouds.push(cloudObj);
  showToast('💨 ROBBERS DEPLOYED SMOKE SCREEN!');
}

function hasLineOfSight(startPos, endPos) {
  for (let s = 0; s < activeSmokeClouds.length; s++) {
    const cloud = activeSmokeClouds[s];
    if (startPos.distanceTo(cloud.pos) < cloud.radius) return false;
  }

  if (!obstacleMeshes || obstacleMeshes.length === 0) return true;

  const dir = endPos.clone().sub(startPos);
  const distance = dir.length();
  dir.normalize();

  const losRaycaster = new THREE.Raycaster(startPos, dir, 0.05, distance - 0.1);
  const intersects = losRaycaster.intersectObjects(obstacleMeshes, true);

  return intersects.length === 0;
}

function updateDynamicCrosshair(spreadPixels) {
  if (!dynamicCrosshair) return;
  const lines = dynamicCrosshair.querySelectorAll('.ch-line');
  if (lines.length >= 4) {
    const top = lines[0];
    const bottom = lines[1];
    const left = lines[2];
    const right = lines[3];

    top.style.transform = `translate(-50%, -${spreadPixels}px)`;
    bottom.style.transform = `translate(-50%, ${spreadPixels}px)`;
    left.style.transform = `translate(-${spreadPixels}px, -50%)`;
    right.style.transform = `translate(${spreadPixels}px, -50%)`;
  }
}

function renderRadar() {
  if (!radarCtx || !radarCanvas) return;

  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const center = w / 2;
  const scale = 3.5; // World units to pixels

  radarCtx.clearRect(0, 0, w, h);

  // Background grid circle
  radarCtx.save();
  radarCtx.beginPath();
  radarCtx.arc(center, center, center - 2, 0, Math.PI * 2);
  radarCtx.clip();

  radarCtx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  radarCtx.fillRect(0, 0, w, h);

  // Concentric radar sweep rings
  radarCtx.strokeStyle = 'rgba(2, 132, 199, 0.25)';
  radarCtx.lineWidth = 1;
  radarCtx.beginPath();
  radarCtx.arc(center, center, 20, 0, Math.PI * 2);
  radarCtx.arc(center, center, 40, 0, Math.PI * 2);
  radarCtx.stroke();

  // Draw Barricades on Radar
  radarCtx.fillStyle = 'rgba(100, 116, 139, 0.6)';
  barricadeObstacles.forEach(box => {
    const minX = center + (box.min.x - playerPos.x) * scale;
    const minZ = center + (box.min.z - playerPos.z) * scale;
    const boxW = (box.max.x - box.min.x) * scale;
    const boxH = (box.max.y - box.min.y) * scale;
    radarCtx.fillRect(minX, minZ, boxW, boxH);
  });

  // Draw Enemy Blips
  activeEnemies.forEach(enemy => {
    const ex = center + (enemy.mesh.position.x - playerPos.x) * scale;
    const ez = center + (enemy.mesh.position.z - playerPos.z) * scale;

    radarCtx.beginPath();
    radarCtx.arc(ex, ez, enemy.type === 'shield' ? 4 : 3, 0, Math.PI * 2);

    if (enemy.type === 'runner') radarCtx.fillStyle = '#38bdf8';
    else if (enemy.type === 'shield') radarCtx.fillStyle = '#a855f7';
    else radarCtx.fillStyle = '#ef4444';

    radarCtx.fill();
    radarCtx.shadowColor = radarCtx.fillStyle;
    radarCtx.shadowBlur = 6;
  });

  // Draw Player Marker & Direction Vision Cone
  radarCtx.save();
  radarCtx.translate(center, center);
  radarCtx.rotate(-cameraRotation.yaw);

  // FOV Cone
  radarCtx.fillStyle = 'rgba(56, 189, 248, 0.2)';
  radarCtx.beginPath();
  radarCtx.moveTo(0, 0);
  radarCtx.arc(0, 0, 35, -Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4);
  radarCtx.closePath();
  radarCtx.fill();

  // Cop Arrow Marker
  radarCtx.fillStyle = '#34d399';
  radarCtx.beginPath();
  radarCtx.moveTo(0, -6);
  radarCtx.lineTo(-4, 5);
  radarCtx.lineTo(0, 3);
  radarCtx.lineTo(4, 5);
  radarCtx.closePath();
  radarCtx.fill();

  radarCtx.restore();
  radarCtx.restore();
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
  if (document.pointerLockElement !== canvasContainer) {
    if (canvasContainer && buyMenuModal.classList.contains('hidden')) {
      canvasContainer.requestPointerLock();
    }
    return; // Return early on re-focus click so the weapon does NOT fire on re-locking pointer
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

      // Check wall/obstacle intersections
      const wallHits = pelletRaycaster.intersectObjects(obstacleMeshes, true);
      let closestWallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;

      for (let i = activeEnemies.length - 1; i >= 0; i--) {
        const enemy = activeEnemies[i];
        const intersects = pelletRaycaster.intersectObject(enemy.mesh, true);
        if (intersects.length > 0 && intersects[0].distance < closestWallDist) {
          targetPoint = intersects[0].point;
          hitEnemyIndex = i;
          closestWallDist = intersects[0].distance;
          if (intersects[0].object && intersects[0].object.userData.bodyPart) {
            hitBodyPart = intersects[0].object.userData.bodyPart;
          }
        }
      }

      if (hitEnemyIndex === -1 && wallHits.length > 0) {
        targetPoint = wallHits[0].point;
      }

      spawnSparkParticles(targetPoint, wpnDef.color);
      fireBulletTracer(targetPoint, wpnDef.color);

  roundStats.shotsFired += 1;

      if (hitEnemyIndex !== -1) {
        const enemy = activeEnemies[hitEnemyIndex];
    roundStats.shotsHit += 1;
    if (hitBodyPart === 'head') roundStats.headshots += 1;

        let mult = 1.0;
        if (hitBodyPart === 'head') mult = 2.0;
        else if (hitBodyPart === 'limb') mult = 0.75;

        const appliedDamage = Math.round(wpnDef.damage * mult);
        enemy.hp -= appliedDamage;
        enemy.hitRecoil = 1.0;
        spawnBodyHitParticles(targetPoint, hitBodyPart === 'head');

        if (enemy.hp <= 0) {
          scene.remove(enemy.mesh);
          const enemyIdx = activeEnemies.indexOf(enemy);
          if (enemyIdx !== -1) activeEnemies.splice(enemyIdx, 1);
          const reward = 100 + gameState.round * 20;
          gameState.cash += reward;
          addXP(50);
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
    ejectShellCasing();
  } else {
    // Single Bullet Firing (Pistol / SMG / Rifle)
    roundStats.shotsFired += 1;
    let targetPoint = raycaster.ray.at(30, new THREE.Vector3());
    let hitEnemyIndex = -1;
    let hitBodyPart = 'torso';

    // Check wall/obstacle intersections
    const wallHits = raycaster.intersectObjects(obstacleMeshes, true);
    let closestWallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;

    for (let i = activeEnemies.length - 1; i >= 0; i--) {
      const enemy = activeEnemies[i];
      const intersects = raycaster.intersectObject(enemy.mesh, true);
      if (intersects.length > 0 && intersects[0].distance < closestWallDist) {
        targetPoint = intersects[0].point;
        hitEnemyIndex = i;
        closestWallDist = intersects[0].distance;
        if (intersects[0].object && intersects[0].object.userData.bodyPart) {
          hitBodyPart = intersects[0].object.userData.bodyPart;
        }
      }
    }

    if (hitEnemyIndex === -1 && wallHits.length > 0) {
      targetPoint = wallHits[0].point;
    }

    spawnSparkParticles(targetPoint, wpnDef.color);
    fireBulletTracer(targetPoint, wpnDef.color);
    ejectShellCasing();

    if (hitEnemyIndex !== -1) {
      const enemy = activeEnemies[hitEnemyIndex];
      roundStats.shotsHit += 1;

      let mult = 1.0;
      let label = '';
      if (hitBodyPart === 'head') {
        mult = 2.0;
        label = 'CRITICAL HEADSHOT! ';
        roundStats.headshots += 1;
      } else if (hitBodyPart === 'limb') {
        mult = 0.75;
        label = 'LIMB HIT ';
      }

      const appliedDamage = Math.round(wpnDef.damage * mult);
      roundStats.damageDealt += appliedDamage;
      enemy.hp -= appliedDamage;
      enemy.hitRecoil = 1.0;
      spawnBodyHitParticles(targetPoint, hitBodyPart === 'head');

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
        addXP(50);
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

function spawnBodyHitParticles(hitPoint, isHeadshot) {
  if (!scene) return;
  const count = isHeadshot ? 10 : 6;
  const color = isHeadshot ? 0xfbbf24 : 0xdc2626;

  for (let i = 0; i < count; i++) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const mat = new THREE.PointsMaterial({ color, size: isHeadshot ? 0.12 : 0.09, transparent: true, opacity: 0.95 });
    const p = new THREE.Points(geom, mat);
    p.position.copy(hitPoint);
    scene.add(p);

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.35,
      Math.random() * 0.35,
      (Math.random() - 0.5) * 0.35
    );
    activeProjectiles.push({ mesh: p, velocity: vel, life: 12 });
  }
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

function ejectShellCasing() {
  if (!scene || !camera) return;

  const geom = new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.1 });
  const casing = new THREE.Mesh(geom, mat);

  let ejectPos = camera.position.clone();
  ejectPos.add(new THREE.Vector3(0.2, -0.15, -0.3).applyQuaternion(camera.quaternion));
  casing.position.copy(ejectPos);

  const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

  const vel = rightVec.multiplyScalar(0.08 + Math.random() * 0.04)
    .add(upVec.multiplyScalar(0.06 + Math.random() * 0.04));

  casing.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

  scene.add(casing);
  playSound('shell');

  let ticks = 0;
  const interval = setInterval(() => {
    ticks += 1;
    casing.position.add(vel);
    vel.y -= 0.008; // Gravity
    casing.rotation.x += 0.2;
    casing.rotation.z += 0.2;

    if (casing.position.y <= -1.15 || ticks > 30) {
      clearInterval(interval);
      scene.remove(casing);
    }
  }, 30);
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
  pauseModal.classList.add('hidden');
  isPaused = false;

  showToast(`🚨 ROUND ${gameState.round} STARTED! Neutralize all Robbers!`);
  updateUI();
}

function toggleCrouch() {
  isCrouched = !isCrouched;
  showToast(isCrouched ? '🧎 CROUCHED (Tighter Spread, Slower Move)' : '🧍 STANDING');
}

function toggleNVG() {
  isNVGOn = !isNVGOn;
  if (nvgOverlayEl) {
    if (isNVGOn) nvgOverlayEl.classList.remove('hidden');
    else nvgOverlayEl.classList.add('hidden');
  }
  if (ambientLight) {
    ambientLight.intensity = isNVGOn ? 2.8 : 0.5;
  }
  playSound('flashlight');
  showToast(isNVGOn ? '🥽 NIGHT VISION GOGGLES ACTIVATED' : '🥽 NIGHT VISION OFF');
}

function toggleFlashlight() {
  isFlashlightOn = !isFlashlightOn;
  if (tacticalFlashlight) {
    tacticalFlashlight.intensity = isFlashlightOn ? 5 : 0;
  }
  playSound('flashlight');
  showToast(isFlashlightOn ? '🔦 TACTICAL FLASHLIGHT ON' : '🔦 FLASHLIGHT OFF');
}

function toggleTacticalMap() {
  if (tacticalMapModal.classList.contains('hidden')) {
    if (document.exitPointerLock) document.exitPointerLock();
    tacticalMapModal.classList.remove('hidden');
    renderLargeTacticalMap();
    playSound('map');
  } else {
    tacticalMapModal.classList.add('hidden');
  }
}

function renderLargeTacticalMap() {
  if (!largeMapCtx || !largeMapCanvas) return;

  const w = largeMapCanvas.width;
  const h = largeMapCanvas.height;
  const center = w / 2;
  const scale = 9.0; // World units to pixels

  largeMapCtx.clearRect(0, 0, w, h);

  // Map background
  largeMapCtx.fillStyle = '#020617';
  largeMapCtx.fillRect(0, 0, w, h);

  // Sector grid lines
  largeMapCtx.strokeStyle = 'rgba(2, 132, 199, 0.2)';
  largeMapCtx.lineWidth = 1;
  for (let x = 0; x <= w; x += 50) {
    largeMapCtx.beginPath();
    largeMapCtx.moveTo(x, 0);
    largeMapCtx.lineTo(x, h);
    largeMapCtx.stroke();
  }
  for (let y = 0; y <= h; y += 50) {
    largeMapCtx.beginPath();
    largeMapCtx.moveTo(0, y);
    largeMapCtx.lineTo(500, y);
    largeMapCtx.stroke();
  }

  // Draw Barricades & Buildings
  largeMapCtx.fillStyle = 'rgba(100, 116, 139, 0.7)';
  barricadeObstacles.forEach(box => {
    const minX = center + (box.min.x - playerPos.x) * scale;
    const minZ = center + (box.min.z - playerPos.z) * scale;
    const boxW = (box.max.x - box.min.x) * scale;
    const boxH = (box.max.y - box.min.y) * scale;
    largeMapCtx.fillRect(minX, minZ, boxW, boxH);
  });

  // Draw Active Enemy Targets
  activeEnemies.forEach(enemy => {
    const ex = center + (enemy.mesh.position.x - playerPos.x) * scale;
    const ez = center + (enemy.mesh.position.z - playerPos.z) * scale;

    largeMapCtx.beginPath();
    largeMapCtx.arc(ex, ez, enemy.type === 'shield' ? 7 : 5, 0, Math.PI * 2);

    if (enemy.type === 'runner') largeMapCtx.fillStyle = '#38bdf8';
    else if (enemy.type === 'shield') largeMapCtx.fillStyle = '#a855f7';
    else largeMapCtx.fillStyle = '#ef4444';

    largeMapCtx.fill();
    largeMapCtx.shadowColor = largeMapCtx.fillStyle;
    largeMapCtx.shadowBlur = 8;
  });

  // Draw Player Marker (Cop)
  largeMapCtx.save();
  largeMapCtx.translate(center, center);
  largeMapCtx.rotate(-cameraRotation.yaw);

  // Vision Cone
  largeMapCtx.fillStyle = 'rgba(52, 211, 153, 0.25)';
  largeMapCtx.beginPath();
  largeMapCtx.moveTo(0, 0);
  largeMapCtx.arc(0, 0, 90, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
  largeMapCtx.closePath();
  largeMapCtx.fill();

  // Cop Marker
  largeMapCtx.fillStyle = '#34d399';
  largeMapCtx.beginPath();
  largeMapCtx.moveTo(0, -12);
  largeMapCtx.lineTo(-8, 9);
  largeMapCtx.lineTo(0, 5);
  largeMapCtx.lineTo(8, 9);
  largeMapCtx.closePath();
  largeMapCtx.fill();
  largeMapCtx.restore();
}

function toggleBuyMenu() {
  if (buyMenuModal.classList.contains('hidden')) {
    openBuyMenu();
  } else {
    buyMenuModal.classList.add('hidden');
  }
}

function checkDestructibleHit(hitObject, damage) {
  if (!hitObject) return;
  let target = hitObject;
  while (target && !target.userData.isDestructible && target.parent && target !== scene) {
    target = target.parent;
  }
  if (target && target.userData && target.userData.isDestructible) {
    target.userData.hp -= damage;
    if (target.userData.hp <= 0) {
      spawnSparkParticles(target.position, target.userData.destructColor || 0xd97706);
      playSound('explosion');
      showToast('💥 DESTRUCTIBLE COVER BROKEN!');
      if (cityGroup) cityGroup.remove(target);
      const obsIdx = obstacleMeshes.indexOf(target);
      if (obsIdx !== -1) obstacleMeshes.splice(obsIdx, 1);
      const destIdx = destructibleMeshes.indexOf(target);
      if (destIdx !== -1) destructibleMeshes.splice(destIdx, 1);
    }
  }
}

function showAfterActionReport(roundBonus) {
  if (document.exitPointerLock) document.exitPointerLock();

  const acc = Math.round((roundStats.shotsHit / Math.max(1, roundStats.shotsFired)) * 100);

  let medal = '🎖️ SHIFT MVP';
  if (roundStats.headshots >= 3 || acc >= 70) medal = '🎯 SHARPSHOOTER AWARD';
  else if (isVaultDefenseActive) medal = '🛡️ VAULT GUARDIAN AWARD';

  document.getElementById('stat-shots').textContent = roundStats.shotsFired;
  document.getElementById('stat-accuracy').textContent = `${acc}%`;
  document.getElementById('stat-headshots').textContent = roundStats.headshots;
  document.getElementById('stat-damage').textContent = roundStats.damageDealt;
  document.getElementById('stat-cash').textContent = `$${roundBonus}`;
  document.getElementById('stat-medal').textContent = medal;

  if (roundStatsModal) roundStatsModal.classList.remove('hidden');

  roundStats = { shotsFired: 0, shotsHit: 0, headshots: 0, damageDealt: 0, cashEarned: 0 };
}

function checkRoundStatus() {
  if (gameState.isRoundActive && activeEnemies.length === 0 && enemiesToSpawnInRound === 0) {
    gameState.isRoundActive = false;
    let roundBonus = 300 + gameState.round * 150;

    if (isVaultDefenseActive && vaultHp > 0) {
      roundBonus += 800;
      showToast('🏦 VAULT DEFENDED INTACT! Earned +$800 Vault Defense Bonus!');
      playRadioChatter('Vault secure! Outstanding precinct defense officer!');
      if (vaultMesh) scene.remove(vaultMesh);
      vaultMesh = null;
      isVaultDefenseActive = false;
    }

    gameState.cash += roundBonus;
    gameState.round += 1;

    showToast(`🎉 ROUND COMPLETED! Earned +$${roundBonus} Intermission Bonus!`);
    showAfterActionReport(roundBonus);
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
  const menuPartnerSelect = document.getElementById('menu-partner-select');
  const settingPartnerSelect = document.getElementById('setting-partner-select');

  function syncPartnerMode(val) {
    gameState.swatPartnerMode = val;
    if (menuPartnerSelect) menuPartnerSelect.value = val;
    if (settingPartnerSelect) settingPartnerSelect.value = val;
    updateSwatPartnerVisibility();
    showToast(val === 'solo' ? '👤 SOLO DUTY MODE ACTIVATED' : '👥 AI SQUADMATE PARTNER ACTIVATED');
  }

  if (menuPartnerSelect) {
    menuPartnerSelect.addEventListener('change', (e) => syncPartnerMode(e.target.value));
  }
  if (settingPartnerSelect) {
    settingPartnerSelect.addEventListener('change', (e) => syncPartnerMode(e.target.value));
  }
  if (closeStatsBtn) {
    closeStatsBtn.addEventListener('click', () => {
      if (roundStatsModal) roundStatsModal.classList.add('hidden');
      openBuyMenu();
    });
  }
  if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
      isGameStarted = true;
      if (mainMenuModal) mainMenuModal.classList.add('hidden');
      canvasContainer.requestPointerLock();
      showToast('🚨 DEPLOYED ON DUTY! Good luck Officer.');
      playRadioChatter('All units, SWAT Team deployed on duty!');
    });
  }
  const camoBlackBtn = document.getElementById('camo-black-btn');
  const camoUrbanBtn = document.getElementById('camo-urban-btn');
  const camoGoldBtn = document.getElementById('camo-gold-btn');

  if (camoBlackBtn) {
    camoBlackBtn.addEventListener('click', () => {
      gameState.equippedCamo = 'black';
      updateFPSWeaponMesh();
      showToast('🎨 WEAPON CAMO: Midnight Black');
    });
  }
  if (camoUrbanBtn) {
    camoUrbanBtn.addEventListener('click', () => {
      gameState.equippedCamo = 'urban';
      updateFPSWeaponMesh();
      showToast('🎨 WEAPON CAMO: Urban Digital');
    });
  }
  if (camoGoldBtn) {
    camoGoldBtn.addEventListener('click', () => {
      if (!gameState.camos.gold) {
        if (gameState.cash >= 1000) {
          gameState.cash -= 1000;
          gameState.camos.gold = true;
          gameState.equippedCamo = 'gold';
          playSound('buy');
          updateFPSWeaponMesh();
          updateUI();
          showToast('🎨 UNLOCKED & EQUIPPED Gold Honor Camo!');
        } else {
          showToast('❌ Not enough cash for Gold Honor Camo ($1,000)!');
        }
      } else {
        gameState.equippedCamo = 'gold';
        updateFPSWeaponMesh();
        showToast('🎨 WEAPON CAMO: Gold Honor');
      }
    });
  }

  const mapSelectEl = document.getElementById('map-select');
  if (mapSelectEl) {
    mapSelectEl.addEventListener('change', (e) => {
      currentMap = e.target.value;
      createProceduralCity();
      showToast(`🗺️ MAP SWITCHED TO: ${e.target.options[e.target.selectedIndex].text}`);
    });
  }
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

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      isSprinting = false;
      isHoldingBreath = false;
    }
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

  // WASD, Crouch, Flashlight, Grenade, Map, Buy & Escape Keyboard Listeners
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyB' || e.code === 'Keyb' || e.key === 'b' || e.key === 'B') {
      if (!isGameExited) {
        toggleBuyMenu();
      }
      return;
    }

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (isAimingDownSights) {
        if (!isHoldingBreath) {
          isHoldingBreath = true;
          showToast('🫁 HOLDING BREATH (Weapon Stabilized)');
        }
      } else if (!isGameExited) {
        isSprinting = true;
      }
      return;
    }

    if (e.code === 'Space') {
      if (!isGameExited && !isJumping && playerPos.y <= -0.89) {
        isJumping = true;
        playerYVel = 0.22;
        playSound('footstep');
      }
      return;
    }

    if (e.code === 'KeyV' || e.code === 'Keyv' || e.key === 'v' || e.key === 'V') {
      if (!isGameExited) {
        performQuickMeleeKnife();
      }
      return;
    }

    if (e.code === 'KeyM' || e.code === 'Keym' || e.key === 'm' || e.key === 'M') {
      if (!isGameExited) {
        toggleTacticalMap();
      }
      return;
    }

    if (e.code === 'KeyN' || e.code === 'Keyn' || e.key === 'n' || e.key === 'N') {
      if (!isGameExited) {
        toggleNVG();
      }
      return;
    }

    if (e.code === 'KeyF' || e.code === 'Keyf' || e.key === 'f' || e.key === 'F') {
      if (!isGameExited) {
        toggleFlashlight();
      }
      return;
    }

    if (e.code === 'KeyC' || e.code === 'Keyc' || e.key === 'c' || e.key === 'C' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
      if (!isGameExited) {
        toggleCrouch();
      }
      return;
    }

    if (e.code === 'Escape') {
      if (!isGameExited) {
        if (!tacticalMapModal.classList.contains('hidden')) {
          tacticalMapModal.classList.add('hidden');
        } else {
          togglePauseMenu();
        }
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
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      isSprinting = false;
    }
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
  if (mainPauseTriggerBtn) {
    mainPauseTriggerBtn.addEventListener('click', togglePauseMenu);
  }

  openBuyMenuBtn.addEventListener('click', openBuyMenu);
  closeBuyMenuBtn.addEventListener('click', () => {
    buyMenuModal.classList.add('hidden');
  });

  startRoundBtn.addEventListener('click', startNextRound);

  // Buy Menu Purchases
  const buyWpnSmgBtn = document.getElementById('buy-wpn-smg');
  buyWpnPistolBtn.addEventListener('click', () => equipWeapon('pistol'));

  if (buyWpnSmgBtn) {
    buyWpnSmgBtn.addEventListener('click', () => {
      if (!gameState.inventory.smg) {
        if (gameState.cash >= 800) {
          gameState.cash -= 800;
          gameState.inventory.smg = true;
          playSound('buy');
          equipWeapon('smg');
        } else {
          showToast('❌ Not enough cash for Tactical SMG!');
        }
      } else {
        equipWeapon('smg');
      }
    });
  }

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

  if (buyGrenadesBtn) {
    buyGrenadesBtn.addEventListener('click', () => {
      if (gameState.cash >= 200) {
        gameState.cash -= 200;
        gameState.grenades += 2;
        playSound('buy');
        showToast('💣 Restocked +2 Fragmentation Grenades!');
        updateUI();
        updateBuyMenuUI();
      } else {
        showToast('❌ Not enough cash for Grenades!');
      }
    });
  }

  if (closeMapBtn) {
    closeMapBtn.addEventListener('click', () => {
      tacticalMapModal.classList.add('hidden');
    });
  }

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

  // Settings Sliders Event Listeners
  if (settingSens) {
    const initSensVal = localStorage.getItem('cop_sens') || '1.0';
    settingSens.value = initSensVal;
    if (valSens) valSens.textContent = initSensVal;

    settingSens.addEventListener('input', (e) => {
      const val = e.target.value;
      if (valSens) valSens.textContent = val;
      mouseSensitivity = parseFloat(val) * 0.002;
      localStorage.setItem('cop_sens', val);
    });
  }

  if (settingFov) {
    const initFovVal = localStorage.getItem('cop_fov') || '65';
    settingFov.value = initFovVal;
    if (valFov) valFov.textContent = initFovVal;

    settingFov.addEventListener('input', (e) => {
      const val = e.target.value;
      if (valFov) valFov.textContent = val;
      baseFOV = parseInt(val, 10);
      localStorage.setItem('cop_fov', val);
    });
  }

  const settingVolMaster = document.getElementById('setting-vol-master');
  const valVolMaster = document.getElementById('val-vol-master');
  if (settingVolMaster) {
    const initVal = localStorage.getItem('cop_vol_master') || '100';
    settingVolMaster.value = initVal;
    if (valVolMaster) valVolMaster.textContent = initVal;
    settingVolMaster.addEventListener('input', (e) => {
      const val = e.target.value;
      if (valVolMaster) valVolMaster.textContent = val;
      masterVolume = parseInt(val, 10) / 100;
      localStorage.setItem('cop_vol_master', val);
    });
  }

  if (settingVol) {
    const initVolVal = localStorage.getItem('cop_vol') || '100';
    settingVol.value = initVolVal;
    if (valVol) valVol.textContent = initVolVal;

    settingVol.addEventListener('input', (e) => {
      const val = e.target.value;
      if (valVol) valVol.textContent = val;
      sfxVolume = parseInt(val, 10) / 100;
      localStorage.setItem('cop_vol', val);
    });
  }

  const settingVolVoice = document.getElementById('setting-vol-voice');
  const valVolVoice = document.getElementById('val-vol-voice');
  if (settingVolVoice) {
    const initVal = localStorage.getItem('cop_vol_voice') || '100';
    settingVolVoice.value = initVal;
    if (valVolVoice) valVolVoice.textContent = initVal;
    settingVolVoice.addEventListener('input', (e) => {
      const val = e.target.value;
      if (valVolVoice) valVolVoice.textContent = val;
      voiceVolume = parseInt(val, 10) / 100;
      localStorage.setItem('cop_vol_voice', val);
    });
  }

  const settingVolMusic = document.getElementById('setting-vol-music');
  const valVolMusic = document.getElementById('val-vol-music');
  if (settingVolMusic) {
    const initVal = localStorage.getItem('cop_vol_music') || '100';
    settingVolMusic.value = initVal;
    if (valVolMusic) valVolMusic.textContent = initVal;
    settingVolMusic.addEventListener('input', (e) => {
      const val = e.target.value;
      if (valVolMusic) valVolMusic.textContent = val;
      musicVolume = parseInt(val, 10) / 100;
      localStorage.setItem('cop_vol_music', val);
    });
  }
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

function executeKnifeDamageCheck() {
  const rect = renderer.domElement.getBoundingClientRect();
  const screenCenterX = rect.width / 2;
  const screenCenterY = rect.height / 2;

  // Melee range raycast check (close-quarters strike up to 2.2 meters)
  const meleeRaycaster = new THREE.Raycaster();
  meleeRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const enemy = activeEnemies[i];
    const intersects = meleeRaycaster.intersectObject(enemy.mesh, true);

    if (intersects.length > 0 && intersects[0].distance <= 2.2) {
      const appliedDamage = 50;
      enemy.hp -= appliedDamage;
      enemy.hitRecoil = 1.2;

      spawnFloatingText(`🔪 KNIFE SLASH -${appliedDamage}`, screenCenterX, screenCenterY, true);
      playSound('hit');

      if (enemy.hp <= 0) {
        scene.remove(enemy.mesh);
        activeEnemies.splice(i, 1);
        const reward = 100 + gameState.round * 20;
        gameState.cash += reward;
        spawnFloatingText(`+$${reward}`, screenCenterX, screenCenterY, false);
        checkRoundStatus();
      } else {
        const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
        enemy.hpBarFill.scale.x = hpRatio;
        enemy.hpBarFill.position.x = -0.29 * (1 - hpRatio);
      }
      break;
    }
  }
}

function performQuickMeleeKnife() {
  if (knifeAnimFrame > 0 || isPaused || isGameExited) return;

  knifeAnimFrame = 1;
  knifeDamageTriggered = false;
  showToast('🔪 KNIFE SLASH!');
}

function updateBuyMenuUI() {
  buyMenuCash.textContent = `$${gameState.cash}`;

  // Pistol Button
  buyWpnPistolBtn.textContent = gameState.equippedWeapon === 'pistol' ? 'EQUIPPED' : 'EQUIP';
  buyWpnPistolBtn.className = `buy-item-btn ${gameState.equippedWeapon === 'pistol' ? 'equipped' : ''}`;

  // SMG Button
  const buyWpnSmgBtn = document.getElementById('buy-wpn-smg');
  if (buyWpnSmgBtn) {
    if (!gameState.inventory.smg) {
      buyWpnSmgBtn.textContent = 'BUY ($800)';
      buyWpnSmgBtn.className = 'buy-item-btn';
      buyWpnSmgBtn.disabled = gameState.cash < 800;
    } else {
      buyWpnSmgBtn.textContent = gameState.equippedWeapon === 'smg' ? 'EQUIPPED' : 'EQUIP';
      buyWpnSmgBtn.className = `buy-item-btn ${gameState.equippedWeapon === 'smg' ? 'equipped' : ''}`;
      buyWpnSmgBtn.disabled = false;
    }
  }

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
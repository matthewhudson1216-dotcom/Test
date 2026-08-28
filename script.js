// Game State
let gameState = {
  score: 0,
  clickPower: 1,
  cps: 0,
  totalClicks: 0,
  totalEarned: 0,
  goldenClicked: 0,
  asteroidsDestroyed: 0,
  ascensionCount: 0,
  shards: 0,
  lastSaveTimestamp: Date.now(),
  sfxMuted: false,
  skin: 'default',
  theme: 'cyan',
  selectedWeapon: 'laser', // laser, plasma, missiles
  health: 100,
  maxHealth: 100,
  tech: {
    autobuyer: false,
    synergy1: false,
    synergy2: false
  },
  upgrades: {
    multiplier: { count: 0, cost: 10, power: 1 },
    cursor: { count: 0, cost: 15, cps: 1 },
    grandma: { count: 0, cost: 100, cps: 5 },
    factory: { count: 0, cost: 500, cps: 25 }
  },
  achievements: {
    firstClick: false,
    hundredEarned: false,
    firstDrone: false,
    goldenCatcher: false,
    clickMaster: false,
    cosmicArchitect: false,
    firstAscension: false,
    asteroidHunter: false
  }
};

// Definitions for Combat Badges / Achievements
const achievementsDef = [
  { id: 'firstClick', title: 'First Shot', desc: 'Fire weapons 1 time', icon: '⚡' },
  { id: 'hundredEarned', title: 'Bounty Hunter', desc: 'Earn 100 total bounty points', icon: '🪙' },
  { id: 'firstDrone', title: 'Turret Garrison', desc: 'Buy your first Defense Drone', icon: '🤖' },
  { id: 'goldenCatcher', title: 'Sharpshooter', desc: 'Destroy a Golden Core', icon: '🌟' },
  { id: 'clickMaster', title: 'Ace Pilot', desc: 'Fire 100 total shots', icon: '🚀' },
  { id: 'cosmicArchitect', title: 'Station Overseer', desc: 'Buy a Station Core Matrix', icon: '🌌' },
  { id: 'firstAscension', title: 'Cosmic Rebirth', desc: 'Perform your first Ascension', icon: '🪐' },
  { id: 'asteroidHunter', title: 'Boss Slayer', desc: 'Defeat a Cosmic Boss Enemy', icon: '☠️' }
];

// Weapon Definitions
const weaponsDef = {
  laser: { name: 'Pulse Laser', heatPerShot: 12, cooldown: 180, multiplier: 1, color: 0x38bdf8 },
  plasma: { name: 'Plasma Cannon', heatPerShot: 25, cooldown: 400, multiplier: 2.5, color: 0xf43f5e },
  missiles: { name: 'Homing Missiles', heatPerShot: 35, cooldown: 650, multiplier: 4.5, color: 0xfbbf24 }
};

// Audio Synthesizer (Web Audio API)
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
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'laser') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'plasma') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'hit') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'buy') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.08);
    osc.frequency.setValueAtTime(783.99, now + 0.16);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'boss') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.6);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.6);
  }
}

// DOM Elements
const scoreDisplay = document.getElementById('score');
const cpsDisplay = document.getElementById('cps-display');
const clickPowerDisplay = document.getElementById('click-power-display');
const clickBtn = document.getElementById('click-btn');
const canvasContainer = document.getElementById('canvas-container');
const floatingContainer = document.getElementById('floating-text-container');
const frenzyBanner = document.getElementById('frenzy-banner');
const sfxToggleBtn = document.getElementById('sfx-toggle');
const shardsDisplay = document.getElementById('shards-display');
const comboDisplay = document.getElementById('combo-display');

const healthText = document.getElementById('health-text');
const healthBarFill = document.getElementById('health-bar-fill');
const heatText = document.getElementById('heat-text');
const heatBarFill = document.getElementById('heat-bar-fill');

const bossHud = document.getElementById('boss-hud');
const bossBarFill = document.getElementById('boss-bar-fill');

const skinSelect = document.getElementById('skin-select');
const themeSelect = document.getElementById('theme-select');

const wpnLaserBtn = document.getElementById('wpn-laser');
const wpnPlasmaBtn = document.getElementById('wpn-plasma');
const wpnMissilesBtn = document.getElementById('wpn-missiles');

const statTotalClicksDetailed = document.getElementById('stat-clicks-detailed');
const statTotalEarnedDetailed = document.getElementById('stat-earned-detailed');
const statCpm = document.getElementById('stat-cpm');
const statGoldenCount = document.getElementById('stat-golden-count');
const statAsteroidsCount = document.getElementById('stat-asteroids-count');
const statAscensionCount = document.getElementById('stat-ascension-count');

const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');

const achievementsListUI = document.getElementById('achievements-list');
const achievementsCountUI = document.getElementById('achievements-count');
const toastContainer = document.getElementById('toast-container');

const modalOverlay = document.getElementById('modal-overlay');
const modalAmount = document.getElementById('modal-amount');
const modalClaimBtn = document.getElementById('modal-claim-btn');

// Tabs & Panels
const tabBtns = {
  upgrades: document.getElementById('tab-upgrades'),
  tech: document.getElementById('tab-tech'),
  ascension: document.getElementById('tab-ascension'),
  stats: document.getElementById('tab-stats')
};

const tabPanels = {
  upgrades: document.getElementById('panel-upgrades'),
  tech: document.getElementById('panel-tech'),
  ascension: document.getElementById('panel-ascension'),
  stats: document.getElementById('panel-stats')
};

// Ascension Elements
const ascensionShardsPending = document.getElementById('ascension-shards-pending');
const ascensionBoostCurrent = document.getElementById('ascension-boost-current');
const ascendBtn = document.getElementById('ascend-btn');

// Tech Tree Elements
const autobuyerStatus = document.getElementById('autobuyer-status');
const buyAutobuyerBtn = document.getElementById('buy-autobuyer');
const synergy1Status = document.getElementById('synergy1-status');
const buySynergy1Btn = document.getElementById('buy-synergy1');
const synergy2Status = document.getElementById('synergy2-status');
const buySynergy2Btn = document.getElementById('buy-synergy2');

const upgradesUI = {
  multiplier: { count: document.getElementById('count-multiplier'), cost: document.getElementById('cost-multiplier'), btn: document.getElementById('buy-multiplier') },
  cursor: { count: document.getElementById('count-cursor'), cost: document.getElementById('cost-cursor'), btn: document.getElementById('buy-cursor') },
  grandma: { count: document.getElementById('count-grandma'), cost: document.getElementById('cost-grandma'), btn: document.getElementById('buy-grandma') },
  factory: { count: document.getElementById('count-factory'), cost: document.getElementById('cost-factory'), btn: document.getElementById('buy-factory') }
};

// Three.js 3D Variables
let scene, camera, renderer;
let mainCrystal, crystalWireframe, starField;

let activeEnemies = [];
let activeProjectiles = [];
let activeBoss = null;

let weaponHeat = 0; // 0 to 100
let isOverheated = false;
let comboStreak = 0;
let lastHitTime = 0;

let frenzyEndTime = 0;
let frenzyMultiplier = 1;
let recentClicksTimestamps = [];

let orbitingSatellites = [];
let raycaster, mouse;
let targetScale = 1;
let currentScale = 1;

const themePalettes = {
  cyan: { light1: 0x38bdf8, light2: 0x818cf8, star: 0x38bdf8, wire: 0x38bdf8 },
  nebula: { light1: 0xc084fc, light2: 0xe879f9, star: 0xc084fc, wire: 0xe879f9 },
  cyberpunk: { light1: 0x22d3ee, light2: 0xf43f5e, star: 0x22d3ee, wire: 0xf43f5e },
  gold: { light1: 0xfbbf24, light2: 0xf59e0b, star: 0xfbbf24, wire: 0xd97706 }
};

// Initialization
function init() {
  loadGame();
  init3D();
  setupEventListeners();
  renderAchievementsUI();
  updateUI();
  update3DSatellites();
  checkOfflineEarnings();

  // Primary Game Loop (every 100ms)
  setInterval(() => {
    // Passive turret income
    let currentCps = getEffectiveCPS();
    if (currentCps > 0) {
      const passiveGain = currentCps / 10;
      gameState.score += passiveGain;
      gameState.totalEarned += passiveGain;
      updateUI();
      checkAchievements();
    }

    // Heat Cooldown & Decay
    if (weaponHeat > 0) {
      weaponHeat = Math.max(0, weaponHeat - 1.8);
      if (weaponHeat === 0 && isOverheated) {
        isOverheated = false;
        showToast('✅ Weapon Cooled Down! Ready to Fire.');
      }
    }
    updateShooterHUD();

    // Check Combo Streak timeout (reset after 3s without hits)
    if (comboStreak > 0 && Date.now() - lastHitTime > 3000) {
      comboStreak = 0;
      updateShooterHUD();
    }

    // Check frenzy expiration
    if (frenzyMultiplier > 1 && Date.now() > frenzyEndTime) {
      frenzyMultiplier = 1;
      frenzyBanner.classList.add('hidden');
    }

    // Auto-buyer logic
    if (gameState.tech.autobuyer) {
      runAutobuyer();
    }
  }, 100);

  // Auto-save every 10 seconds
  setInterval(() => { saveGame(); }, 10000);

  // Spawn Enemy Pirates & Drones (every 4 seconds)
  setInterval(() => {
    if (activeEnemies.length < 6 && Math.random() < 0.75) {
      spawnEnemyDrone();
    }
  }, 4000);

  // Spawn Cosmic Boss encounter (every 45 seconds if no boss active)
  setInterval(() => {
    if (!activeBoss && Math.random() < 0.40) {
      spawnCosmicBoss();
    }
  }, 45000);
}

function getPrestigeMultiplier() {
  return 1 + (gameState.shards * 0.10);
}

function getComboMultiplier() {
  return 1 + Math.min(comboStreak, 20) * 0.2; // up to 5x boost on 20 streak
}

function getEffectiveClickPower() {
  let basePower = gameState.clickPower;
  if (gameState.tech.synergy2) {
    const prismCps = gameState.upgrades.grandma.count * gameState.upgrades.grandma.cps;
    basePower += prismCps * 0.05;
  }

  const wpn = weaponsDef[gameState.selectedWeapon] || weaponsDef.laser;
  let totalPower = basePower * wpn.multiplier * frenzyMultiplier * getPrestigeMultiplier() * getComboMultiplier();
  return Math.max(1, Math.floor(totalPower));
}

function getEffectiveCPS() {
  let droneCps = gameState.upgrades.cursor.count * gameState.upgrades.cursor.cps;
  if (gameState.tech.synergy1) {
    droneCps *= (1 + gameState.upgrades.grandma.count * 0.50);
  }

  let totalCps = droneCps +
                 (gameState.upgrades.grandma.count * gameState.upgrades.grandma.cps) +
                 (gameState.upgrades.factory.count * gameState.upgrades.factory.cps);

  totalCps *= frenzyMultiplier * getPrestigeMultiplier();
  return totalCps;
}

// Initialize Three.js 3D Scene
function init3D() {
  const container = canvasContainer;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 270;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 6;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x38bdf8, 2, 50);
  pointLight1.position.set(5, 5, 5);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x818cf8, 2, 50);
  pointLight2.position.set(-5, -5, -2);
  scene.add(pointLight2);

  createMainCrystalMesh();

  // Background 3D Particles Field
  const starsGeometry = new THREE.BufferGeometry();
  const starsCount = 150;
  const starPositions = new Float32Array(starsCount * 3);

  for (let i = 0; i < starsCount * 3; i += 3) {
    starPositions[i] = (Math.random() - 0.5) * 20;
    starPositions[i + 1] = (Math.random() - 0.5) * 20;
    starPositions[i + 2] = (Math.random() - 0.5) * 20;
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.08, transparent: true, opacity: 0.6 });
  starField = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(starField);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  window.addEventListener('resize', onWindowResize);
  applyTheme(gameState.theme);
  animate();
}

function createMainCrystalMesh() {
  if (mainCrystal) scene.remove(mainCrystal);
  if (crystalWireframe) scene.remove(crystalWireframe);

  let geom, wireGeom;
  let matProps = { roughness: 0.1, metalness: 0.8, flatShading: true, emissiveIntensity: 0.4 };

  if (gameState.skin === 'ruby') {
    geom = new THREE.OctahedronGeometry(1.4, 0);
    wireGeom = new THREE.OctahedronGeometry(1.5, 0);
    matProps.color = 0xf43f5e;
    matProps.emissive = 0xbe123c;
  } else if (gameState.skin === 'emerald') {
    geom = new THREE.CylinderGeometry(0.9, 0.9, 2, 6);
    wireGeom = new THREE.CylinderGeometry(0.95, 0.95, 2.1, 6);
    matProps.color = 0x10b981;
    matProps.emissive = 0x047857;
  } else if (gameState.skin === 'rainbow') {
    geom = new THREE.DodecahedronGeometry(1.3, 0);
    wireGeom = new THREE.DodecahedronGeometry(1.4, 0);
    matProps.color = 0xc084fc;
    matProps.emissive = 0x7e22ce;
  } else {
    geom = new THREE.IcosahedronGeometry(1.4, 0);
    wireGeom = new THREE.IcosahedronGeometry(1.5, 0);
    matProps.color = 0x0284c7;
    matProps.emissive = 0x0369a1;
  }

  const material = new THREE.MeshStandardMaterial(matProps);
  mainCrystal = new THREE.Mesh(geom, material);
  scene.add(mainCrystal);

  const wireMaterial = new THREE.MeshBasicMaterial({ color: matProps.color, wireframe: true, transparent: true, opacity: 0.4 });
  crystalWireframe = new THREE.Mesh(wireGeom, wireMaterial);
  scene.add(crystalWireframe);
}

function applyTheme(themeKey) {
  const pal = themePalettes[themeKey] || themePalettes.cyan;
  if (starField) starField.material.color.setHex(pal.star);
}

function spawnEnemyDrone() {
  if (!scene) return;
  const geom = new THREE.OctahedronGeometry(0.22, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0xbe123c,
    emissiveIntensity: 0.8
  });
  const mesh = new THREE.Mesh(geom, mat);

  const angle = Math.random() * Math.PI * 2;
  const startDist = 4.2;
  mesh.position.set(Math.cos(angle) * startDist, Math.sin(angle) * startDist, (Math.random() - 0.5) * 1.5);

  const hp = 1 + Math.floor(gameState.ascensionCount * 2);
  const enemy = { mesh, hp, maxHp: hp, speed: 0.015 + Math.random() * 0.01, isBoss: false };
  scene.add(mesh);
  activeEnemies.push(enemy);
}

function spawnCosmicBoss() {
  if (activeBoss || !scene) return;
  const geom = new THREE.DodecahedronGeometry(0.7, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xbe123c,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.9
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, 2.2, 0);

  const hp = Math.max(10, Math.floor(getEffectiveClickPower() * 8));
  activeBoss = { mesh, hp, maxHp: hp, angle: 0, radius: 2.2 };
  scene.add(mesh);

  bossHud.classList.remove('hidden');
  playSound('boss');
  showToast('⚠️ COSMIC BOSS INCOMING! Destroy it before it breaches the station!');
}

function animate() {
  requestAnimationFrame(animate);

  if (mainCrystal) {
    mainCrystal.rotation.x += 0.005;
    mainCrystal.rotation.y += 0.008;
    crystalWireframe.rotation.x -= 0.003;
    crystalWireframe.rotation.y -= 0.005;

    currentScale += (targetScale - currentScale) * 0.2;
    mainCrystal.scale.set(currentScale, currentScale, currentScale);
    crystalWireframe.scale.set(currentScale * 1.05, currentScale * 1.05, currentScale * 1.05);

    if (Math.abs(currentScale - targetScale) < 0.01) {
      targetScale = 1;
    }
  }

  // Animate Active Projectiles
  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const proj = activeProjectiles[i];
    proj.mesh.position.add(proj.velocity);
    proj.life -= 1;

    if (proj.life <= 0) {
      scene.remove(proj.mesh);
      activeProjectiles.splice(i, 1);
    }
  }

  // Animate Enemy Drones towards Station
  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const enemy = activeEnemies[i];
    enemy.mesh.rotation.x += 0.03;
    enemy.mesh.rotation.y += 0.03;

    // Move towards center
    const dir = new THREE.Vector3(0, 0, 0).sub(enemy.mesh.position).normalize();
    enemy.mesh.position.addScaledVector(dir, enemy.speed);

    // Check if enemy hit station (radius < 1.4)
    if (enemy.mesh.position.length() < 1.4) {
      gameState.health = Math.max(0, gameState.health - 10);
      scene.remove(enemy.mesh);
      activeEnemies.splice(i, 1);
      comboStreak = 0;
      updateShooterHUD();
      showToast('💥 Station Shield Hit by Enemy Drone!');

      if (gameState.health <= 0) {
        gameState.health = gameState.maxHealth;
        showToast('🛡️ Shield Recharged! Station Rebooted.');
      }
    }
  }

  // Animate Boss
  if (activeBoss) {
    activeBoss.angle += 0.01;
    activeBoss.mesh.position.x = Math.cos(activeBoss.angle) * activeBoss.radius;
    activeBoss.mesh.position.y = Math.sin(activeBoss.angle) * (activeBoss.radius * 0.6);
    activeBoss.mesh.rotation.x += 0.02;
    activeBoss.mesh.rotation.y += 0.02;
  }

  if (starField) starField.rotation.y += 0.0008;

  orbitingSatellites.forEach(sat => {
    sat.angle += sat.speed;
    sat.mesh.position.x = Math.cos(sat.angle) * sat.radius;
    sat.mesh.position.z = Math.sin(sat.angle) * sat.radius;
    sat.mesh.position.y = Math.sin(sat.angle * 2) * 0.4;
    sat.mesh.rotation.x += 0.02;
    sat.mesh.rotation.y += 0.02;
  });

  renderer.render(scene, camera);
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

function handleShooterClick(event) {
  if (isOverheated) {
    showToast('⚠️ WEAPONS OVERHEATED! Wait for Cooldown.');
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const wpn = weaponsDef[gameState.selectedWeapon] || weaponsDef.laser;
  weaponHeat = Math.min(100, weaponHeat + wpn.heatPerShot);
  if (weaponHeat >= 100) {
    isOverheated = true;
    showToast('🔥 WEAPONS OVERHEATED!');
  }

  raycaster.setFromCamera(mouse, camera);

  // Fire Visual 3D Laser Bolt
  fireLaserBeam(event.clientX - rect.left, event.clientY - rect.top, wpn.color);

  // Check Boss Hit
  if (activeBoss) {
    const bossIntersects = raycaster.intersectObject(activeBoss.mesh);
    if (bossIntersects.length > 0) {
      hitBoss(event.clientX - rect.left, event.clientY - rect.top);
      return;
    }
  }

  // Check Enemy Drone Hit
  let hitEnemy = false;
  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const enemy = activeEnemies[i];
    const enemyIntersects = raycaster.intersectObject(enemy.mesh);
    if (enemyIntersects.length > 0) {
      hitEnemy = true;
      enemy.hp -= 1;

      if (enemy.hp <= 0) {
        scene.remove(enemy.mesh);
        activeEnemies.splice(i, 1);

        const bounty = Math.max(15, Math.floor(getEffectiveClickPower() * 1.5));
        gameState.score += bounty;
        gameState.totalEarned += bounty;
        gameState.goldenClicked += 1;

        comboStreak += 1;
        lastHitTime = Date.now();

        spawnFloatingText(`+${bounty} HIT!`, event.clientX - rect.left, event.clientY - rect.top, true);
        playSound('hit');
      }
      break;
    }
  }

  // Click Main Crystal or Area
  const intersects = raycaster.intersectObjects([mainCrystal, crystalWireframe]);
  if (intersects.length > 0 || event.target === clickBtn) {
    triggerShot(event.clientX ? event.clientX - rect.left : rect.width / 2, event.clientY ? event.clientY - rect.top : rect.height / 2);
  } else if (!hitEnemy) {
    // Reset combo streak on complete miss
    comboStreak = 0;
    updateShooterHUD();
  }
}

function fireLaserBeam(targetX, targetY, hexColor) {
  if (!scene) return;
  const geom = new THREE.CylinderGeometry(0.04, 0.04, 1, 6);
  const mat = new THREE.MeshBasicMaterial({ color: hexColor });
  const proj = new THREE.Mesh(geom, mat);

  proj.position.set(0, -2, 4); // fire from bottom camera viewpoint
  const worldTarget = new THREE.Vector3(
    ((targetX / canvasContainer.clientWidth) * 2 - 1) * 3,
    (-((targetY / canvasContainer.clientHeight) * 2 - 1)) * 2,
    0
  );

  const vel = worldTarget.sub(proj.position).normalize().multiplyScalar(0.4);
  proj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize());

  scene.add(proj);
  activeProjectiles.push({ mesh: proj, velocity: vel, life: 15 });
  playSound(gameState.selectedWeapon === 'plasma' ? 'plasma' : 'laser');
}

function hitBoss(x, y) {
  if (!activeBoss) return;
  const damage = getEffectiveClickPower();
  activeBoss.hp -= damage;

  comboStreak += 1;
  lastHitTime = Date.now();

  spawnFloatingText(`-${damage}`, x, y, true);
  playSound('hit');

  if (activeBoss.hp <= 0) {
    scene.remove(activeBoss.mesh);
    activeBoss = null;
    bossHud.classList.add('hidden');

    const bossBounty = Math.max(100, Math.floor(getEffectiveCPS() * 30 + 200));
    gameState.score += bossBounty;
    gameState.totalEarned += bossBounty;
    gameState.asteroidsDestroyed += 1;

    showToast(`☠️ COSMIC BOSS DEFEATED! Earned +${bossBounty} Bounty!`);
    gameState.achievements.asteroidHunter = true;
    checkAchievements();
  }
  updateShooterHUD();
  updateUI();
}

function triggerShot(x = 200, y = 140) {
  const addedPoints = getEffectiveClickPower();
  gameState.score += addedPoints;
  gameState.totalEarned += addedPoints;
  gameState.totalClicks += 1;
  targetScale = 0.85;

  recentClicksTimestamps.push(Date.now());
  spawnFloatingText(`+${addedPoints}`, x, y, frenzyMultiplier > 1 || comboStreak > 5);

  checkAchievements();
  updateUI();
}

function updateShooterHUD() {
  healthText.textContent = `${gameState.health}/${gameState.maxHealth}`;
  healthBarFill.style.width = `${(gameState.health / gameState.maxHealth) * 100}%`;

  heatText.textContent = `${Math.floor(weaponHeat)}%`;
  heatBarFill.style.width = `${weaponHeat}%`;

  comboDisplay.textContent = `COMBO ${comboStreak}x`;

  if (activeBoss) {
    const bossPct = Math.max(0, (activeBoss.hp / activeBoss.maxHp) * 100);
    bossBarFill.style.width = `${bossPct}%`;
  }
}

function spawnFloatingText(text, x, y, isGolden = false) {
  const el = document.createElement('div');
  el.className = `floating-number ${isGolden ? 'golden' : ''}`;
  el.textContent = text;
  el.style.left = `${Math.min(Math.max(x - 15, 10), canvasContainer.clientWidth - 50)}px`;
  el.style.top = `${Math.min(Math.max(y - 15, 10), canvasContainer.clientHeight - 30)}px`;
  floatingContainer.appendChild(el);

  setTimeout(() => el.remove(), 800);
}

function update3DSatellites() {
  if (!scene) return;
  orbitingSatellites.forEach(sat => scene.remove(sat.mesh));
  orbitingSatellites = [];

  const totalBuildings = gameState.upgrades.cursor.count +
                         gameState.upgrades.grandma.count +
                         gameState.upgrades.factory.count;

  const countToSpawn = Math.min(totalBuildings, 25);
  for (let i = 0; i < countToSpawn; i++) {
    const isBig = i >= 10;
    const geom = isBig ? new THREE.TetrahedronGeometry(0.2) : new THREE.OctahedronGeometry(0.12);
    const mat = new THREE.MeshStandardMaterial({
      color: isBig ? 0x818cf8 : 0x38bdf8,
      metalness: 0.9,
      roughness: 0.2,
      emissive: isBig ? 0x4f46e5 : 0x0284c7,
      emissiveIntensity: 0.5
    });

    const mesh = new THREE.Mesh(geom, mat);
    const radius = 2.2 + (i % 3) * 0.4;
    const angle = (i / countToSpawn) * Math.PI * 2;
    const speed = 0.01 + (i % 5) * 0.005;

    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.z = Math.sin(angle) * radius;

    scene.add(mesh);
    orbitingSatellites.push({ mesh, radius, angle, speed });
  }
}

function setupEventListeners() {
  canvasContainer.addEventListener('pointerdown', handleShooterClick);
  clickBtn.addEventListener('click', (e) => {
    const rect = canvasContainer.getBoundingClientRect();
    handleShooterClick({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, target: clickBtn });
  });

  // Weapon Selector Buttons
  wpnLaserBtn.addEventListener('click', () => switchWeapon('laser'));
  wpnPlasmaBtn.addEventListener('click', () => switchWeapon('plasma'));
  wpnMissilesBtn.addEventListener('click', () => switchWeapon('missiles'));

  // Tab switching handlers
  Object.keys(tabBtns).forEach(tabKey => {
    tabBtns[tabKey].addEventListener('click', () => {
      Object.keys(tabBtns).forEach(k => {
        tabBtns[k].classList.remove('active');
        tabPanels[k].classList.add('hidden');
      });
      tabBtns[tabKey].classList.add('active');
      tabPanels[tabKey].classList.remove('hidden');
    });
  });

  skinSelect.addEventListener('change', (e) => {
    gameState.skin = e.target.value;
    createMainCrystalMesh();
  });

  themeSelect.addEventListener('change', (e) => {
    gameState.theme = e.target.value;
    applyTheme(e.target.value);
  });

  Object.keys(upgradesUI).forEach(key => {
    upgradesUI[key].btn.addEventListener('click', () => buyUpgrade(key));
  });

  buyAutobuyerBtn.addEventListener('click', () => {
    if (gameState.score >= 1000 && !gameState.tech.autobuyer) {
      gameState.score -= 1000;
      gameState.tech.autobuyer = true;
      playSound('buy');
      showToast('🤖 Auto-Buyer Drone Unlocked!');
      updateUI();
    }
  });

  buySynergy1Btn.addEventListener('click', () => {
    if (gameState.score >= 2500 && !gameState.tech.synergy1) {
      gameState.score -= 2500;
      gameState.tech.synergy1 = true;
      playSound('buy');
      showToast('⚡ Drone Overclocking Unlocked!');
      updateUI();
    }
  });

  buySynergy2Btn.addEventListener('click', () => {
    if (gameState.score >= 10000 && !gameState.tech.synergy2) {
      gameState.score -= 10000;
      gameState.tech.synergy2 = true;
      playSound('buy');
      showToast('🔮 Prism Resonance Unlocked!');
      updateUI();
    }
  });

  ascendBtn.addEventListener('click', () => {
    if (gameState.score >= 50000) {
      const earnedShards = Math.floor(Math.pow(gameState.score / 50000, 0.5) * 5);
      if (confirm(`Ascend now for ${earnedShards} Cosmic Shards? This resets your points and building upgrades, but grants a permanent +${earnedShards * 10}% income boost!`)) {
        performAscension(earnedShards);
      }
    }
  });

  sfxToggleBtn.addEventListener('click', () => {
    gameState.sfxMuted = !gameState.sfxMuted;
    sfxToggleBtn.textContent = gameState.sfxMuted ? '🔇 SFX Off' : '🔊 SFX On';
  });

  saveBtn.addEventListener('click', () => {
    saveGame();
    showToast('💾 Game Saved!');
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset your 3D game progress?')) {
      resetGame();
    }
  });

  modalClaimBtn.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
  });
}

function switchWeapon(type) {
  gameState.selectedWeapon = type;
  wpnLaserBtn.classList.toggle('active', type === 'laser');
  wpnPlasmaBtn.classList.toggle('active', type === 'plasma');
  wpnMissilesBtn.classList.toggle('active', type === 'missiles');
  updateUI();
}

function runAutobuyer() {
  const available = Object.keys(upgradesUI).map(k => ({ key: k, cost: gameState.upgrades[k].cost })).sort((a, b) => a.cost - b.cost);
  if (available.length > 0 && gameState.score >= available[0].cost) {
    buyUpgrade(available[0].key);
  }
}

function performAscension(earnedShards) {
  gameState.shards += earnedShards;
  gameState.ascensionCount += 1;
  gameState.score = 0;
  gameState.clickPower = 1;
  gameState.cps = 0;

  gameState.upgrades = {
    multiplier: { count: 0, cost: 10, power: 1 },
    cursor: { count: 0, cost: 15, cps: 1 },
    grandma: { count: 0, cost: 100, cps: 5 },
    factory: { count: 0, cost: 500, cps: 25 }
  };

  gameState.achievements.firstAscension = true;
  playSound('buy');
  showToast(`🌌 ASCENSION COMPLETE! Earned ${earnedShards} Cosmic Shards!`);

  checkAchievements();
  updateUI();
  update3DSatellites();
}

function buyUpgrade(type) {
  const upgrade = gameState.upgrades[type];
  if (gameState.score >= upgrade.cost) {
    gameState.score -= upgrade.cost;
    upgrade.count += 1;

    if (type === 'multiplier') {
      gameState.clickPower += upgrade.power;
    } else {
      gameState.cps += upgrade.cps;
    }

    if (type === 'cursor') gameState.achievements.firstDrone = true;
    if (type === 'factory') gameState.achievements.cosmicArchitect = true;

    playSound('buy');
    upgrade.cost = Math.floor(upgrade.cost * 1.15);
    checkAchievements();
    updateUI();
    update3DSatellites();
  }
}

function updateUI() {
  scoreDisplay.textContent = Math.floor(gameState.score);
  cpsDisplay.textContent = `${Math.floor(getEffectiveCPS())} per sec`;
  clickPowerDisplay.textContent = `+${Math.floor(getEffectiveClickPower())} per shot`;

  shardsDisplay.textContent = `🌌 ${gameState.shards} Shards (+${gameState.shards * 10}%)`;

  skinSelect.value = gameState.skin;
  themeSelect.value = gameState.theme;

  statTotalClicksDetailed.textContent = gameState.totalClicks;
  statTotalEarnedDetailed.textContent = Math.floor(gameState.totalEarned);

  const now = Date.now();
  recentClicksTimestamps = recentClicksTimestamps.filter(t => now - t < 60000);
  statCpm.textContent = recentClicksTimestamps.length;

  statGoldenCount.textContent = gameState.goldenClicked;
  statAsteroidsCount.textContent = gameState.asteroidsDestroyed;
  statAscensionCount.textContent = gameState.ascensionCount;

  Object.keys(upgradesUI).forEach(key => {
    const upgrade = gameState.upgrades[key];
    const ui = upgradesUI[key];
    ui.count.textContent = upgrade.count;
    ui.cost.textContent = upgrade.cost;
    ui.btn.disabled = gameState.score < upgrade.cost;
  });

  autobuyerStatus.textContent = gameState.tech.autobuyer ? 'Unlocked' : 'Locked';
  buyAutobuyerBtn.disabled = gameState.tech.autobuyer || gameState.score < 1000;

  synergy1Status.textContent = gameState.tech.synergy1 ? 'Unlocked' : 'Locked';
  buySynergy1Btn.disabled = gameState.tech.synergy1 || gameState.score < 2500;

  synergy2Status.textContent = gameState.tech.synergy2 ? 'Unlocked' : 'Locked';
  buySynergy2Btn.disabled = gameState.tech.synergy2 || gameState.score < 10000;

  const pendingShards = gameState.score >= 50000 ? Math.floor(Math.pow(gameState.score / 50000, 0.5) * 5) : 0;
  ascensionShardsPending.textContent = pendingShards;
  ascensionBoostCurrent.textContent = `+${gameState.shards * 10}%`;
  ascendBtn.disabled = gameState.score < 50000;

  sfxToggleBtn.textContent = gameState.sfxMuted ? '🔇 SFX Off' : '🔊 SFX On';
  updateShooterHUD();
}

function renderAchievementsUI() {
  achievementsListUI.innerHTML = '';
  let unlockedCount = 0;

  achievementsDef.forEach(ach => {
    const isUnlocked = gameState.achievements[ach.id];
    if (isUnlocked) unlockedCount++;

    const card = document.createElement('div');
    card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
    card.innerHTML = `
      <div class="achievement-icon">${ach.icon}</div>
      <div class="achievement-details">
        <h4>${ach.title}</h4>
        <p>${ach.desc}</p>
      </div>
    `;
    achievementsListUI.appendChild(card);
  });

  achievementsCountUI.textContent = `${unlockedCount}/${achievementsDef.length}`;
}

function checkAchievements() {
  if (gameState.totalClicks >= 1 && !gameState.achievements.firstClick) {
    unlockAchievement('firstClick');
  }
  if (gameState.totalEarned >= 100 && !gameState.achievements.hundredEarned) {
    unlockAchievement('hundredEarned');
  }
  if (gameState.totalClicks >= 100 && !gameState.achievements.clickMaster) {
    unlockAchievement('clickMaster');
  }
}

function unlockAchievement(id) {
  if (gameState.achievements[id]) return;
  gameState.achievements[id] = true;
  const def = achievementsDef.find(a => a.id === id);
  if (def) {
    playSound('buy');
    showToast(`🏆 Combat Badge Unlocked: ${def.title}!`);
  }
  renderAchievementsUI();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => { toast.remove(); }, 3500);
}

function saveGame() {
  gameState.lastSaveTimestamp = Date.now();
  localStorage.setItem('3d_counter_clicker_save', JSON.stringify(gameState));
}

function loadGame() {
  const saved = localStorage.getItem('3d_counter_clicker_save');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      gameState = {
        ...gameState,
        ...parsed,
        tech: { ...gameState.tech, ...(parsed.tech || {}) },
        upgrades: { ...gameState.upgrades, ...(parsed.upgrades || {}) },
        achievements: { ...gameState.achievements, ...(parsed.achievements || {}) }
      };
    } catch (err) {
      console.error('Failed to load save:', err);
    }
  }
}

function checkOfflineEarnings() {
  const effectiveCps = getEffectiveCPS();
  if (gameState.lastSaveTimestamp && effectiveCps > 0) {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - gameState.lastSaveTimestamp) / 1000);
    const cappedSeconds = Math.min(elapsedSeconds, 43200);

    if (cappedSeconds > 10) {
      const offlineEarned = Math.floor(effectiveCps * cappedSeconds);
      if (offlineEarned > 0) {
        gameState.score += offlineEarned;
        gameState.totalEarned += offlineEarned;

        modalAmount.textContent = `+${offlineEarned}`;
        modalOverlay.classList.remove('hidden');
      }
    }
  }
}

function resetGame() {
  localStorage.removeItem('3d_counter_clicker_save');
  gameState = {
    score: 0,
    clickPower: 1,
    cps: 0,
    totalClicks: 0,
    totalEarned: 0,
    goldenClicked: 0,
    asteroidsDestroyed: 0,
    ascensionCount: 0,
    shards: 0,
    lastSaveTimestamp: Date.now(),
    sfxMuted: false,
    skin: 'default',
    theme: 'cyan',
    selectedWeapon: 'laser',
    health: 100,
    maxHealth: 100,
    tech: {
      autobuyer: false,
      synergy1: false,
      synergy2: false
    },
    upgrades: {
      multiplier: { count: 0, cost: 10, power: 1 },
      cursor: { count: 0, cost: 15, cps: 1 },
      grandma: { count: 0, cost: 100, cps: 5 },
      factory: { count: 0, cost: 500, cps: 25 }
    },
    achievements: {
      firstClick: false,
      hundredEarned: false,
      firstDrone: false,
      goldenCatcher: false,
      clickMaster: false,
      cosmicArchitect: false,
      firstAscension: false,
      asteroidHunter: false
    }
  };
  weaponHeat = 0;
  isOverheated = false;
  comboStreak = 0;
  frenzyMultiplier = 1;
  frenzyBanner.classList.add('hidden');
  createMainCrystalMesh();
  applyTheme(gameState.theme);
  switchWeapon('laser');
  renderAchievementsUI();
  updateUI();
  update3DSatellites();
}

// Start 3D Game
init();
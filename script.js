// Game State for 3D City Cops vs. Robbers Shooter
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
  theme: 'cyan', // cyan (Downtown Night), nebula (Sunset Harbor), cyberpunk (Cyber Neon), gold (Financial District)
  selectedWeapon: 'laser', // laser (Pistol), plasma (Shotgun), missiles (Rifle)
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

// Commendation Badges Definitions
const achievementsDef = [
  { id: 'firstClick', title: 'First Shot', desc: 'Fire weapon 1 time', icon: '🔫' },
  { id: 'hundredEarned', title: 'Bounty Collector', desc: 'Seize $100 total bounty', icon: '💵' },
  { id: 'firstDrone', title: 'City Patrol', desc: 'Deploy first Patrol Cruiser', icon: '🚔' },
  { id: 'goldenCatcher', title: 'Sharpshooter', desc: 'Neutralize 1 Robber', icon: '🎯' },
  { id: 'clickMaster', title: 'Tactical Veteran', desc: 'Fire 100 total rounds', icon: '⚡' },
  { id: 'cosmicArchitect', title: 'Precinct Overseer', desc: 'Deploy Police Headquarters Matrix', icon: '🏢' },
  { id: 'firstAscension', title: 'Commissioner Rank', desc: 'Earn your first Department Promotion', icon: '⭐' },
  { id: 'asteroidHunter', title: 'Heist Neutralizer', desc: 'Defeat a Robber Getaway Van Boss', icon: '🚨' }
];

// Weapon Definitions
const weaponsDef = {
  laser: { name: 'Service Pistol', heatPerShot: 10, cooldown: 180, multiplier: 1, color: 0x38bdf8 },
  plasma: { name: 'Tactical Shotgun', heatPerShot: 22, cooldown: 400, multiplier: 2.5, color: 0xef4444 },
  missiles: { name: 'Assault Rifle', heatPerShot: 15, cooldown: 200, multiplier: 3.5, color: 0xfbbf24 }
};

// Web Audio API Synthesizer
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
    // Service Pistol Gunshot
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'plasma') {
    // Tactical Shotgun Blast
    osc.type = 'square';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.18);
  } else if (type === 'missiles') {
    // Assault Rifle Burst
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === 'hit') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.06);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === 'buy') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.08);
    osc.frequency.setValueAtTime(783.99, now + 0.16);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'siren') {
    // Police Siren
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.3);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
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
let cityGroup;
let policeSirenLightRed, policeSirenLightBlue;

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

let orbitingCruisers = [];
let raycaster, mouse;

const themePalettes = {
  cyan: { bg: 0x020617, building: 0x1e293b, lightRed: 0xef4444, lightBlue: 0x0284c7 },
  nebula: { bg: 0x1e1b4b, building: 0x312e81, lightRed: 0xf43f5e, lightBlue: 0x818cf8 },
  cyberpunk: { bg: 0x09090b, building: 0x27272a, lightRed: 0xff0055, lightBlue: 0x00f0ff },
  gold: { bg: 0x1c1917, building: 0x292524, lightRed: 0xf59e0b, lightBlue: 0x38bdf8 }
};

// Initialization
function init() {
  loadGame();
  init3D();
  setupEventListeners();
  renderAchievementsUI();
  updateUI();
  update3DCruisers();
  checkOfflineEarnings();

  // Primary Game Loop (every 100ms)
  setInterval(() => {
    // Passive income from units
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
      weaponHeat = Math.max(0, weaponHeat - 2.0);
      if (weaponHeat === 0 && isOverheated) {
        isOverheated = false;
        showToast('✅ Weapon Cooled Down! Ready to Fire.');
      }
    }
    updateShooterHUD();

    // Check Combo Streak timeout
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

  // Spawn Robber Enemies (every 3 seconds)
  setInterval(() => {
    if (activeEnemies.length < 7 && Math.random() < 0.85) {
      spawnRobberEnemy();
    }
  }, 3000);

  // Spawn Robber Getaway Van Boss (every 40 seconds)
  setInterval(() => {
    if (!activeBoss && Math.random() < 0.45) {
      spawnRobberBossVan();
    }
  }, 40000);
}

function getPrestigeMultiplier() {
  return 1 + (gameState.shards * 0.10);
}

function getComboMultiplier() {
  return 1 + Math.min(comboStreak, 20) * 0.2;
}

function getEffectiveClickPower() {
  let basePower = gameState.clickPower;
  if (gameState.tech.synergy2) {
    const swatCps = gameState.upgrades.grandma.count * gameState.upgrades.grandma.cps;
    basePower += swatCps * 0.05;
  }

  const wpn = weaponsDef[gameState.selectedWeapon] || weaponsDef.laser;
  let totalPower = basePower * wpn.multiplier * frenzyMultiplier * getPrestigeMultiplier() * getComboMultiplier();
  return Math.max(1, Math.floor(totalPower));
}

function getEffectiveCPS() {
  let cruiserCps = gameState.upgrades.cursor.count * gameState.upgrades.cursor.cps;
  if (gameState.tech.synergy1) {
    cruiserCps *= (1 + gameState.upgrades.grandma.count * 0.50);
  }

  let totalCps = cruiserCps +
                 (gameState.upgrades.grandma.count * gameState.upgrades.grandma.cps) +
                 (gameState.upgrades.factory.count * gameState.upgrades.factory.cps);

  totalCps *= frenzyMultiplier * getPrestigeMultiplier();
  return totalCps;
}

// Initialize Three.js 3D Procedural City Scene
function init3D() {
  const container = canvasContainer;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 270;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 2.5, 6.5);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Flashing Police Emergency Lights (Red & Blue)
  policeSirenLightRed = new THREE.PointLight(0xef4444, 3, 20);
  policeSirenLightRed.position.set(-3, 4, 3);
  scene.add(policeSirenLightRed);

  policeSirenLightBlue = new THREE.PointLight(0x0284c7, 3, 20);
  policeSirenLightBlue.position.set(3, 4, 3);
  scene.add(policeSirenLightBlue);

  createProceduralCity();

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  window.addEventListener('resize', onWindowResize);
  applyTheme(gameState.theme);
  animate();
}

function createProceduralCity() {
  if (cityGroup) scene.remove(cityGroup);
  cityGroup = new THREE.Group();

  // Asphalt Ground / Street
  const groundGeom = new THREE.PlaneGeometry(16, 16);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.2;
  cityGroup.add(ground);

  // Procedural Buildings Grid
  const buildingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.6,
    roughness: 0.3,
    flatShading: true
  });

  const windowMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

  for (let x = -6; x <= 6; x += 2.2) {
    for (let z = -6; z <= 2; z += 2.2) {
      if (Math.abs(x) < 1.5 && Math.abs(z) < 1.5) continue; // Keep central precinct area clear

      const h = 1.5 + Math.random() * 3.5;
      const bGeom = new THREE.BoxGeometry(1.4, h, 1.4);
      const bMesh = new THREE.Mesh(bGeom, buildingMat);
      bMesh.position.set(x + (Math.random() - 0.5) * 0.3, -1.2 + h / 2, z + (Math.random() - 0.5) * 0.3);
      cityGroup.add(bMesh);

      // Add building window lights
      if (Math.random() < 0.6) {
        const wGeom = new THREE.PlaneGeometry(0.2, 0.2);
        const wMesh = new THREE.Mesh(wGeom, windowMat);
        wMesh.position.set(bMesh.position.x, bMesh.position.y + (Math.random() - 0.5) * (h * 0.6), bMesh.position.z + 0.71);
        cityGroup.add(wMesh);
      }
    }
  }

  // Central Police Precinct Monument
  const pGeom = new THREE.BoxGeometry(1.8, 1.6, 1.8);
  const pMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
  const precinctMesh = new THREE.Mesh(pGeom, pMat);
  precinctMesh.position.set(0, -0.4, 0);
  cityGroup.add(precinctMesh);

  scene.add(cityGroup);
}

function applyTheme(themeKey) {
  const pal = themePalettes[themeKey] || themePalettes.cyan;
  if (scene) scene.background = new THREE.Color(pal.bg);
}

function spawnRobberEnemy() {
  if (!scene) return;
  // Robber Mesh (Aggressive Red Capsule / Cylinder with Mask emblem)
  const geom = new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    metalness: 0.7,
    roughness: 0.3,
    emissive: 0x991b1b,
    emissiveIntensity: 0.6
  });
  const mesh = new THREE.Mesh(geom, mat);

  const angle = Math.random() * Math.PI * 2;
  const startDist = 5.0;
  mesh.position.set(Math.cos(angle) * startDist, -0.9, Math.sin(angle) * startDist);

  const hp = 1 + Math.floor(gameState.ascensionCount * 2);
  const enemy = { mesh, hp, maxHp: hp, speed: 0.02 + Math.random() * 0.015 };
  scene.add(mesh);
  activeEnemies.push(enemy);
}

function spawnRobberBossVan() {
  if (activeBoss || !scene) return;
  // Getaway Van Mesh (Large Heavy Box)
  const geom = new THREE.BoxGeometry(1.4, 0.9, 2.2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.8
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, -0.75, -5.5);

  const hp = Math.max(12, Math.floor(getEffectiveClickPower() * 9));
  activeBoss = { mesh, hp, maxHp: hp, angle: 0, speed: 0.02 };
  scene.add(mesh);

  bossHud.classList.remove('hidden');
  playSound('siren');
  showToast('🚨 ROBBER GETAWAY VAN SPOTTED! Stop the heist before they breach!');
}

function animate() {
  requestAnimationFrame(animate);

  // Police Siren Flashing Animation
  const time = Date.now() * 0.005;
  if (policeSirenLightRed && policeSirenLightBlue) {
    policeSirenLightRed.intensity = Math.sin(time) > 0 ? 4 : 0.5;
    policeSirenLightBlue.intensity = Math.cos(time) > 0 ? 4 : 0.5;
  }

  // Animate Gunshot Projectiles
  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const proj = activeProjectiles[i];
    proj.mesh.position.add(proj.velocity);
    proj.life -= 1;

    if (proj.life <= 0) {
      scene.remove(proj.mesh);
      activeProjectiles.splice(i, 1);
    }
  }

  // Animate Robber Enemies moving towards Precinct
  for (let i = activeEnemies.length - 1; i >= 0; i--) {
    const enemy = activeEnemies[i];
    enemy.mesh.rotation.y += 0.05;

    // Move towards center precinct
    const dir = new THREE.Vector3(0, -0.9, 0).sub(enemy.mesh.position).normalize();
    enemy.mesh.position.addScaledVector(dir, enemy.speed);

    // Check if robber reached precinct (radius < 1.0)
    if (new THREE.Vector2(enemy.mesh.position.x, enemy.mesh.position.z).length() < 1.0) {
      gameState.health = Math.max(0, gameState.health - 12);
      scene.remove(enemy.mesh);
      activeEnemies.splice(i, 1);
      comboStreak = 0;
      updateShooterHUD();
      showToast('💥 Precinct Shield Damaged by Robbers!');

      if (gameState.health <= 0) {
        gameState.health = gameState.maxHealth;
        showToast('🛡️ SWAT Reinforcements Arrived! Precinct Shield Restored.');
      }
    }
  }

  // Animate Boss Van
  if (activeBoss) {
    activeBoss.mesh.position.z += activeBoss.speed;
    if (activeBoss.mesh.position.z > 4.5) {
      activeBoss.speed = -Math.abs(activeBoss.speed);
    } else if (activeBoss.mesh.position.z < -5.5) {
      activeBoss.speed = Math.abs(activeBoss.speed);
    }
  }

  // Animate Patrol Cruisers Orbiting Precinct
  orbitingCruisers.forEach(cruiser => {
    cruiser.angle += cruiser.speed;
    cruiser.mesh.position.x = Math.cos(cruiser.angle) * cruiser.radius;
    cruiser.mesh.position.z = Math.sin(cruiser.angle) * cruiser.radius;
    cruiser.mesh.rotation.y = -cruiser.angle;
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
    showToast('⚠️ WEAPON OVERHEATED! Wait for Cooldown.');
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const wpn = weaponsDef[gameState.selectedWeapon] || weaponsDef.laser;
  weaponHeat = Math.min(100, weaponHeat + wpn.heatPerShot);
  if (weaponHeat >= 100) {
    isOverheated = true;
    showToast('🔥 WEAPON OVERHEATED!');
  }

  raycaster.setFromCamera(mouse, camera);

  // Fire Gunshot Bullet Tracer
  fireBulletTracer(event.clientX - rect.left, event.clientY - rect.top, wpn.color);

  // Check Boss Van Hit
  if (activeBoss) {
    const bossIntersects = raycaster.intersectObject(activeBoss.mesh);
    if (bossIntersects.length > 0) {
      hitBossVan(event.clientX - rect.left, event.clientY - rect.top);
      return;
    }
  }

  // Check Robber Enemy Hit
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

        spawnFloatingText(`+$${bounty} BUST!`, event.clientX - rect.left, event.clientY - rect.top, true);
        playSound('hit');
      }
      break;
    }
  }

  // General City Shot
  triggerShot(event.clientX ? event.clientX - rect.left : rect.width / 2, event.clientY ? event.clientY - rect.top : rect.height / 2);
}

function fireBulletTracer(targetX, targetY, hexColor) {
  if (!scene) return;
  const geom = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: hexColor });
  const proj = new THREE.Mesh(geom, mat);

  proj.position.set(0, -1, 5); // Fire from police cop viewpoint
  const worldTarget = new THREE.Vector3(
    ((targetX / canvasContainer.clientWidth) * 2 - 1) * 4,
    (-((targetY / canvasContainer.clientHeight) * 2 - 1)) * 3,
    -3
  );

  const vel = worldTarget.sub(proj.position).normalize().multiplyScalar(0.45);
  proj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize());

  scene.add(proj);
  activeProjectiles.push({ mesh: proj, velocity: vel, life: 14 });
  playSound(gameState.selectedWeapon);
}

function hitBossVan(x, y) {
  if (!activeBoss) return;
  const damage = getEffectiveClickPower();
  activeBoss.hp -= damage;

  comboStreak += 1;
  lastHitTime = Date.now();

  spawnFloatingText(`-$${damage}`, x, y, true);
  playSound('hit');

  if (activeBoss.hp <= 0) {
    scene.remove(activeBoss.mesh);
    activeBoss = null;
    bossHud.classList.add('hidden');

    const bossBounty = Math.max(150, Math.floor(getEffectiveCPS() * 30 + 250));
    gameState.score += bossBounty;
    gameState.totalEarned += bossBounty;
    gameState.asteroidsDestroyed += 1;

    showToast(`🚨 ROBBER GETAWAY VAN NEUTRALIZED! Seized +$${bossBounty} Bounty!`);
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

  recentClicksTimestamps.push(Date.now());
  spawnFloatingText(`+$${addedPoints}`, x, y, frenzyMultiplier > 1 || comboStreak > 5);

  checkAchievements();
  updateUI();
}

function updateShooterHUD() {
  healthText.textContent = `${gameState.health}/${gameState.maxHealth}`;
  healthBarFill.style.width = `${(gameState.health / gameState.maxHealth) * 100}%`;

  heatText.textContent = `${Math.floor(weaponHeat)}%`;
  heatBarFill.style.width = `${weaponHeat}%`;

  comboDisplay.textContent = `STREAK ${comboStreak}x`;

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

function update3DCruisers() {
  if (!scene) return;
  orbitingCruisers.forEach(c => scene.remove(c.mesh));
  orbitingCruisers = [];

  const totalUnits = gameState.upgrades.cursor.count +
                     gameState.upgrades.grandma.count +
                     gameState.upgrades.factory.count;

  const countToSpawn = Math.min(totalUnits, 20);
  for (let i = 0; i < countToSpawn; i++) {
    const isBig = i >= 8;
    const geom = isBig ? new THREE.BoxGeometry(0.35, 0.2, 0.6) : new THREE.BoxGeometry(0.25, 0.15, 0.45);
    const mat = new THREE.MeshStandardMaterial({
      color: isBig ? 0x0284c7 : 0xef4444,
      metalness: 0.8,
      roughness: 0.2,
      emissive: isBig ? 0x0369a1 : 0x991b1b,
      emissiveIntensity: 0.5
    });

    const mesh = new THREE.Mesh(geom, mat);
    const radius = 2.2 + (i % 3) * 0.5;
    const angle = (i / countToSpawn) * Math.PI * 2;
    const speed = 0.012 + (i % 4) * 0.004;

    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.z = Math.sin(angle) * radius;
    mesh.position.y = -0.9;

    scene.add(mesh);
    orbitingCruisers.push({ mesh, radius, angle, speed });
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
      showToast('🤖 Auto-Bust Dispatcher Unlocked!');
      updateUI();
    }
  });

  buySynergy1Btn.addEventListener('click', () => {
    if (gameState.score >= 2500 && !gameState.tech.synergy1) {
      gameState.score -= 2500;
      gameState.tech.synergy1 = true;
      playSound('buy');
      showToast('🚨 Cruiser Siren Overcharge Unlocked!');
      updateUI();
    }
  });

  buySynergy2Btn.addEventListener('click', () => {
    if (gameState.score >= 10000 && !gameState.tech.synergy2) {
      gameState.score -= 10000;
      gameState.tech.synergy2 = true;
      playSound('buy');
      showToast('🎯 SWAT Sniper Radar Unlocked!');
      updateUI();
    }
  });

  ascendBtn.addEventListener('click', () => {
    if (gameState.score >= 50000) {
      const earnedStars = Math.floor(Math.pow(gameState.score / 50000, 0.5) * 5);
      if (confirm(`Promote to Police Commissioner now for ${earnedStars} Merit Stars? This resets cash and precinct units, but grants a permanent +${earnedStars * 10}% boost!`)) {
        performAscension(earnedStars);
      }
    }
  });

  sfxToggleBtn.addEventListener('click', () => {
    gameState.sfxMuted = !gameState.sfxMuted;
    sfxToggleBtn.textContent = gameState.sfxMuted ? '🔇 SFX Off' : '🔊 SFX On';
  });

  saveBtn.addEventListener('click', () => {
    saveGame();
    showToast('💾 Progress Saved!');
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your police records and reset progress?')) {
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

function performAscension(earnedStars) {
  gameState.shards += earnedStars;
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
  showToast(`⭐ PROMOTION COMPLETE! Earned ${earnedStars} Merit Stars!`);

  checkAchievements();
  updateUI();
  update3DCruisers();
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
    update3DCruisers();
  }
}

function updateUI() {
  scoreDisplay.textContent = `$${Math.floor(gameState.score)}`;
  cpsDisplay.textContent = `$${Math.floor(getEffectiveCPS())} per sec`;
  clickPowerDisplay.textContent = `+$${Math.floor(getEffectiveClickPower())} per bust`;

  shardsDisplay.textContent = `⭐ ${gameState.shards} Merit Stars (+${gameState.shards * 10}%)`;

  themeSelect.value = gameState.theme;

  statTotalClicksDetailed.textContent = gameState.totalClicks;
  statTotalEarnedDetailed.textContent = `$${Math.floor(gameState.totalEarned)}`;

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

  const pendingStars = gameState.score >= 50000 ? Math.floor(Math.pow(gameState.score / 50000, 0.5) * 5) : 0;
  ascensionShardsPending.textContent = pendingStars;
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
    showToast(`🏆 Badge Commendation Unlocked: ${def.title}!`);
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
  localStorage.setItem('3d_city_shooter_save', JSON.stringify(gameState));
}

function loadGame() {
  const saved = localStorage.getItem('3d_city_shooter_save');
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

        modalAmount.textContent = `+$${offlineEarned}`;
        modalOverlay.classList.remove('hidden');
      }
    }
  }
}

function resetGame() {
  localStorage.removeItem('3d_city_shooter_save');
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
  applyTheme(gameState.theme);
  switchWeapon('laser');
  renderAchievementsUI();
  updateUI();
  update3DCruisers();
}

// Start 3D Game
init();
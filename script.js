// Game State
let gameState = {
  score: 0,
  clickPower: 1,
  cps: 0,
  totalClicks: 0,
  totalEarned: 0,
  lastSaveTimestamp: Date.now(),
  sfxMuted: false,
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
    cosmicArchitect: false
  }
};

// Definitions for Achievements
const achievementsDef = [
  { id: 'firstClick', title: 'First Spark', desc: 'Click the crystal 1 time', icon: '💎' },
  { id: 'hundredEarned', title: 'Century Club', desc: 'Earn 100 total points', icon: '🪙' },
  { id: 'firstDrone', title: 'Automated', desc: 'Buy your first Drone', icon: '🤖' },
  { id: 'goldenCatcher', title: 'Gold Rush', desc: 'Click a Golden Crystal', icon: '🌟' },
  { id: 'clickMaster', title: 'Click Master', desc: 'Click 100 total times', icon: '⚡' },
  { id: 'cosmicArchitect', title: 'Cosmic Architect', desc: 'Buy a Cosmic Core', icon: '🌌' }
];

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

  if (type === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
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
  } else if (type === 'golden') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.3);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'achievement') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.1);
    osc.frequency.setValueAtTime(783.99, now + 0.2);
    osc.frequency.setValueAtTime(1046.50, now + 0.3);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.45);
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

const statTotalClicks = document.getElementById('stat-total-clicks');
const statTotalEarned = document.getElementById('stat-total-earned');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');

const achievementsListUI = document.getElementById('achievements-list');
const achievementsCountUI = document.getElementById('achievements-count');
const toastContainer = document.getElementById('toast-container');

const modalOverlay = document.getElementById('modal-overlay');
const modalAmount = document.getElementById('modal-amount');
const modalClaimBtn = document.getElementById('modal-claim-btn');

const upgradesUI = {
  multiplier: {
    count: document.getElementById('count-multiplier'),
    cost: document.getElementById('cost-multiplier'),
    btn: document.getElementById('buy-multiplier')
  },
  cursor: {
    count: document.getElementById('count-cursor'),
    cost: document.getElementById('cost-cursor'),
    btn: document.getElementById('buy-cursor')
  },
  grandma: {
    count: document.getElementById('count-grandma'),
    cost: document.getElementById('cost-grandma'),
    btn: document.getElementById('buy-grandma')
  },
  factory: {
    count: document.getElementById('count-factory'),
    cost: document.getElementById('cost-factory'),
    btn: document.getElementById('buy-factory')
  }
};

// Three.js 3D Variables
let scene, camera, renderer;
let mainCrystal, crystalWireframe, starField;
let goldenCrystal = null;
let frenzyEndTime = 0;
let frenzyMultiplier = 1;

let orbitingSatellites = [];
let raycaster, mouse;
let targetScale = 1;
let currentScale = 1;

// Initialization
function init() {
  loadGame();
  init3D();
  setupEventListeners();
  renderAchievementsUI();
  updateUI();
  update3DSatellites();
  checkOfflineEarnings();

  // Passive income game loop (every 100ms)
  setInterval(() => {
    let currentCps = gameState.cps * frenzyMultiplier;
    if (currentCps > 0) {
      const passiveGain = currentCps / 10;
      gameState.score += passiveGain;
      gameState.totalEarned += passiveGain;
      updateUI();
      checkAchievements();
    }

    // Check frenzy expiration
    if (frenzyMultiplier > 1 && Date.now() > frenzyEndTime) {
      frenzyMultiplier = 1;
      frenzyBanner.classList.add('hidden');
    }
  }, 100);

  // Auto-save every 10 seconds
  setInterval(() => {
    saveGame();
  }, 10000);

  // Random Golden Crystal spawn check (every 15 seconds)
  setInterval(() => {
    if (!goldenCrystal && Math.random() < 0.35) {
      spawnGoldenCrystal();
    }
  }, 15000);
}

// Initialize Three.js 3D Scene
function init3D() {
  const container = canvasContainer;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 280;

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

  // Main 3D Crystal Object (Icosahedron)
  const geometry = new THREE.IcosahedronGeometry(1.4, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.1,
    metalness: 0.8,
    flatShading: true,
    emissive: 0x0369a1,
    emissiveIntensity: 0.3
  });
  mainCrystal = new THREE.Mesh(geometry, material);
  scene.add(mainCrystal);

  // Outer Wireframe Overlay
  const wireGeometry = new THREE.IcosahedronGeometry(1.5, 0);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.4
  });
  crystalWireframe = new THREE.Mesh(wireGeometry, wireMaterial);
  scene.add(crystalWireframe);

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
  const starsMaterial = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.08,
    transparent: true,
    opacity: 0.6
  });
  starField = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(starField);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  window.addEventListener('resize', onWindowResize);
  animate();
}

function spawnGoldenCrystal() {
  if (goldenCrystal || !scene) return;
  const geom = new THREE.DodecahedronGeometry(0.35, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0xd97706,
    emissiveIntensity: 0.8
  });
  goldenCrystal = new THREE.Mesh(geom, mat);

  // Random position floating near center
  const angle = Math.random() * Math.PI * 2;
  const dist = 1.8 + Math.random() * 0.8;
  goldenCrystal.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, (Math.random() - 0.5) * 1);
  goldenCrystal.userData = { spawnTime: Date.now() };

  scene.add(goldenCrystal);

  // Auto remove after 8 seconds if not clicked
  setTimeout(() => {
    if (goldenCrystal) {
      scene.remove(goldenCrystal);
      goldenCrystal = null;
    }
  }, 8000);
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

  if (goldenCrystal) {
    goldenCrystal.rotation.x += 0.02;
    goldenCrystal.rotation.y += 0.03;
    const pulseScale = 1 + Math.sin(Date.now() * 0.008) * 0.15;
    goldenCrystal.scale.set(pulseScale, pulseScale, pulseScale);
  }

  if (starField) {
    starField.rotation.y += 0.0008;
  }

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

function handle3DClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Check Golden Crystal click first
  if (goldenCrystal) {
    const goldenIntersects = raycaster.intersectObject(goldenCrystal);
    if (goldenIntersects.length > 0) {
      triggerGoldenClick(event.clientX - rect.left, event.clientY - rect.top);
      return;
    }
  }

  const intersects = raycaster.intersectObjects([mainCrystal, crystalWireframe]);

  if (intersects.length > 0 || event.target === clickBtn) {
    const clickX = event.clientX ? event.clientX - rect.left : rect.width / 2;
    const clickY = event.clientY ? event.clientY - rect.top : rect.height / 2;
    triggerClick(clickX, clickY);
  }
}

function triggerGoldenClick(x, y) {
  if (!goldenCrystal) return;
  scene.remove(goldenCrystal);
  goldenCrystal = null;

  frenzyMultiplier = 7;
  frenzyEndTime = Date.now() + 10000; // 10 seconds of 7x frenzy
  frenzyBanner.classList.remove('hidden');

  const bonusPoints = Math.max(10, Math.floor(gameState.cps * 15 + gameState.clickPower * 10));
  gameState.score += bonusPoints;
  gameState.totalEarned += bonusPoints;

  spawnFloatingText(`+${bonusPoints} FRENZY!`, x, y, true);
  playSound('golden');
  showToast('🌟 GOLDEN FRENZY! 7x Multiplier for 10s!');

  gameState.achievements.goldenCatcher = true;
  checkAchievements();
  updateUI();
}

function triggerClick(x = 200, y = 140) {
  const addedPoints = gameState.clickPower * frenzyMultiplier;
  gameState.score += addedPoints;
  gameState.totalEarned += addedPoints;
  gameState.totalClicks += 1;
  targetScale = 0.85;

  spawnFloatingText(`+${addedPoints}`, x, y, frenzyMultiplier > 1);
  playSound('click');
  checkAchievements();
  updateUI();
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
  canvasContainer.addEventListener('pointerdown', handle3DClick);
  clickBtn.addEventListener('click', (e) => {
    const rect = canvasContainer.getBoundingClientRect();
    triggerClick(rect.width / 2, rect.height / 2);
  });

  Object.keys(upgradesUI).forEach(key => {
    upgradesUI[key].btn.addEventListener('click', () => buyUpgrade(key));
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
  cpsDisplay.textContent = `${gameState.cps * frenzyMultiplier} per sec`;
  clickPowerDisplay.textContent = `+${gameState.clickPower * frenzyMultiplier} per click`;

  statTotalClicks.textContent = gameState.totalClicks;
  statTotalEarned.textContent = Math.floor(gameState.totalEarned);

  Object.keys(upgradesUI).forEach(key => {
    const upgrade = gameState.upgrades[key];
    const ui = upgradesUI[key];
    ui.count.textContent = upgrade.count;
    ui.cost.textContent = upgrade.cost;
    ui.btn.disabled = gameState.score < upgrade.cost;
  });

  sfxToggleBtn.textContent = gameState.sfxMuted ? '🔇 SFX Off' : '🔊 SFX On';
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
    playSound('achievement');
    showToast(`🏆 Achievement Unlocked: ${def.title}!`);
  }
  renderAchievementsUI();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
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
        upgrades: { ...gameState.upgrades, ...(parsed.upgrades || {}) },
        achievements: { ...gameState.achievements, ...(parsed.achievements || {}) }
      };
    } catch (err) {
      console.error('Failed to load save:', err);
    }
  }
}

function checkOfflineEarnings() {
  if (gameState.lastSaveTimestamp && gameState.cps > 0) {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - gameState.lastSaveTimestamp) / 1000);
    // Cap offline progress at 12 hours (43200s)
    const cappedSeconds = Math.min(elapsedSeconds, 43200);

    if (cappedSeconds > 10) {
      const offlineEarned = Math.floor(gameState.cps * cappedSeconds);
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
    lastSaveTimestamp: Date.now(),
    sfxMuted: false,
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
      cosmicArchitect: false
    }
  };
  frenzyMultiplier = 1;
  frenzyBanner.classList.add('hidden');
  renderAchievementsUI();
  updateUI();
  update3DSatellites();
}

// Start 3D Game
init();
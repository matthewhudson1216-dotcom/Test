// Game State
let gameState = {
  score: 0,
  clickPower: 1,
  cps: 0,
  totalClicks: 0,
  totalEarned: 0,
  upgrades: {
    multiplier: { count: 0, cost: 10, power: 1 },
    cursor: { count: 0, cost: 15, cps: 1 },
    grandma: { count: 0, cost: 100, cps: 5 },
    factory: { count: 0, cost: 500, cps: 25 }
  }
};

// DOM Elements
const scoreDisplay = document.getElementById('score');
const cpsDisplay = document.getElementById('cps-display');
const clickPowerDisplay = document.getElementById('click-power-display');
const clickBtn = document.getElementById('click-btn');
const canvasContainer = document.getElementById('canvas-container');

const statTotalClicks = document.getElementById('stat-total-clicks');
const statTotalEarned = document.getElementById('stat-total-earned');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');

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
let orbitingSatellites = [];
let raycaster, mouse;
let targetScale = 1;
let currentScale = 1;

// Initialization
function init() {
  loadGame();
  init3D();
  setupEventListeners();
  updateUI();
  update3DSatellites();

  // Passive income game loop (every 100ms)
  setInterval(() => {
    if (gameState.cps > 0) {
      const passiveGain = gameState.cps / 10;
      gameState.score += passiveGain;
      gameState.totalEarned += passiveGain;
      updateUI();
    }
  }, 100);
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
  const intersects = raycaster.intersectObjects([mainCrystal, crystalWireframe]);

  if (intersects.length > 0 || event.target === clickBtn) {
    triggerClick();
  }
}

function triggerClick() {
  gameState.score += gameState.clickPower;
  gameState.totalEarned += gameState.clickPower;
  gameState.totalClicks += 1;
  targetScale = 0.85;
  updateUI();
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
  clickBtn.addEventListener('click', triggerClick);

  Object.keys(upgradesUI).forEach(key => {
    upgradesUI[key].btn.addEventListener('click', () => buyUpgrade(key));
  });

  saveBtn.addEventListener('click', () => {
    saveGame();
    alert('Game Saved!');
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset your 3D game progress?')) {
      resetGame();
    }
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

    upgrade.cost = Math.floor(upgrade.cost * 1.15);
    updateUI();
    update3DSatellites();
  }
}

function updateUI() {
  scoreDisplay.textContent = Math.floor(gameState.score);
  cpsDisplay.textContent = `${gameState.cps} per sec`;
  clickPowerDisplay.textContent = `+${gameState.clickPower} per click`;

  statTotalClicks.textContent = gameState.totalClicks;
  statTotalEarned.textContent = Math.floor(gameState.totalEarned);

  Object.keys(upgradesUI).forEach(key => {
    const upgrade = gameState.upgrades[key];
    const ui = upgradesUI[key];
    ui.count.textContent = upgrade.count;
    ui.cost.textContent = upgrade.cost;
    ui.btn.disabled = gameState.score < upgrade.cost;
  });
}

function saveGame() {
  localStorage.setItem('3d_counter_clicker_save', JSON.stringify(gameState));
}

function loadGame() {
  const saved = localStorage.getItem('3d_counter_clicker_save');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      gameState = { ...gameState, ...parsed };
    } catch (err) {
      console.error('Failed to load save:', err);
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
    upgrades: {
      multiplier: { count: 0, cost: 10, power: 1 },
      cursor: { count: 0, cost: 15, cps: 1 },
      grandma: { count: 0, cost: 100, cps: 5 },
      factory: { count: 0, cost: 500, cps: 25 }
    }
  };
  updateUI();
  update3DSatellites();
}

// Start 3D Game
init();
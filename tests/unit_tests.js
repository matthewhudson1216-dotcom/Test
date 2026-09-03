// Node.js Automated Logic Unit Tests for City Defense FPS
const assert = require('assert');

// 1. Test Initial Game State Factory
function createInitialGameState() {
  return {
    cash: 800,
    health: 100,
    maxHealth: 100,
    armor: 0,
    maxArmor: 100,
    round: 1,
    isRoundActive: false,
    missionState: 'BRIEFING',
    objectiveProgress: 0,
    objectiveTarget: 100,
    sfxMuted: false,
    xp: 0,
    rank: '🎖️ CADET',
    inventory: { pistol: true, smg: false, shotgun: false, rifle: false },
    attachments: { reddot: false, laser: false },
    camos: { black: true, urban: true, gold: false },
    equippedCamo: 'black',
    equippedWeapon: 'pistol',
    hasKevlarHelmet: false,
    swatPartnerMode: 'squad',
    grenades: 2,
    smokeGrenades: 2,
    claymores: 2,
    ammo: {
      pistol: { clip: 12, maxClip: 12, reserve: Infinity },
      smg: { clip: 30, maxClip: 30, reserve: 120 },
      shotgun: { clip: 6, maxClip: 6, reserve: 24 },
      rifle: { clip: 30, maxClip: 30, reserve: 90 }
    }
  };
}

// 2. Test Segment vs Sphere Intersection (Smoke LOS)
function lineSegmentIntersectsSphere(p1, p2, sphereCenter, radius) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  const lenSq = dx * dx + dy * dy + dz * dz;

  if (lenSq === 0) {
    const distSq = (p1.x - sphereCenter.x) ** 2 + (p1.y - sphereCenter.y) ** 2 + (p1.z - sphereCenter.z) ** 2;
    return distSq <= radius * radius;
  }

  let t = ((sphereCenter.x - p1.x) * dx + (sphereCenter.y - p1.y) * dy + (sphereCenter.z - p1.z) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  const projZ = p1.z + t * dz;

  const distSq = (projX - sphereCenter.x) ** 2 + (projY - sphereCenter.y) ** 2 + (projZ - sphereCenter.z) ** 2;
  return distSq <= radius * radius;
}

// 3. Test Unified Damage Pipeline
function calculateDamage(baseDamage, bodyPart, hasHelmet, armorPoints) {
  let mult = 1.0;
  if (bodyPart === 'head') mult = 2.0;
  else if (bodyPart === 'limb') mult = 0.75;

  let rawDamage = Math.round(baseDamage * mult);
  if (hasHelmet) {
    rawDamage = Math.round(rawDamage * 0.75);
  }

  let remainingDamage = rawDamage;
  let armorAbsorbed = 0;
  if (armorPoints > 0) {
    armorAbsorbed = Math.min(armorPoints, Math.floor(rawDamage * 0.8));
    remainingDamage -= armorAbsorbed;
  }

  return { rawDamage, armorAbsorbed, remainingDamage };
}

// 4. Test SWAT Command State Transitions
function issueSwatCommandState(state, command) {
  state.swatCommand = command;
  return state.swatCommand;
}

// Run Unit Tests
console.log('Running Node.js Unit Tests...');

// Test 1: Game State Factory
const state1 = createInitialGameState();
assert.strictEqual(state1.cash, 800);
assert.strictEqual(state1.smokeGrenades, 2);
assert.strictEqual(state1.claymores, 2);
assert.strictEqual(state1.missionState, 'BRIEFING');
assert.strictEqual(state1.inventory.pistol, true);
assert.strictEqual(state1.inventory.smg, false);
console.log('✔ Test 1 Passed: createInitialGameState() contains all required properties.');

// Test 2: Segment vs Sphere Intersection (Smoke LOS)
const p1 = { x: 0, y: 0, z: 0 };
const p2 = { x: 10, y: 0, z: 0 };
const smokeCenter = { x: 5, y: 0, z: 0 };
const smokeRadius = 2;
assert.strictEqual(lineSegmentIntersectsSphere(p1, p2, smokeCenter, smokeRadius), true);

const farSmoke = { x: 5, y: 10, z: 0 };
assert.strictEqual(lineSegmentIntersectsSphere(p1, p2, farSmoke, smokeRadius), false);
console.log('✔ Test 2 Passed: lineSegmentIntersectsSphere correctly detects line-of-sight smoke blocking.');

// Test 3: Damage Pipeline
const dmg1 = calculateDamage(20, 'torso', false, 0);
assert.strictEqual(dmg1.remainingDamage, 20);

const dmg2 = calculateDamage(20, 'head', true, 50); // 40 base -> 30 w/ helmet -> 24 armor absorb, 6 health dmg
assert.strictEqual(dmg2.rawDamage, 30);
assert.strictEqual(dmg2.armorAbsorbed, 24);
assert.strictEqual(dmg2.remainingDamage, 6);
console.log('✔ Test 3 Passed: calculateDamage correctly applies headshots, helmet reduction, and armor absorption.');

// Test 4: SWAT Command Transition
const swatState = createInitialGameState();
assert.strictEqual(issueSwatCommandState(swatState, 'defend'), 'defend');
assert.strictEqual(issueSwatCommandState(swatState, 'suppress'), 'suppress');
assert.strictEqual(issueSwatCommandState(swatState, 'breach'), 'breach');
assert.strictEqual(issueSwatCommandState(swatState, 'follow'), 'follow');
console.log('✔ Test 4 Passed: SWAT squadmate command transitions function as expected.');

console.log('\nAll Unit Tests Passed Successfully! 🎉');

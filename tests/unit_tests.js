// Node.js Automated Logic Unit Tests for Tactical Aim & Reaction Lab
const assert = require('assert');

// 1. Accuracy Calculator Logic
function calculateAccuracy(hits, totalClicks) {
  if (totalClicks <= 0) return 100.0;
  return Math.round((hits / totalClicks) * 1000) / 10;
}

// 2. Average Reaction Time Calculator
function calculateAvgReactionTime(trials) {
  if (!trials || trials.length === 0) return 0;
  const sum = trials.reduce((a, b) => a + b, 0);
  return Math.round(sum / trials.length);
}

// 3. Score Calculation with Speed Multiplier
function calculateHitScore(mode, elapsedSec) {
  const basePts = mode === 'micro' ? 150 : 100;
  const bonusPts = Math.max(0, Math.round(100 * (1 - elapsedSec)));
  return basePts + bonusPts;
}

// 4. Pointer Lock Delta Mouse Translation
function updateCrosshairPos(current, deltaX, deltaY, sensitivity, canvasWidth, canvasHeight) {
  const dx = deltaX * sensitivity;
  const dy = deltaY * sensitivity;

  const newX = Math.max(0, Math.min(canvasWidth, current.x + dx));
  const newY = Math.max(0, Math.min(canvasHeight, current.y + dy));

  return { x: newX, y: newY };
}

// 5. Target Collision Ray/Point Distance Check
function isTargetHit(clickX, clickY, targetX, targetY, radius) {
  const dist = Math.hypot(clickX - targetX, clickY - targetY);
  return dist <= radius;
}

// 6. Rank Classification Resolver
function getPerformanceRank(mode, score, avgReactionMs) {
  if (mode === 'gridshot') {
    if (score >= 2000) return '🏆 RADIANT FLICKER';
    if (score >= 1200) return '⚡ ELITE AIMER';
    if (score >= 600) return '🎯 SHARPSHOOTER';
    return '🎖️ RECRUIT';
  } else if (mode === 'micro') {
    if (score >= 1800) return '🏆 PRECISION GOD';
    if (score >= 1000) return '⚡ MICRO MASTER';
    return '🎯 RECRUIT';
  } else if (mode === 'reaction') {
    if (avgReactionMs > 0 && avgReactionMs <= 190) return '⚡ HUMAN REFLEX GOD (<190ms)';
    if (avgReactionMs <= 230) return '🏆 PRO CS2 REFLEXES (<230ms)';
    if (avgReactionMs <= 280) return '🎯 AVERAGE REFLEXES';
    return '🐢 SLOW RESPONSE';
  }
  return '🎖️ PARTICIPANT';
}

// Run Unit Tests
console.log('Running Node.js Logic Unit Tests for Aim & Reaction Trainer...');

// Test 1: Accuracy Calculations
assert.strictEqual(calculateAccuracy(10, 10), 100.0);
assert.strictEqual(calculateAccuracy(5, 10), 50.0);
assert.strictEqual(calculateAccuracy(0, 0), 100.0);
assert.strictEqual(calculateAccuracy(1, 3), 33.3);
console.log('✔ Test 1 Passed: calculateAccuracy handles normal and edge cases (0 clicks).');

// Test 2: Average Reaction Time Calculations
assert.strictEqual(calculateAvgReactionTime([200, 220, 180, 210, 190]), 200);
assert.strictEqual(calculateAvgReactionTime([]), 0);
assert.strictEqual(calculateAvgReactionTime([150]), 150);
console.log('✔ Test 2 Passed: calculateAvgReactionTime calculates exact averages.');

// Test 3: Hit Score Multipliers
assert.strictEqual(calculateHitScore('gridshot', 0), 200); // 100 base + 100 bonus
assert.strictEqual(calculateHitScore('gridshot', 0.5), 150); // 100 base + 50 bonus
assert.strictEqual(calculateHitScore('gridshot', 2.0), 100); // 100 base + 0 bonus
assert.strictEqual(calculateHitScore('micro', 0), 250); // 150 base + 100 bonus
console.log('✔ Test 3 Passed: calculateHitScore computes base and speed decay bonuses.');

// Test 4: Crosshair Movement Scaling
const pos1 = updateCrosshairPos({ x: 500, y: 300 }, 10, -5, 1.5, 1280, 720);
assert.strictEqual(pos1.x, 515); // 500 + (10 * 1.5)
assert.strictEqual(pos1.y, 292.5); // 300 + (-5 * 1.5)

// Boundary Clamping Test
const pos2 = updateCrosshairPos({ x: 10, y: 10 }, -50, -50, 1.0, 1280, 720);
assert.strictEqual(pos2.x, 0);
assert.strictEqual(pos2.y, 0);
console.log('✔ Test 4 Passed: updateCrosshairPos scales movement and clamps to canvas boundaries.');

// Test 5: Target Collision Check
assert.strictEqual(isTargetHit(100, 100, 100, 100, 25), true); // Center hit
assert.strictEqual(isTargetHit(115, 100, 100, 100, 25), true); // Edge hit (dist 15 <= 25)
assert.strictEqual(isTargetHit(130, 100, 100, 100, 25), false); // Miss hit (dist 30 > 25)
console.log('✔ Test 5 Passed: isTargetHit accurately detects target circle collisions.');

// Test 6: Performance Rank Resolver
assert.strictEqual(getPerformanceRank('gridshot', 2100, 0), '🏆 RADIANT FLICKER');
assert.strictEqual(getPerformanceRank('gridshot', 1400, 0), '⚡ ELITE AIMER');
assert.strictEqual(getPerformanceRank('reaction', 0, 180), '⚡ HUMAN REFLEX GOD (<190ms)');
assert.strictEqual(getPerformanceRank('reaction', 0, 220), '🏆 PRO CS2 REFLEXES (<230ms)');
console.log('✔ Test 6 Passed: getPerformanceRank assigns accurate performance badges.');

console.log('\nAll Unit Tests Passed Successfully! 🎉');

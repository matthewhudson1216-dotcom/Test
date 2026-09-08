// Tactical Aim & Reaction Trainer - Core Game Logic & HTML Canvas Engine
(function () {
  'use strict';

  // --- State Architecture ---
  const state = {
    mode: 'gridshot', // 'gridshot', 'micro', 'reaction'
    sensitivity: 1.0,
    pointerLockEnabled: false,
    sfxMuted: false,
    targetColorTheme: 'cyan', // 'cyan', 'green', 'orange', 'white'
    crosshairStyle: 'cross', // 'cross', 'dot', 'circle'

    isDrillActive: false,
    isCountingDown: false,
    countdownVal: 3,

    timer: 30.0, // Countdown timer in seconds
    timerInterval: null,
    drillStartTime: 0,

    score: 0,
    hits: 0,
    misses: 0,
    accuracy: 100.0,
    avgReactionMs: 0,

    targets: [], // Array of active target objects {id, x, y, radius, spawnTime}
    effects: [], // Visual particle burst / ripple effects {x, y, radius, maxRadius, alpha, color, text}

    // Reaction Time Mode Variables
    reactionState: 'IDLE', // 'IDLE', 'WAITING', 'DELAYING', 'FLASHING', 'RESULT'
    reactionTrials: [], // Array of trial reaction times in ms
    maxReactionTrials: 5,
    reactionTimerTimeout: null,
    reactionFlashStart: 0,

    // High Scores Persistence
    records: {
      gridshot: { score: 0, acc: 0 },
      micro: { score: 0, acc: 0 },
      reaction: { bestMs: null, avgMs: null }
    },

    // Pointer Lock Virtual Crosshair Position
    crosshair: { x: 640, y: 360 }
  };

  // --- Audio Synthesizer (Web Audio API) ---
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (state.sfxMuted) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'hit') {
      // Crisp neon hit ding
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08); // A6
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'miss') {
      // Low thud error sound
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'flash') {
      // High-frequency reflex pop sound
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1600, now + 0.04);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'tick') {
      // Countdown tick
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'complete') {
      // Fanfare completion melody
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(0.2, now + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now + idx * 0.08);
        o.stop(now + idx * 0.08 + 0.2);
      });
    }
  }

  // --- DOM Elements ---
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const hudTimerEl = document.getElementById('hud-timer');
  const hudScoreEl = document.getElementById('hud-score');
  const hudHitsEl = document.getElementById('hud-hits');
  const hudMissesEl = document.getElementById('hud-misses');
  const hudAccuracyEl = document.getElementById('hud-accuracy');
  const hudReactionEl = document.getElementById('hud-reaction-time');

  const countdownOverlay = document.getElementById('countdown-overlay');
  const toastContainer = document.getElementById('toast-container');

  const pillGridshot = document.getElementById('pill-gridshot');
  const pillMicro = document.getElementById('pill-micro');
  const pillReaction = document.getElementById('pill-reaction');

  const startDrillActionBtn = document.getElementById('start-drill-action-btn');
  const resetDrillBtn = document.getElementById('reset-drill-btn');
  const pointerLockToggleBtn = document.getElementById('pointer-lock-toggle-btn');
  const sfxToggleBtn = document.getElementById('sfx-toggle-btn');
  const mainMenuTriggerBtn = document.getElementById('main-menu-trigger-btn');

  const mainMenuModal = document.getElementById('main-menu-modal');
  const cardGridshot = document.getElementById('card-gridshot');
  const cardMicro = document.getElementById('card-micro');
  const cardReaction = document.getElementById('card-reaction');

  const settingSensInput = document.getElementById('setting-sens');
  const sensValDisplay = document.getElementById('sens-val-display');
  const pointerLockCheckbox = document.getElementById('setting-pointer-lock-checkbox');
  const targetColorSelect = document.getElementById('setting-target-color');
  const crosshairStyleSelect = document.getElementById('setting-crosshair-style');
  const closeMenuStartBtn = document.getElementById('close-menu-start-btn');

  const resultsModal = document.getElementById('results-modal');
  const resultsRankBadge = document.getElementById('results-rank-badge');
  const resultsTitle = document.getElementById('results-title');
  const resultsScore = document.getElementById('results-score');
  const resultsAccuracy = document.getElementById('results-accuracy');
  const resultsHitsMisses = document.getElementById('results-hits-misses');
  const resultsReaction = document.getElementById('results-reaction');
  const reactionTrialsContainer = document.getElementById('reaction-trials-container');
  const trialsList = document.getElementById('trials-list');
  const retryDrillBtn = document.getElementById('retry-drill-btn');
  const returnMenuBtn = document.getElementById('return-menu-btn');

  // --- High Score Persistence ---
  function loadRecords() {
    try {
      const saved = localStorage.getItem('aim_lab_records_v1');
      if (saved) {
        state.records = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    updateMenuStatsUI();
  }

  function saveRecords() {
    try {
      localStorage.setItem('aim_lab_records_v1', JSON.stringify(state.records));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
    updateMenuStatsUI();
  }

  function updateMenuStatsUI() {
    document.getElementById('best-gridshot-score').textContent = state.records.gridshot.score;
    document.getElementById('best-gridshot-acc').textContent = state.records.gridshot.acc + '%';

    document.getElementById('best-micro-score').textContent = state.records.micro.score;
    document.getElementById('best-micro-acc').textContent = state.records.micro.acc + '%';

    document.getElementById('best-reaction-ms').textContent = state.records.reaction.bestMs ? state.records.reaction.bestMs + ' ms' : '-- ms';
    document.getElementById('best-reaction-avg').textContent = state.records.reaction.avgMs ? state.records.reaction.avgMs + ' ms' : '-- ms';
  }

  // --- Target Color Palette ---
  function getThemeColors() {
    switch (state.targetColorTheme) {
      case 'green':
        return { outer: '#10b981', inner: '#ef4444', glow: 'rgba(16, 185, 129, 0.5)' };
      case 'orange':
        return { outer: '#ff6600', inner: '#00f3ff', glow: 'rgba(255, 102, 0, 0.5)' };
      case 'white':
        return { outer: '#ffffff', inner: '#00f3ff', glow: 'rgba(255, 255, 255, 0.5)' };
      case 'cyan':
      default:
        return { outer: '#00f3ff', inner: '#ff6600', glow: 'rgba(0, 243, 255, 0.5)' };
    }
  }

  // --- Target Spawning Logic ---
  function spawnTarget(forcedX, forcedY, radius) {
    const margin = 80;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    let r = radius || (state.mode === 'micro' ? 16 : 28);
    let x, y;

    if (forcedX !== undefined && forcedY !== undefined) {
      x = forcedX;
      y = forcedY;
    } else if (state.mode === 'micro' && state.targets.length > 0) {
      // Micro-adjustments: Spawn close to the previous target location (within 80px to 180px radius)
      const last = state.targets[state.targets.length - 1];
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 120;
      x = last.x + Math.cos(angle) * dist;
      y = last.y + Math.sin(angle) * dist;

      // Clamp within canvas active area
      x = Math.max(margin, Math.min(canvasWidth - margin, x));
      y = Math.max(margin, Math.min(canvasHeight - margin, y));
    } else {
      // Random position inside active area avoiding overlap with existing targets
      let valid = false;
      let attempts = 0;
      while (!valid && attempts < 50) {
        attempts++;
        x = margin + Math.random() * (canvasWidth - margin * 2);
        y = margin + Math.random() * (canvasHeight - margin * 2);

        valid = true;
        for (let t of state.targets) {
          const dx = t.x - x;
          const dy = t.y - y;
          if (Math.hypot(dx, dy) < (t.radius + r + 20)) {
            valid = false;
            break;
          }
        }
      }
    }

    state.targets.push({
      id: Date.now() + Math.random(),
      x,
      y,
      radius: r,
      spawnTime: performance.now()
    });
  }

  function resetTargets() {
    state.targets = [];
    if (state.mode === 'gridshot') {
      // Gridshot mode keeps exactly 3 targets active simultaneously
      for (let i = 0; i < 3; i++) {
        spawnTarget();
      }
    } else if (state.mode === 'micro') {
      // Micro mode spawns 1 target
      spawnTarget();
    }
  }

  // --- Reaction Mode State Machine ---
  function startNextReactionTrial() {
    if (state.reactionTrials.length >= state.maxReactionTrials) {
      finishDrill();
      return;
    }

    state.reactionState = 'WAITING';
    state.targets = [];
    updateHUD();

    showToast(`⚡ Trial ${state.reactionTrials.length + 1} of ${state.maxReactionTrials}: WAIT FOR FLASH...`);

    const randomDelay = 1500 + Math.random() * 2500; // 1.5s to 4.0s
    state.reactionState = 'DELAYING';

    state.reactionTimerTimeout = setTimeout(() => {
      if (!state.isDrillActive || state.mode !== 'reaction') return;
      state.reactionState = 'FLASHING';
      state.reactionFlashStart = performance.now();
      playSound('flash');

      // Spawn bright central target for reaction click
      state.targets = [{
        id: 'reaction_target',
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 65,
        spawnTime: state.reactionFlashStart
      }];
    }, randomDelay);
  }

  // --- Drill Flow Control ---
  function startDrill() {
    initAudio();
    if (state.isCountingDown || state.isDrillActive) return;

    // Reset drill metrics
    state.score = 0;
    state.hits = 0;
    state.misses = 0;
    state.accuracy = 100.0;
    state.avgReactionMs = 0;
    state.reactionTrials = [];
    state.effects = [];
    state.targets = [];

    state.timer = state.mode === 'reaction' ? 0 : 30.0;
    updateHUD();

    // Hide modals
    mainMenuModal.classList.add('hidden');
    resultsModal.classList.add('hidden');

    // Countdown 3, 2, 1, START
    state.isCountingDown = true;
    state.countdownVal = 3;
    countdownOverlay.textContent = '3';
    countdownOverlay.classList.remove('hidden');
    playSound('tick');

    const countdownInterval = setInterval(() => {
      state.countdownVal--;
      if (state.countdownVal > 0) {
        countdownOverlay.textContent = state.countdownVal;
        playSound('tick');
      } else if (state.countdownVal === 0) {
        countdownOverlay.textContent = 'GO!';
        playSound('flash');
      } else {
        clearInterval(countdownInterval);
        countdownOverlay.classList.add('hidden');
        state.isCountingDown = false;
        launchDrillActive();
      }
    }, 800);
  }

  function launchDrillActive() {
    state.isDrillActive = true;
    state.drillStartTime = performance.now();

    if (state.pointerLockEnabled) {
      requestPointerLock();
    }

    if (state.mode === 'reaction') {
      startNextReactionTrial();
    } else {
      resetTargets();
      // Start 30s countdown timer tick
      if (state.timerInterval) clearInterval(state.timerInterval);
      state.timerInterval = setInterval(() => {
        state.timer -= 0.1;
        if (state.timer <= 0) {
          state.timer = 0;
          clearInterval(state.timerInterval);
          finishDrill();
        }
        updateHUD();
      }, 100);
    }
  }

  function finishDrill() {
    state.isDrillActive = false;
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (state.reactionTimerTimeout) clearTimeout(state.reactionTimerTimeout);

    playSound('complete');
    if (document.exitPointerLock) document.exitPointerLock();

    // Calculate final metrics and record high scores
    state.accuracy = calculateAccuracy(state.hits, state.hits + state.misses);

    if (state.mode === 'reaction' && state.reactionTrials.length > 0) {
      const sum = state.reactionTrials.reduce((a, b) => a + b, 0);
      state.avgReactionMs = Math.round(sum / state.reactionTrials.length);

      const minMs = Math.min(...state.reactionTrials);
      if (!state.records.reaction.bestMs || minMs < state.records.reaction.bestMs) {
        state.records.reaction.bestMs = minMs;
      }
      if (!state.records.reaction.avgMs || state.avgReactionMs < state.records.reaction.avgMs) {
        state.records.reaction.avgMs = state.avgReactionMs;
      }
    } else if (state.mode === 'gridshot') {
      if (state.score > state.records.gridshot.score) {
        state.records.gridshot.score = state.score;
      }
      if (state.accuracy > state.records.gridshot.acc) {
        state.records.gridshot.acc = state.accuracy;
      }
    } else if (state.mode === 'micro') {
      if (state.score > state.records.micro.score) {
        state.records.micro.score = state.score;
      }
      if (state.accuracy > state.records.micro.acc) {
        state.records.micro.acc = state.accuracy;
      }
    }

    saveRecords();
    showResultsModal();
  }

  function resetDrill() {
    state.isDrillActive = false;
    state.isCountingDown = false;
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (state.reactionTimerTimeout) clearTimeout(state.reactionTimerTimeout);

    countdownOverlay.classList.add('hidden');
    state.score = 0;
    state.hits = 0;
    state.misses = 0;
    state.accuracy = 100.0;
    state.timer = state.mode === 'reaction' ? 0 : 30.0;
    state.targets = [];
    state.effects = [];
    state.reactionTrials = [];
    state.reactionState = 'IDLE';

    updateHUD();
    showToast('🔄 Drill reset. Press START to launch.');
  }

  // --- Telemetry Calculations & Helpers ---
  function calculateAccuracy(hits, totalClicks) {
    if (totalClicks <= 0) return 100.0;
    return Math.round((hits / totalClicks) * 1000) / 10;
  }

  function updateHUD() {
    hudTimerEl.textContent = state.mode === 'reaction'
      ? `Trial ${Math.min(state.maxReactionTrials, state.reactionTrials.length + 1)}/${state.maxReactionTrials}`
      : `${Math.max(0, state.timer).toFixed(1)}s`;

    hudScoreEl.textContent = state.score.toLocaleString();
    hudHitsEl.textContent = state.hits;
    hudMissesEl.textContent = state.misses;

    const totalClicks = state.hits + state.misses;
    state.accuracy = calculateAccuracy(state.hits, totalClicks);
    hudAccuracyEl.textContent = `${state.accuracy.toFixed(1)}%`;

    hudReactionEl.textContent = state.avgReactionMs > 0 ? `${state.avgReactionMs} ms` : '-- ms';
  }

  // --- Results Modal Handling ---
  function showResultsModal() {
    resultsModal.classList.remove('hidden');

    let titleText = 'DRILL COMPLETE';
    let rankText = '🏆 RADIANT PERFORMANCE';

    if (state.mode === 'gridshot') {
      titleText = '🎯 GRIDSHOT COMPLETE';
      if (state.score >= 2000) rankText = '🏆 RADIANT FLICKER';
      else if (state.score >= 1200) rankText = '⚡ ELITE AIMER';
      else if (state.score >= 600) rankText = '🎯 SHARPSHOOTER';
      else rankText = '🎖️ RECRUIT';
    } else if (state.mode === 'micro') {
      titleText = '🔍 MICRO-ADJUSTMENTS COMPLETE';
      if (state.score >= 1800) rankText = '🏆 PRECISION GOD';
      else if (state.score >= 1000) rankText = '⚡ MICRO MASTER';
      else rankText = '🎯 RECRUIT';
    } else if (state.mode === 'reaction') {
      titleText = '⚡ REACTION TIME COMPLETE';
      if (state.avgReactionMs > 0 && state.avgReactionMs <= 190) rankText = '⚡ HUMAN REFLEX GOD (<190ms)';
      else if (state.avgReactionMs <= 230) rankText = '🏆 PRO CS2 REFLEXES (<230ms)';
      else if (state.avgReactionMs <= 280) rankText = '🎯 AVERAGE REFLEXES';
      else rankText = '🐢 SLOW RESPONSE';
    }

    resultsTitle.textContent = titleText;
    resultsRankBadge.textContent = rankText;
    resultsScore.textContent = state.score.toLocaleString();
    resultsAccuracy.textContent = `${state.accuracy.toFixed(1)}%`;
    resultsHitsMisses.textContent = `${state.hits} / ${state.misses}`;
    resultsReaction.textContent = state.avgReactionMs > 0 ? `${state.avgReactionMs} ms` : '-- ms';

    // Show trial breakdown table for Reaction Time Mode
    if (state.mode === 'reaction' && state.reactionTrials.length > 0) {
      reactionTrialsContainer.classList.remove('hidden');
      trialsList.innerHTML = '';
      state.reactionTrials.forEach((ms, idx) => {
        const chip = document.createElement('div');
        chip.className = 'trial-chip';
        chip.innerHTML = `T${idx + 1}: <strong class="tactical-orange">${ms}ms</strong>`;
        trialsList.appendChild(chip);
      });
    } else {
      reactionTrialsContainer.classList.add('hidden');
    }
  }

  // --- Input Handling: Clicking & Pointer Lock ---
  function requestPointerLock() {
    if (canvas && canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
  }

  function handleCanvasClick(clickX, clickY) {
    if (!state.isDrillActive) return;

    // Handle Reaction Time Mode Clicks
    if (state.mode === 'reaction') {
      if (state.reactionState === 'WAITING' || state.reactionState === 'DELAYING') {
        // Clicked too early before flash!
        if (state.reactionTimerTimeout) clearTimeout(state.reactionTimerTimeout);
        playSound('miss');
        state.misses++;
        updateHUD();
        showToast('❌ TOO EARLY! Reaction Trial Reset.');
        setTimeout(startNextReactionTrial, 1000);
        return;
      }

      if (state.reactionState === 'FLASHING') {
        const deltaMs = Math.round(performance.now() - state.reactionFlashStart);
        playSound('hit');
        state.hits++;
        state.reactionTrials.push(deltaMs);

        // Score based on reaction speed (e.g., 500ms -> 500 pts, 180ms -> 1000 pts)
        const pts = Math.max(100, Math.round(1000 - deltaMs * 1.5));
        state.score += pts;

        state.avgReactionMs = Math.round(state.reactionTrials.reduce((a, b) => a + b, 0) / state.reactionTrials.length);

        spawnEffect(clickX, clickY, `${deltaMs} ms`, '#00f3ff');
        updateHUD();

        state.targets = [];
        state.reactionState = 'RESULT';
        setTimeout(startNextReactionTrial, 800);
        return;
      }
      return;
    }

    // Gridshot & Micro Modes: Check collision with active targets
    let hitIndex = -1;
    for (let i = state.targets.length - 1; i >= 0; i--) {
      const t = state.targets[i];
      const dist = Math.hypot(clickX - t.x, clickY - t.y);
      if (dist <= t.radius) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex !== -1) {
      // Target Hit!
      const hitTarget = state.targets[hitIndex];
      playSound('hit');
      state.hits++;

      // Speed bonus points
      const elapsedSec = (performance.now() - hitTarget.spawnTime) / 1000;
      const basePts = state.mode === 'micro' ? 150 : 100;
      const bonusPts = Math.max(0, Math.round(100 * (1 - elapsedSec)));
      const totalPts = basePts + bonusPts;

      state.score += totalPts;
      spawnEffect(hitTarget.x, hitTarget.y, `+${totalPts}`, getThemeColors().outer);

      // Remove hit target and spawn new one
      state.targets.splice(hitIndex, 1);
      spawnTarget();
    } else {
      // Missed Click!
      playSound('miss');
      state.misses++;
      state.score = Math.max(0, state.score - 20);
      spawnEffect(clickX, clickY, '-20', '#ef4444');
    }

    updateHUD();
  }

  function spawnEffect(x, y, text, color) {
    state.effects.push({
      x,
      y,
      radius: 5,
      maxRadius: 35,
      alpha: 1.0,
      color: color || '#00f3ff',
      text: text || ''
    });
  }

  // --- Canvas Rendering Loop ---
  function render() {
    requestAnimationFrame(render);

    // Ensure canvas internal resolution matches display size
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Clear Canvas with Dark Tactical Background
    if (state.reactionState === 'FLASHING') {
      // Bright Neon Flash during Reaction Time trigger
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // Render subtle background grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Render Reaction Mode Waiting Text
    if (state.mode === 'reaction' && (state.reactionState === 'WAITING' || state.reactionState === 'DELAYING')) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 32px system-ui, sans-serif';
      ctx.fillStyle = '#ff6600';
      ctx.shadowColor = 'rgba(255, 102, 0, 0.8)';
      ctx.shadowBlur = 15;
      ctx.fillText('WAIT FOR FLASH...', width / 2, height / 2);
      ctx.restore();
    } else if (state.mode === 'reaction' && state.reactionState === 'FLASHING') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 48px system-ui, sans-serif';
      ctx.fillStyle = '#020617';
      ctx.fillText('CLICK NOW!', width / 2, height / 2);
      ctx.restore();
    }

    // Render Active Targets
    const colors = getThemeColors();
    state.targets.forEach(t => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);

      // Outer target fill & glow
      ctx.fillStyle = colors.outer;
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 15;
      ctx.fill();

      // Outer border ring
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Inner bullseye circle
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = colors.inner;
      ctx.shadowBlur = 0;
      ctx.fill();

      // Bullseye center white dot
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    });

    // Render Particle Effects & Floating Score Numbers
    for (let i = state.effects.length - 1; i >= 0; i--) {
      const eff = state.effects[i];
      eff.radius += 1.5;
      eff.alpha -= 0.03;

      if (eff.alpha <= 0) {
        state.effects.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, eff.alpha);

      // Expanding ripple ring
      ctx.beginPath();
      ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
      ctx.strokeStyle = eff.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Floating text
      if (eff.text) {
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.fillStyle = eff.color;
        ctx.textAlign = 'center';
        ctx.fillText(eff.text, eff.x, eff.y - eff.radius - 5);
      }

      ctx.restore();
    }

    // Render Custom Crosshair in Pointer Lock Mode
    if (state.pointerLockEnabled && document.pointerLockElement === canvas) {
      renderCrosshair(state.crosshair.x, state.crosshair.y);
    }
  }

  function renderCrosshair(cx, cy) {
    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.fillStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 243, 255, 0.8)';
    ctx.shadowBlur = 8;

    if (state.crosshairStyle === 'dot') {
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (state.crosshairStyle === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Tactical Cross
      const gap = 4;
      const len = 10;
      ctx.beginPath();
      // Top
      ctx.moveTo(cx, cy - gap);
      ctx.lineTo(cx, cy - gap - len);
      // Bottom
      ctx.moveTo(cx, cy + gap);
      ctx.lineTo(cx, cy + gap + len);
      // Left
      ctx.moveTo(cx - gap, cy);
      ctx.lineTo(cx - gap - len, cy);
      // Right
      ctx.moveTo(cx + gap, cy);
      ctx.lineTo(cx + gap + len, cy);
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // --- Toast Notifications ---
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    // Mode Pills & Cards Selection
    function selectMode(m) {
      state.mode = m;
      [pillGridshot, pillMicro, pillReaction].forEach(p => p.classList.remove('active'));
      [cardGridshot, cardMicro, cardReaction].forEach(c => c.classList.remove('selected'));

      if (m === 'gridshot') {
        pillGridshot.classList.add('active');
        cardGridshot.classList.add('selected');
      } else if (m === 'micro') {
        pillMicro.classList.add('active');
        cardMicro.classList.add('selected');
      } else if (m === 'reaction') {
        pillReaction.classList.add('active');
        cardReaction.classList.add('selected');
      }

      resetDrill();
      showToast(`🎯 Routine selected: ${m.toUpperCase()}`);
    }

    pillGridshot.addEventListener('click', () => selectMode('gridshot'));
    pillMicro.addEventListener('click', () => selectMode('micro'));
    pillReaction.addEventListener('click', () => selectMode('reaction'));

    cardGridshot.addEventListener('click', () => selectMode('gridshot'));
    cardMicro.addEventListener('click', () => selectMode('micro'));
    cardReaction.addEventListener('click', () => selectMode('reaction'));

    // Sensitivity Slider
    settingSensInput.addEventListener('input', (e) => {
      state.sensitivity = parseFloat(e.target.value);
      sensValDisplay.textContent = state.sensitivity.toFixed(2);
    });

    // Pointer Lock Toggle
    function togglePointerLock(enabled) {
      state.pointerLockEnabled = enabled;
      pointerLockCheckbox.checked = enabled;
      pointerLockToggleBtn.classList.toggle('active', enabled);
      pointerLockToggleBtn.textContent = `🔒 Pointer Lock: ${enabled ? 'ON' : 'OFF'}`;
      showToast(enabled ? '🔒 Pointer Lock API Enabled' : '🔓 Pointer Lock API Disabled');
    }

    pointerLockCheckbox.addEventListener('change', (e) => togglePointerLock(e.target.checked));
    pointerLockToggleBtn.addEventListener('click', () => togglePointerLock(!state.pointerLockEnabled));

    // Target Color & Crosshair Style Selects
    targetColorSelect.addEventListener('change', (e) => {
      state.targetColorTheme = e.target.value;
    });

    crosshairStyleSelect.addEventListener('change', (e) => {
      state.crosshairStyle = e.target.value;
    });

    // SFX Toggle
    sfxToggleBtn.addEventListener('click', () => {
      state.sfxMuted = !state.sfxMuted;
      sfxToggleBtn.textContent = `🔊 SFX: ${state.sfxMuted ? 'OFF' : 'ON'}`;
    });

    // Main Menu Trigger
    mainMenuTriggerBtn.addEventListener('click', () => {
      mainMenuModal.classList.remove('hidden');
    });

    closeMenuStartBtn.addEventListener('click', () => {
      mainMenuModal.classList.add('hidden');
      startDrill();
    });

    startDrillActionBtn.addEventListener('click', startDrill);
    resetDrillBtn.addEventListener('click', resetDrill);

    retryDrillBtn.addEventListener('click', () => {
      resultsModal.classList.add('hidden');
      startDrill();
    });

    returnMenuBtn.addEventListener('click', () => {
      resultsModal.classList.add('hidden');
      mainMenuModal.classList.remove('hidden');
    });

    // Keyboard Shortcuts (SPACE to start/restart, ESC for menu)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (!mainMenuModal.classList.contains('hidden')) {
          mainMenuModal.classList.add('hidden');
          startDrill();
        } else if (!resultsModal.classList.contains('hidden')) {
          resultsModal.classList.add('hidden');
          startDrill();
        } else if (!state.isDrillActive && !state.isCountingDown) {
          startDrill();
        }
      } else if (e.code === 'Escape') {
        if (!mainMenuModal.classList.contains('hidden')) {
          mainMenuModal.classList.add('hidden');
        } else {
          mainMenuModal.classList.remove('hidden');
        }
      }
    });

    // Canvas Pointer Lock Delta Mouse Movement & Click Events
    document.addEventListener('pointerlockchange', () => {
      const isLocked = (document.pointerLockElement === canvas);
      if (isLocked) {
        state.crosshair.x = canvas.width / 2;
        state.crosshair.y = canvas.height / 2;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (state.pointerLockEnabled && document.pointerLockElement === canvas) {
        const dx = e.movementX * state.sensitivity;
        const dy = e.movementY * state.sensitivity;

        state.crosshair.x = Math.max(0, Math.min(canvas.width, state.crosshair.x + dx));
        state.crosshair.y = Math.max(0, Math.min(canvas.height, state.crosshair.y + dy));
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();

      let clickX, clickY;
      if (state.pointerLockEnabled && document.pointerLockElement === canvas) {
        clickX = state.crosshair.x;
        clickY = state.crosshair.y;
      } else {
        clickX = e.clientX - rect.left;
        clickY = e.clientY - rect.top;
      }

      handleCanvasClick(clickX, clickY);
    });
  }

  // --- Application Initializer ---
  function init() {
    loadRecords();
    setupEventListeners();
    updateHUD();
    render();
    showToast('👋 Welcome! Choose a routine and click START DRILL.');
  }

  init();
})();

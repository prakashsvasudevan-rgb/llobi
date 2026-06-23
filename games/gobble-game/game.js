/**
 * GOBBLE Game Engine
 * Features:
 * - HTML5 Canvas 2D isometric rendering.
 * - Procedural vector drawings for all 3D isometric entities.
 * - Sinking-and-shrinking eating physics using Canvas clipping paths.
 * - Collision mechanics for obstacles larger than the hole.
 * - Web Audio API sound effects synthesizer.
 * - Responsive mouse, touch, and keyboard controls.
 * - 4 interactive levels matching reference parameters.
 * - Persistent local storage leaderboard with automated bot competition.
 */

// Sound FX Synthesizer
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  playEat() {
    this.init();
    if (!this.ctx) return;
    
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playThud() {
    this.init();
    if (!this.ctx) return;
    
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.setValueAtTime(50, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playWin() {
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      let osc = this.ctx.createOscillator();
      let gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  }

  playLose() {
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    let osc = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.4);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.4);
  }

  playLevelUp() {
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    let osc1 = this.ctx.createOscillator();
    let osc2 = this.ctx.createOscillator();
    let gain = this.ctx.createGain();
    
    osc1.type = 'triangle';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    osc2.frequency.setValueAtTime(554.37, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1108.73, now + 0.23);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc1.start();
    osc1.stop(now + 0.3);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.3);
  }
}

// Particle System
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.vz = Math.random() * 5 + 3;
    this.size = Math.random() * 4 + 2;
    this.alpha = 1;
    this.color = color || '#ffc93c';
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
    this.vz -= 0.25; // gravity
    this.alpha -= 0.03;
  }
}

const LEVELS = {
  1: {
    targetScore: 1650,
    duration: 999999, // No timer countdown
    groundColor: '#52b788', // Green forest valley theme
    spawnLimits: { cubes: 40, rocks: 10, trees: 15, logs: 5, people: 15 },
    initialHoleRadius: 24
  },
  2: {
    targetScore: Infinity,
    duration: 999999, // Endless mode
    groundColor: '#2d3748', // Asphalt dark slate grey
    spawnLimits: { taxis: 18, cars: 18, buses: 10, streetlights: 20, houses: 15, skyscrapers: 8, people: 20, trees: 12 },
    initialHoleRadius: 28
  }
};

// Global state variables
let currentLevel = 1;
let score = 0;
let timeRemaining = 30; // seconds
let isPaused = false;
let gameActive = false;
let timerInterval = null;
let isCityArea = false;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');

// Game sound synthesizer
const sfx = new SoundFX();

// Leaderboard state
let leaderboardData = [
  { name: 'Player', score: 0, isPlayer: true },
  { name: 'Gobbler', score: 1850 },
  { name: 'Nom Nom', score: 1420 },
  { name: 'Chomper', score: 980 },
  { name: 'Hungry', score: 650 }
];

// Load leaderboard from storage
function loadLeaderboard() {
  const saved = localStorage.getItem('gobble_leaderboard');
  if (saved) {
    leaderboardData = JSON.parse(saved);
  } else {
    saveLeaderboard();
  }
  updateLeaderboardUI();
}

function saveLeaderboard() {
  localStorage.setItem('gobble_leaderboard', JSON.stringify(leaderboardData));
}

function updateLeaderboardUI() {
  const listElement = document.getElementById('leaderboardList');
  listElement.innerHTML = '';
  
  // Sort scores desc
  leaderboardData.sort((a, b) => b.score - a.score);
  
  leaderboardData.slice(0, 5).forEach((entry, idx) => {
    const li = document.createElement('li');
    if (entry.isPlayer) {
      li.style.backgroundColor = 'rgba(255, 201, 60, 0.15)';
      li.style.color = '#ffc93c';
      li.style.fontWeight = 'bold';
    }
    li.innerHTML = `
      <span class="rank">${idx + 1}.</span>
      <span class="name">${entry.name}</span>
      <span class="score">${entry.score}</span>
    `;
    listElement.appendChild(li);
  });
}

// Isometric Projection Math
// cos(30) ≈ 0.866025, sin(30) = 0.5
const ISO_COS = 0.866025;
const ISO_SIN = 0.5;

function toIso(x, y, z = 0) {
  return {
    x: (x - y) * ISO_COS,
    y: (x + y) * ISO_SIN - z
  };
}

// Reverse Isometric for click-to-world (unused here but good for references)
function toWorld(screenX, screenY) {
  const x = (screenX / ISO_COS + screenY / ISO_SIN) / 2;
  const y = (screenY / ISO_SIN - screenX / ISO_COS) / 2;
  return { x, y };
}

// Input handling
const keys = {};
let mousePos = { x: 0, y: 0 };
let isMouseDown = false;
let touchActive = false;

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  sfx.init(); // Initialize audio context on player input
  
  // Visual keys indicators in side panel
  if (['arrowup', 'w'].includes(e.key.toLowerCase())) document.querySelector('.btn-up')?.classList.add('pressed');
  if (['arrowdown', 's'].includes(e.key.toLowerCase())) document.querySelector('.btn-down')?.classList.add('pressed');
  if (['arrowleft', 'a'].includes(e.key.toLowerCase())) document.querySelector('.btn-left')?.classList.add('pressed');
  if (['arrowright', 'd'].includes(e.key.toLowerCase())) document.querySelector('.btn-right')?.classList.add('pressed');
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
  if (['arrowup', 'w'].includes(e.key.toLowerCase())) document.querySelector('.btn-up')?.classList.remove('pressed');
  if (['arrowdown', 's'].includes(e.key.toLowerCase())) document.querySelector('.btn-down')?.classList.remove('pressed');
  if (['arrowleft', 'a'].includes(e.key.toLowerCase())) document.querySelector('.btn-left')?.classList.remove('pressed');
  if (['arrowright', 'd'].includes(e.key.toLowerCase())) document.querySelector('.btn-right')?.classList.remove('pressed');
});

// Canvas coordinates offset helpers
function getCanvasMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

canvas.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  mousePos = getCanvasMousePos(e);
  sfx.init();
  document.querySelector('.mouse-icon')?.classList.add('pressed');
});

canvas.addEventListener('mousemove', (e) => {
  if (isMouseDown) {
    mousePos = getCanvasMousePos(e);
  }
});

window.addEventListener('mouseup', () => {
  isMouseDown = false;
  document.querySelector('.mouse-icon')?.classList.remove('pressed');
});

canvas.addEventListener('touchstart', (e) => {
  touchActive = true;
  isMouseDown = true;
  if (e.touches.length > 0) {
    mousePos = getCanvasMousePos(e.touches[0]);
  }
  sfx.init();
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    mousePos = getCanvasMousePos(e.touches[0]);
  }
}, { passive: true });

canvas.addEventListener('touchend', () => {
  isMouseDown = false;
  touchActive = false;
});

// Camera object
const camera = {
  x: 0,
  y: 0,
  zoom: 1.0,
  shake: 0,
  update(targetX, targetY) {
    // Smooth follow (lerp)
    this.x += (targetX - this.x) * 0.1;
    this.y += (targetY - this.y) * 0.1;
    
    // Smooth zoom based on hole radius
    const targetZoom = Math.max(currentLevel === 2 ? 0.18 : 0.35, 24 / hole.radius);
    this.zoom += (targetZoom - this.zoom) * 0.05;
    
    // Apply shake decay
    if (this.shake > 0) {
      this.shake *= 0.9;
      if (this.shake < 0.1) this.shake = 0;
    }
  }
};

// Player Hole representation
const hole = {
  x: 0,
  y: 0,
  radius: 24,
  targetRadius: 24,
  speed: 4.5,
  eyeAngle: 0,
  eyeDistance: 6,
  blinkTimer: 0,
  isBlinking: false,
  thudCooldown: 0,

  reset(startRadius) {
    this.x = 0;
    this.y = 0;
    this.radius = startRadius;
    this.targetRadius = startRadius;
    this.eyeAngle = 0;
    this.blinkTimer = 0;
    this.isBlinking = false;
    this.thudCooldown = 0;
  },

  update() {
    // Radius growth smoothing
    this.radius += (this.targetRadius - this.radius) * 0.05;

    // Movement input calculations
    let dx = 0;
    let dy = 0;

    // 1. Keyboard layout mapped to visual screens axes
    if (keys['arrowup'] || keys['w']) {
      dx -= 1;
      dy -= 1;
    }
    if (keys['arrowdown'] || keys['s']) {
      dx += 1;
      dy += 1;
    }
    if (keys['arrowleft'] || keys['a']) {
      dx -= 1;
      dy += 1;
    }
    if (keys['arrowright'] || keys['d']) {
      dx += 1;
      dy -= 1;
    }

    // Normalize keyboard vector
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }
    // 2. Mouse/Touch drag interaction
    if (isMouseDown) {
      // Find the screen projection of the hole center to calculate click direction
      const projectedHole = toIso(this.x - camera.x, this.y - camera.y);
      const holeScreenX = canvas.width / 2 + projectedHole.x * camera.zoom;
      const holeScreenY = canvas.height / 2 + projectedHole.y * camera.zoom;

      const screenDx = mousePos.x - holeScreenX;
      const screenDy = mousePos.y - holeScreenY;
      const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

      if (screenDist > 10) {
        const angle = Math.atan2(screenDy, screenDx);
        
        const moveWorldX = Math.cos(angle) / ISO_COS + Math.sin(angle) / ISO_SIN;
        const moveWorldY = Math.sin(angle) / ISO_SIN - Math.cos(angle) / ISO_COS;
        
        const moveLen = Math.sqrt(moveWorldX * moveWorldX + moveWorldY * moveWorldY);
        dx = moveWorldX / moveLen;
        dy = moveWorldY / moveLen;
        
        // Apply speed limit scaling depending on drag distance
        const speedScale = Math.min((screenDist / camera.zoom) / 120, 1.0);
        dx *= speedScale;
        dy *= speedScale;
      }
    }

    // Apply movement
    this.x += dx * this.speed;
    this.y += dy * this.speed;

    // Boundaries constraints (World boundary is larger for Level 2 City)
    const limit = currentLevel === 2 ? 650 : 400;
    if (this.x < -limit) this.x = -limit;
    if (this.x > limit) this.x = limit;
    if (this.y < -limit) this.y = -limit;
    if (this.y > limit) this.y = limit;

    // Decrease visual timers
    if (this.thudCooldown > 0) this.thudCooldown--;

    // Blinking eye simulation
    this.blinkTimer++;
    if (this.isBlinking) {
      if (this.blinkTimer > 10) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
    } else {
      if (this.blinkTimer > 180 + Math.random() * 120) {
        this.isBlinking = true;
        this.blinkTimer = 0;
      }
    }
  },

  draw(viewportX, viewportY) {
    // The screen coordinates of the hole
    const pos = toIso(this.x - viewportX, this.y - viewportY);
    const sx = canvas.width / 2 + pos.x;
    const sy = canvas.height / 2 + pos.y;
    const rx = this.radius * ISO_COS * 2;
    const ry = this.radius * ISO_SIN * 2;

    // Outer thick dark border of the hole
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1c1a27';
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Red Rim border
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff3355';
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Eyes animation below the hole (matching reference image!)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1c1a27';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'miter';

    const eyeOffset = 9;
    const eyeW = 10;
    const eyeH = this.isBlinking ? 1.5 : 8;
    const eyeY = sy + 13; // Shift down below bottom rim

    // Left Eye
    ctx.save();
    ctx.translate(sx - eyeOffset, eyeY);
    ctx.rotate(-Math.PI / 12); // -15 degrees
    ctx.beginPath();
    ctx.rect(-eyeW / 2, -eyeH / 2, eyeW, eyeH);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Right Eye
    ctx.save();
    ctx.translate(sx + eyeOffset, eyeY);
    ctx.rotate(Math.PI / 12); // 15 degrees
    ctx.beginPath();
    ctx.rect(-eyeW / 2, -eyeH / 2, eyeW, eyeH);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
};

// Isometric entities list
let entities = [];
let particles = [];

// Base Entity Class
class GameEntity {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.type = type;
    this.isEaten = false;
    this.fallProgress = 0;
    
    // Assign sizes, points, colors based on type
    switch (type) {
      case 'cube':
        this.size = 14;
        this.minHoleRadius = 0;
        this.points = 10;
        this.color = '#ffc93c';
        break;
      case 'rock':
        this.size = 26;
        this.minHoleRadius = 38;
        this.points = 50;
        // Random rocks configuration offsets for organic rendering
        this.facets = [];
        const numFacets = Math.floor(Math.random() * 3) + 3;
        for (let i = 0; i < numFacets; i++) {
          this.facets.push({
            rx: (Math.random() - 0.5) * 12,
            ry: (Math.random() - 0.5) * 12,
            rz: Math.random() * 8 + 4,
            size: Math.random() * 6 + 10
          });
        }
        break;
      case 'tree':
        this.size = 38;
        this.minHoleRadius = 40; // Gated: Can eat tree early
        this.points = 100;
        this.heightVal = Math.random() * 10 + 20;
        this.foliageLayers = [
          { r: 24, z: 20 },
          { r: 18, z: 35 },
          { r: 12, z: 48 }
        ];
        break;
      case 'log':
        this.size = 54;
        this.minHoleRadius = 78;
        this.points = 250;
        this.orientation = Math.random() < 0.5 ? 0 : 1;
        this.length = 100;
        this.width = 24;
        this.height = 24;
        break;
      case 'taxi':
        this.size = 22;
        this.minHoleRadius = 48; // Gated: Can eat cars early
        this.points = 60;
        this.color = '#ffeb3b';
        break;
      case 'car':
        this.size = 20;
        this.minHoleRadius = 48; // Gated: Can eat cars early
        this.points = 50;
        const carColors = [
          { left: '#d32f2f', right: '#b71c1c', top: '#ef5350' }, // Red
          { left: '#1976d2', right: '#0d47a1', top: '#42a5f5' }, // Blue
          { left: '#388e3c', right: '#1b5e20', top: '#66bb6a' }  // Green
        ];
        const colSet = carColors[Math.floor(Math.random() * carColors.length)];
        this.colorLeft = colSet.left;
        this.colorRight = colSet.right;
        this.colorTop = colSet.top;
        this.color = colSet.top;
        break;
      case 'bus':
        this.size = 32;
        this.minHoleRadius = 70; // Gated: Eat buses later
        this.points = 120;
        const busColors = [
          { left: '#e53935', right: '#b71c1c', top: '#ef5350' }, // Red
          { left: '#1e88e5', right: '#0d47a1', top: '#42a5f5' }  // Blue
        ];
        const colSetBus = busColors[Math.floor(Math.random() * busColors.length)];
        this.colorLeft = colSetBus.left;
        this.colorRight = colSetBus.right;
        this.colorTop = colSetBus.top;
        this.color = colSetBus.top;
        break;
      case 'people':
        this.size = 8;
        this.minHoleRadius = 10; // Gated: Eat people immediately
        this.points = 20;
        this.color = '#ffcc80';
        break;
      case 'streetlight':
        this.size = 14;
        this.minHoleRadius = 45;
        this.points = 80;
        this.color = '#e0f7fa';
        break;
      case 'house':
        this.size = 38;
        this.minHoleRadius = 90; // Gated: Eat buildings later
        this.points = 180;
        this.color = '#e57373';
        break;
      case 'skyscraper':
        this.size = 56;
        this.minHoleRadius = 120; // Gated: Eat massive skyscrapers last
        this.points = 450;
        this.color = '#90a4ae';
        this.windows = [];
        for (let w = 0; w < 40; w++) {
          this.windows.push(Math.random() < 0.6);
        }
        break;
    }
  }

  update() {
    if (this.isEaten) {
      this.fallProgress += 0.04;
      if (this.fallProgress > 1.0) this.fallProgress = 1.0;

      // Sucking physics: pull center of object to hole center
      this.x += (hole.x - this.x) * 0.15;
      this.y += (hole.y - this.y) * 0.15;
      this.z = -this.fallProgress * 65; // descend below floor level
    } else if (this.type === 'people') {
      // Small random wander walks
      this.x += (Math.random() - 0.5) * 1.5;
      this.y += (Math.random() - 0.5) * 1.5;
      
      // Wander bounds
      const limit = currentLevel === 2 ? 580 : 360;
      if (this.x < -limit) this.x = -limit;
      if (this.x > limit) this.x = limit;
      if (this.y < -limit) this.y = -limit;
      if (this.y > limit) this.y = limit;
    }
  }

  drawShadow(viewportX, viewportY) {
    if (this.isEaten) return; // Sinking objects lose shadows

    const pos = toIso(this.x - viewportX, this.y - viewportY);
    const sx = canvas.width / 2 + pos.x;
    const sy = canvas.height / 2 + pos.y;
    
    // Draw flat ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    
    let radX = this.size * 1.1;
    let orientAngle = 0;
    if (this.type === 'log') {
      radX = this.length / 2;
      orientAngle = this.orientation === 1 ? Math.PI/2 : 0;
    } else if (this.type === 'taxi' || this.type === 'car') {
      radX = this.size * 1.2;
    } else if (this.type === 'bus') {
      radX = this.size * 1.35;
    } else if (this.type === 'skyscraper') {
      radX = this.size * 1.3;
    } else if (this.type === 'house') {
      radX = this.size * 1.25;
    } else if (this.type === 'people') {
      radX = this.size * 1.0;
    }
    
    ctx.ellipse(sx, sy, radX * ISO_COS, radX * ISO_SIN, orientAngle, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(viewportX, viewportY) {
    const scale = this.isEaten ? 1.0 - this.fallProgress : 1.0;
    if (scale <= 0.01) return;

    // Screen base coordinates (fixed Z-index projection to fall DOWNwards)
    const pos = toIso(this.x - viewportX, this.y - viewportY, this.z);
    const sx = canvas.width / 2 + pos.x;
    const sy = canvas.height / 2 + pos.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);

    // Render based on type
    if (this.type === 'cube') {
      this.drawIsometricCube(0, 0, this.size, '#ffc93c', '#e0ab1f', '#ffe066');
    } else if (this.type === 'rock') {
      this.drawIsometricRock();
    } else if (this.type === 'tree') {
      this.drawIsometricTree();
    } else if (this.type === 'log') {
      this.drawIsometricLog();
    } else if (this.type === 'taxi') {
      this.drawIsometricTaxi();
    } else if (this.type === 'car') {
      this.drawIsometricCar();
    } else if (this.type === 'bus') {
      this.drawIsometricBus();
    } else if (this.type === 'people') {
      this.drawIsometricPeople();
    } else if (this.type === 'streetlight') {
      this.drawIsometricStreetlight();
    } else if (this.type === 'house') {
      this.drawIsometricHouse();
    } else if (this.type === 'skyscraper') {
      this.drawIsometricSkyscraper();
    }

    ctx.restore();
  }

  // Draw a perfect 3D Isometric Cube
  drawIsometricCube(cx, cy, size, colLeft, colRight, colTop) {
    const h = size; // height
    const w = size * ISO_COS; // width offset
    const d = size * ISO_SIN; // depth offset

    // Outline setup
    ctx.strokeStyle = '#1c1a27';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    // 1. LEFT FACE
    ctx.fillStyle = colLeft;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - w, cy - d);
    ctx.lineTo(cx - w, cy - d - h);
    ctx.lineTo(cx, cy - h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. RIGHT FACE
    ctx.fillStyle = colRight;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + w, cy - d);
    ctx.lineTo(cx + w, cy - d - h);
    ctx.lineTo(cx, cy - h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. TOP FACE
    ctx.fillStyle = colTop;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx - w, cy - d - h);
    ctx.lineTo(cx, cy - d * 2 - h);
    ctx.lineTo(cx + w, cy - d - h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Draw stacked isometric polyhedra for a rock pile
  drawIsometricRock() {
    this.facets.forEach((stone) => {
      // Translate stone offset
      const pos = toIso(stone.rx, stone.ry, stone.rz);
      this.drawIsometricCube(pos.x, pos.y, stone.size, '#8389a6', '#5b5f7a', '#acb2d1');
    });
  }

  // Draw an isometric tree with trunk and modular foliage
  drawIsometricTree() {
    // 1. Trunk (brown wood cylinder)
    const trunkW = 6;
    const trunkH = this.heightVal;
    
    // Draw Trunk as a small cube
    this.drawIsometricCube(0, 0, trunkW * 1.5, '#795548', '#4e342e', '#8d6e63');
    
    // Draw upper stem cylinders
    ctx.strokeStyle = '#1c1a27';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.ellipse(0, -trunkH * 0.7, trunkW * ISO_COS, trunkW * ISO_SIN, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // 2. Stacked foliage layers
    this.foliageLayers.forEach((layer) => {
      const flyY = -layer.z;
      const size = layer.r;
      // stacked green cubes
      this.drawIsometricCube(0, flyY, size, '#4caf50', '#2e7d32', '#81c784');
    });
  }

  // Draw an elongated red isometric log
  drawIsometricLog() {
    const l = this.length / 2;
    const w = this.width / 2;
    const h = this.height;

    ctx.strokeStyle = '#1c1a27';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';

    // Isometric coordinates vectors
    // If orientation = 0, log is along X-axis
    // If orientation = 1, log is along Y-axis
    const dxX = this.orientation === 0 ? l : w;
    const dxY = this.orientation === 0 ? w : l;

    const pt0 = toIso(-dxX, -dxY, 0);
    const pt1 = toIso(dxX, -dxY, 0);
    const pt2 = toIso(dxX, dxY, 0);
    const pt3 = toIso(-dxX, dxY, 0);

    const pt0H = toIso(-dxX, -dxY, h);
    const pt1H = toIso(dxX, -dxY, h);
    const pt2H = toIso(dxX, dxY, h);
    const pt3H = toIso(-dxX, dxY, h);

    // Color tones (Crimson pinks matching mockup)
    const colTop = '#ff8ca3';
    const colLeft = '#e64a66';
    const colRight = '#c22340';
    const colEnds = '#fce4ec';

    // Drawing paths based on depth orientation to ensure visibility
    if (this.orientation === 0) {
      // 1. End Face Left (pt0 - pt3)
      ctx.fillStyle = colLeft;
      ctx.beginPath();
      ctx.moveTo(pt0.x, pt0.y);
      ctx.lineTo(pt3.x, pt3.y);
      ctx.lineTo(pt3H.x, pt3H.y);
      ctx.lineTo(pt0H.x, pt0H.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Side Face (pt3 - pt2)
      ctx.fillStyle = colRight;
      ctx.beginPath();
      ctx.moveTo(pt3.x, pt3.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.lineTo(pt2H.x, pt2H.y);
      ctx.lineTo(pt3H.x, pt3H.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // 1. Side Face (pt0 - pt3)
      ctx.fillStyle = colLeft;
      ctx.beginPath();
      ctx.moveTo(pt0.x, pt0.y);
      ctx.lineTo(pt3.x, pt3.y);
      ctx.lineTo(pt3H.x, pt3H.y);
      ctx.lineTo(pt0H.x, pt0H.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. End Face Right (pt3 - pt2)
      ctx.fillStyle = colEnds;
      ctx.beginPath();
      ctx.moveTo(pt3.x, pt3.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.lineTo(pt2H.x, pt2H.y);
      ctx.lineTo(pt3H.x, pt3H.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 3. Top Face (H points)
    ctx.fillStyle = colTop;
    ctx.beginPath();
    ctx.moveTo(pt0H.x, pt0H.y);
    ctx.lineTo(pt1H.x, pt1H.y);
    ctx.lineTo(pt2H.x, pt2H.y);
    ctx.lineTo(pt3H.x, pt3H.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wood rings pattern on end caps (silver borders)
    ctx.fillStyle = '#cfd8dc';
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 1.5;
    
    // Draw caps
    const capPos = this.orientation === 0 ? pt2H : pt2H;
    ctx.beginPath();
    ctx.arc(capPos.x - 5, capPos.y + 5, 4, 0, Math.PI*2);
    ctx.stroke();
  }

  // Draw a general rectangular 3D block
  drawIsometricBlock(cx, cy, wl, ww, wh, colLeft, colRight, colTop) {
    const l = wl / 2;
    const w = ww / 2;
    const h = wh;

    ctx.strokeStyle = '#1c1a27';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';

    const pt0 = toIso(-l, -w, 0);
    const pt1 = toIso(l, -w, 0);
    const pt2 = toIso(l, w, 0);
    const pt3 = toIso(-l, w, 0);

    const pt0H = toIso(-l, -w, h);
    const pt1H = toIso(l, -w, h);
    const pt2H = toIso(l, w, h);
    const pt3H = toIso(-l, w, h);

    // 1. LEFT FACE
    ctx.fillStyle = colLeft;
    ctx.beginPath();
    ctx.moveTo(cx + pt0.x, cy + pt0.y);
    ctx.lineTo(cx + pt3.x, cy + pt3.y);
    ctx.lineTo(cx + pt3H.x, cy + pt3H.y);
    ctx.lineTo(cx + pt0H.x, cy + pt0H.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. RIGHT FACE
    ctx.fillStyle = colRight;
    ctx.beginPath();
    ctx.moveTo(cx + pt3.x, cy + pt3.y);
    ctx.lineTo(cx + pt2.x, cy + pt2.y);
    ctx.lineTo(cx + pt2H.x, cy + pt2H.y);
    ctx.lineTo(cx + pt3H.x, cy + pt3H.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. TOP FACE
    ctx.fillStyle = colTop;
    ctx.beginPath();
    ctx.moveTo(cx + pt0H.x, cy + pt0H.y);
    ctx.lineTo(cx + pt1H.x, cy + pt1H.y);
    ctx.lineTo(cx + pt2H.x, cy + pt2H.y);
    ctx.lineTo(cx + pt3H.x, cy + pt3H.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Draw procedural yellow taxi car
  drawIsometricTaxi() {
    // Bottom chassis: yellow block (length 28, width 16, height 8)
    this.drawIsometricBlock(0, 0, 28, 16, 8, '#fbc02d', '#f57f17', '#fdd835');
    
    // Top cabin: black windows block (length 14, width 12, height 7, offset Z by 8)
    const posCabin = toIso(0, 0, 8);
    this.drawIsometricBlock(posCabin.x, posCabin.y, 14, 12, 7, '#37474f', '#212121', '#455a64');
    
    // Taxi sign: tiny orange block on top of cabin (offset Z by 15)
    const posSign = toIso(0, 0, 15);
    this.drawIsometricBlock(posSign.x, posSign.y, 5, 3, 3, '#f57f17', '#e65100', '#ffa726');
    
    // Draw wheels (small black circles/ovals)
    ctx.fillStyle = '#1c1a27';
    const wheelOffsets = [
      {wx: -8, wy: -7}, {wx: 8, wy: -7},
      {wx: -8, wy: 7}, {wx: 8, wy: 7}
    ];
    wheelOffsets.forEach(w => {
      const wPos = toIso(w.wx, w.wy, 0);
      ctx.beginPath();
      ctx.ellipse(wPos.x, wPos.y + 1, 3.5 * ISO_COS, 3.5 * ISO_SIN, 0, 0, Math.PI*2);
      ctx.fill();
    });
  }

  // Draw procedural streetlight
  drawIsometricStreetlight() {
    const poleH = 46;
    const poleW = 2.5;

    // Draw base block
    this.drawIsometricBlock(0, 0, 8, 8, 4, '#546e7a', '#37474f', '#78909c');
    
    // Pole (vertical dark line)
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const topPos = toIso(0, 0, poleH);
    ctx.moveTo(0, 0);
    ctx.lineTo(topPos.x, topPos.y);
    ctx.stroke();
    
    // Light bulb/head: yellow/gold glowing block at the top
    this.drawIsometricBlock(topPos.x - 2, topPos.y - 2, 10, 5, 4, '#78909c', '#455a64', '#ffeb3b');
  }

  // Draw procedural suburban house
  drawIsometricHouse() {
    // Main walls: white plaster block (width 36, depth 32, height 26)
    this.drawIsometricBlock(0, 0, 36, 32, 26, '#f5f5f5', '#e0e0e0', '#ffffff');
    
    // Slanted triangular roof
    const h = 26; // wall height
    const rh = 12; // roof peak height
    const wl = 38 / 2; // roof overhang length
    const ww = 34 / 2; // roof overhang width
    
    const peak0 = toIso(-wl, 0, h + rh);
    const peak1 = toIso(wl, 0, h + rh);
    
    const edge0 = toIso(-wl, -ww, h);
    const edge1 = toIso(wl, -ww, h);
    const edge2 = toIso(wl, ww, h);
    const edge3 = toIso(-wl, ww, h);

    ctx.strokeStyle = '#1c1a27';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';

    // Left Slope (Crimson red)
    ctx.fillStyle = '#ff5e7e';
    ctx.beginPath();
    ctx.moveTo(edge0.x, edge0.y);
    ctx.lineTo(edge1.x, edge1.y);
    ctx.lineTo(peak1.x, peak1.y);
    ctx.lineTo(peak0.x, peak0.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Slope (Darker Crimson)
    ctx.fillStyle = '#d83a56';
    ctx.beginPath();
    ctx.moveTo(edge3.x, edge3.y);
    ctx.lineTo(edge2.x, edge2.y);
    ctx.lineTo(peak1.x, peak1.y);
    ctx.lineTo(peak0.x, peak0.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gables ends (fill grey triangles)
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.moveTo(edge1.x, edge1.y);
    ctx.lineTo(edge2.x, edge2.y);
    ctx.lineTo(peak1.x, peak1.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(edge0.x, edge0.y);
    ctx.lineTo(edge3.x, edge3.y);
    ctx.lineTo(peak0.x, peak0.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front door (dark brown block)
    ctx.fillStyle = '#5d4037';
    const d0 = toIso(8, ww - 1, 0);
    const d1 = toIso(14, ww - 1, 0);
    const d2 = toIso(14, ww - 1, 14);
    const d3 = toIso(8, ww - 1, 14);
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.lineTo(d3.x, d3.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Draw detailed corporate skyscraper building
  drawIsometricSkyscraper() {
    const bodyH = 120;
    const bodyW = 46;
    
    // Tower main body block (deep blue steel colors)
    this.drawIsometricBlock(0, 0, bodyW, bodyW, bodyH, '#37474f', '#263238', '#4f5d75');
    
    // Draw window grids (lit squares)
    const rows = 6;
    const cols = 3;
    
    // Left Face windows (draw along Y lines)
    ctx.fillStyle = '#e0f7fa';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (this.windows && this.windows[idx]) {
          const wy = -bodyW/2 + 6 + c * 13;
          const wz = 18 + r * 15;
          ctx.beginPath();
          const p0 = toIso(-bodyW/2 - 0.5, wy - 3.5, wz - 3.5);
          const p1 = toIso(-bodyW/2 - 0.5, wy + 3.5, wz - 3.5);
          const p2 = toIso(-bodyW/2 - 0.5, wy + 3.5, wz + 3.5);
          const p3 = toIso(-bodyW/2 - 0.5, wy - 3.5, wz + 3.5);
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    
    // Right Face windows (draw along X lines)
    ctx.fillStyle = '#fff59d'; // yellow warm light
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = 18 + r * cols + c;
        if (this.windows && this.windows[idx]) {
          const wx = -bodyW/2 + 6 + c * 13;
          const wz = 18 + r * 15;
          ctx.beginPath();
          const p0 = toIso(wx - 3.5, bodyW/2 + 0.5, wz - 3.5);
          const p1 = toIso(wx + 3.5, bodyW/2 + 0.5, wz - 3.5);
          const p2 = toIso(wx + 3.5, bodyW/2 + 0.5, wz + 3.5);
          const p3 = toIso(wx - 3.5, bodyW/2 + 0.5, wz + 3.5);
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fill();
  }

  // Draw procedural passenger car
  drawIsometricCar() {
    this.drawIsometricBlock(0, 0, 26, 15, 8, this.colorLeft, this.colorRight, this.colorTop);
    
    // cabin
    const posCabin = toIso(0, 0, 8);
    this.drawIsometricBlock(posCabin.x, posCabin.y, 13, 11, 7, '#37474f', '#212121', '#455a64');
    
    // wheels
    ctx.fillStyle = '#1c1a27';
    const wheelOffsets = [
      {wx: -7, wy: -6}, {wx: 7, wy: -6},
      {wx: -7, wy: 6}, {wx: 7, wy: 6}
    ];
    wheelOffsets.forEach(w => {
      const wPos = toIso(w.wx, w.wy, 0);
      ctx.beginPath();
      ctx.ellipse(wPos.x, wPos.y + 1, 3.2 * ISO_COS, 3.2 * ISO_SIN, 0, 0, Math.PI*2);
      ctx.fill();
    });
  }

  // Draw procedural bus
  drawIsometricBus() {
    // Chassis: large block (length 44, width 18, height 18)
    this.drawIsometricBlock(0, 0, 44, 18, 16, this.colorLeft, this.colorRight, this.colorTop);
    
    // Windows along left/right faces
    ctx.fillStyle = '#1c1a27';
    for (let offset = -16; offset <= 16; offset += 10) {
      // Left side window
      ctx.beginPath();
      const p0 = toIso(offset - 4, -9.1, 9);
      const p1 = toIso(offset + 4, -9.1, 9);
      const p2 = toIso(offset + 4, -9.1, 13);
      const p3 = toIso(offset - 4, -9.1, 13);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Wheels
    ctx.fillStyle = '#1c1a27';
    const wheelOffsets = [
      {wx: -14, wy: -8.5}, {wx: 14, wy: -8.5},
      {wx: -14, wy: 8.5}, {wx: 14, wy: 8.5}
    ];
    wheelOffsets.forEach(w => {
      const wPos = toIso(w.wx, w.wy, 0);
      ctx.beginPath();
      ctx.ellipse(wPos.x, wPos.y + 1, 4.2 * ISO_COS, 4.2 * ISO_SIN, 0, 0, Math.PI*2);
      ctx.fill();
    });
  }

  // Draw walking stickman/person
  drawIsometricPeople() {
    const walkCycle = Math.sin(Date.now() * 0.015);
    
    // Torso: blue/red shirt
    this.drawIsometricBlock(0, 0, 4, 4, 8, '#2196f3', '#1976d2', '#64b5f6');
    
    // Head: peach circle
    ctx.fillStyle = '#ffcc80';
    ctx.strokeStyle = '#1c1a27';
    ctx.lineWidth = 1;
    const headPos = toIso(0, 0, 11);
    ctx.beginPath();
    ctx.arc(headPos.x, headPos.y, 2.5, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    
    // Legs
    ctx.strokeStyle = '#1c1a27';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    
    const legLeft = toIso(-1.2, walkCycle * 1.5, 0);
    const legBaseLeft = toIso(-1.2, 0, 2);
    ctx.beginPath();
    ctx.moveTo(legBaseLeft.x, legBaseLeft.y);
    ctx.lineTo(legLeft.x, legLeft.y);
    ctx.stroke();
    
    const legRight = toIso(1.2, -walkCycle * 1.5, 0);
    const legBaseRight = toIso(1.2, 0, 2);
    ctx.beginPath();
    ctx.moveTo(legBaseRight.x, legBaseRight.y);
    ctx.lineTo(legRight.x, legRight.y);
    ctx.stroke();
  }
}

// Generate Game Entities based on level config
function populateWorld(level) {
  entities = [];
  particles = [];
  const cfg = LEVELS[level].spawnLimits;
  
  const mapLim = level === 2 ? 600 : 380;

  // 1. Spawning Cubes
  if (cfg.cubes) {
    for (let i = 0; i < cfg.cubes; i++) {
      const x = (Math.random() - 0.5) * mapLim * 2;
      const y = (Math.random() - 0.5) * mapLim * 2;
      entities.push(new GameEntity(x, y, 'cube'));
    }
  }

  // 2. Spawning Rocks
  if (cfg.rocks) {
    for (let i = 0; i < cfg.rocks; i++) {
      let x, y, tooClose;
      do {
        x = (Math.random() - 0.5) * mapLim * 2;
        y = (Math.random() - 0.5) * mapLim * 2;
        tooClose = Math.sqrt(x*x + y*y) < 80;
      } while (tooClose);
      entities.push(new GameEntity(x, y, 'rock'));
    }
  }

  // 3. Spawning Trees
  if (cfg.trees) {
    for (let i = 0; i < cfg.trees; i++) {
      let x, y, tooClose;
      do {
        x = (Math.random() - 0.5) * mapLim * 2;
        y = (Math.random() - 0.5) * mapLim * 2;
        tooClose = Math.sqrt(x*x + y*y) < 90;
      } while (tooClose);
      entities.push(new GameEntity(x, y, 'tree'));
    }
  }

  // 4. Spawning Logs
  if (cfg.logs) {
    for (let i = 0; i < cfg.logs; i++) {
      let x, y, tooClose;
      do {
        x = (Math.random() - 0.5) * mapLim * 2;
        y = (Math.random() - 0.5) * mapLim * 2;
        tooClose = Math.sqrt(x*x + y*y) < 120;
      } while (tooClose);
      entities.push(new GameEntity(x, y, 'log'));
    }
  }

  // 5. Spawning People
  if (cfg.people) {
    for (let i = 0; i < cfg.people; i++) {
      const x = (Math.random() - 0.5) * mapLim * 2;
      const y = (Math.random() - 0.5) * mapLim * 2;
      entities.push(new GameEntity(x, y, 'people'));
    }
  }

  // 6. Spawning Taxis
  if (cfg.taxis) {
    for (let i = 0; i < cfg.taxis; i++) {
      const x = (Math.random() - 0.5) * mapLim * 2;
      const y = (Math.random() - 0.5) * mapLim * 2;
      entities.push(new GameEntity(x, y, 'taxi'));
    }
  }

  // 7. Spawning Cars
  if (cfg.cars) {
    for (let i = 0; i < cfg.cars; i++) {
      const x = (Math.random() - 0.5) * mapLim * 2;
      const y = (Math.random() - 0.5) * mapLim * 2;
      entities.push(new GameEntity(x, y, 'car'));
    }
  }

  // 8. Spawning Buses
  if (cfg.buses) {
    for (let i = 0; i < cfg.buses; i++) {
      let x, y, tooClose;
      do {
        x = (Math.random() - 0.5) * mapLim * 2;
        y = (Math.random() - 0.5) * mapLim * 2;
        tooClose = Math.sqrt(x*x + y*y) < 100;
      } while (tooClose);
      entities.push(new GameEntity(x, y, 'bus'));
    }
  }

  // 9. Spawning Houses
  if (cfg.houses) {
    for (let i = 0; i < cfg.houses; i++) {
      let x, y, tooClose;
      do {
        x = (Math.random() - 0.5) * mapLim * 2;
        y = (Math.random() - 0.5) * mapLim * 2;
        tooClose = Math.sqrt(x*x + y*y) < 120;
      } while (tooClose);
      entities.push(new GameEntity(x, y, 'house'));
    }
  }

  // 10. Spawning Skyscrapers
  if (cfg.skyscrapers) {
    for (let i = 0; i < cfg.skyscrapers; i++) {
      let x, y, tooClose;
      do {
        x = (Math.random() - 0.5) * mapLim * 2;
        y = (Math.random() - 0.5) * mapLim * 2;
        tooClose = Math.sqrt(x*x + y*y) < 150;
      } while (tooClose);
      entities.push(new GameEntity(x, y, 'skyscraper'));
    }
  }
}

// Adjust canvas display properties for high DPI screens
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);

// Main Game Loop Update Logic
function update(dt) {
  if (!gameActive || isPaused) return;

  // Update Player Hole
  hole.update();

  // Camera smoothly tracks player coordinates
  camera.update(hole.x, hole.y);

  // Pupil angle calculation (Track closest active food cube)
  let closestCube = null;
  let minDist = Infinity;
  
  entities.forEach((ent) => {
    if (ent.type === 'cube' && !ent.isEaten) {
      const d = Math.sqrt((ent.x - hole.x)**2 + (ent.y - hole.y)**2);
      if (d < minDist) {
        minDist = d;
        closestCube = ent;
      }
    }
  });

  if (closestCube) {
    // Look at closest food
    const screenHole = toIso(hole.x, hole.y);
    const screenCube = toIso(closestCube.x, closestCube.y);
    hole.eyeAngle = Math.atan2(screenCube.y - screenHole.y, screenCube.x - screenHole.x);
  } else {
    // Idle eye tracking
    hole.eyeAngle = Math.sin(Date.now() * 0.003) * 0.5;
  }

  // Update Entities & Process Collisions
  entities.forEach((ent) => {
    ent.update();
    if (ent.isEaten) return;

    // Check distance in 2D World Space
    const dist = Math.sqrt((ent.x - hole.x)**2 + (ent.y - hole.y)**2);
    
    // Eating threshold logic
    // The center must enter the hole. Scale determines ease.
    const eatThreshold = hole.radius - ent.size * 0.1;
    
    // Gating check (rocks require score >= 280, others require hole radius)
    const canEat = (ent.type === 'rock') ? (score >= 280) : (hole.radius >= ent.minHoleRadius);

    if (dist < eatThreshold) {
      if (canEat) {
        // Yum! Sucked in!
        ent.isEaten = true;
        sfx.playEat();
        
        // Spawn yellow explosion particles
        for (let i = 0; i < 6; i++) {
          particles.push(new Particle(ent.x, ent.y, ent.color));
        }

        // Score calculations
        score += ent.points;
        document.getElementById('currentScore').innerText = score;

        // Check if we reach the city score threshold!
        if (!isCityArea && score >= 1650) {
          triggerCityUnlocked();
          return;
        }

        // Increase hole target capacity
        const maxRad = (currentLevel === 2) ? 250 : 100;
        hole.targetRadius = Math.min(maxRad, hole.targetRadius + ent.points * 0.055);

        // Leaderboard dynamic tracking (real-time feedback)
        const playerEntry = leaderboardData.find(e => e.isPlayer);
        if (playerEntry) {
          playerEntry.score = score;
          updateLeaderboardUI();
        }

        // Time bonus reward
        timeRemaining = Math.min(LEVELS[currentLevel].duration, timeRemaining + 1);
        updateTimerDisplay();

        // Level victory check
        if (score >= LEVELS[currentLevel].targetScore) {
          triggerLevelWin();
        }
      }
    }

    // Solid obstacle collisions (if too small for hole)
    if (!ent.isEaten && !canEat) {
      // Determine barrier diameter threshold
      let thresholdRadius = hole.radius + ent.size * 0.45;
      
      if (dist < thresholdRadius) {
        // Stop movement (push hole back)
        const overlap = thresholdRadius - dist;
        const pushX = ((hole.x - ent.x) / dist) * overlap;
        const pushY = ((hole.y - ent.y) / dist) * overlap;

        hole.x += pushX;
        hole.y += pushY;

        // Collision effects (Thud sound and screen shake)
        if (hole.thudCooldown === 0) {
          sfx.playThud();
          camera.shake = 5;
          hole.thudCooldown = 25; // wait before another bump sound
        }
      }
    }
  });

  // Update particles
  particles.forEach((p, idx) => {
    p.update();
    if (p.alpha <= 0.05) {
      particles.splice(idx, 1);
    }
  });
}

// Isometric Projection Renderer
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background ground color unscaled first
  ctx.fillStyle = LEVELS[currentLevel].groundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Apply camera zoom centered on screen
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  // Apply screen shake
  if (camera.shake > 0) {
    const dx = (Math.random() - 0.5) * camera.shake;
    const dy = (Math.random() - 0.5) * camera.shake;
    ctx.translate(dx, dy);
  }

  // 1. Draw Flat Background Floor Grid (using Camera viewport offset)
  drawGroundFloor(camera.x, camera.y);

  // 2. Draw active shadows (below all solid entities)
  entities.forEach(ent => ent.drawShadow(camera.x, camera.y));

  // 3. Draw The Hole Void/Lip (Under eaten items rendering)
  drawHoleVoid(camera.x, camera.y);

  // 4. Render active eaten/falling objects mapped INSIDE the hole
  ctx.save();
  clipHoleVoid(camera.x, camera.y);
  entities.forEach(ent => {
    if (ent.isEaten) ent.draw(camera.x, camera.y);
  });
  ctx.restore();

  // 5. Draw Hole Rim & cute tracking eyes
  hole.draw(camera.x, camera.y);

  // 6. Draw all normal standing solid objects
  // Depth Sorting: back-to-front sorting using isometric grid order (x + y depth index)
  const renderList = [];
  entities.forEach(ent => {
    if (!ent.isEaten) renderList.push(ent);
  });
  
  // Particles depth sorting
  particles.forEach(p => {
    renderList.push({
      x: p.x, y: p.y, z: p.z,
      depth: p.x + p.y,
      draw: (vx, vy) => {
        const pos = toIso(p.x - vx, p.y - vy, p.z);
        const sx = canvas.width / 2 + pos.x;
        const sy = canvas.height / 2 + pos.y;
        ctx.fillStyle = `rgba(255, 201, 60, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI*2);
        ctx.fill();
      }
    });
  });

  // Calculate sorting depth for isometric correctness
  renderList.forEach(item => {
    if (item.depth === undefined) {
      item.depth = item.x + item.y;
    }
  });

  renderList.sort((a, b) => a.depth - b.depth);

  // Draw sorted elements
  renderList.forEach(item => item.draw(camera.x, camera.y));

  ctx.restore();
}

// Helper to draw standard grid floor matching the chosen level theme
function drawGroundFloor(vx, vy) {
  const cfg = LEVELS[currentLevel];
  
  // Draw isometric grid lines for visual depth
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.5;

  const spacing = 40;
  const limit = currentLevel === 2 ? 650 : 400;

  // Vertical grid lines
  for (let gx = -limit; gx <= limit; gx += spacing) {
    ctx.beginPath();
    const p1 = toIso(gx - vx, -limit - vy);
    const p2 = toIso(gx - vx, limit - vy);
    ctx.moveTo(canvas.width / 2 + p1.x, canvas.height / 2 + p1.y);
    ctx.lineTo(canvas.width / 2 + p2.x, canvas.height / 2 + p2.y);
    ctx.stroke();
  }

  // Horizontal grid lines
  for (let gy = -limit; gy <= limit; gy += spacing) {
    ctx.beginPath();
    const p1 = toIso(-limit - vx, gy - vy);
    const p2 = toIso(limit - vx, gy - vy);
    ctx.moveTo(canvas.width / 2 + p1.x, canvas.height / 2 + p1.y);
    ctx.lineTo(canvas.width / 2 + p2.x, canvas.height / 2 + p2.y);
    ctx.stroke();
  }

  // Draw arena outer boundary line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  const c0 = toIso(-limit - vx, -limit - vy);
  const c1 = toIso(limit - vx, -limit - vy);
  const c2 = toIso(limit - vx, limit - vy);
  const c3 = toIso(-limit - vx, limit - vy);
  
  ctx.moveTo(canvas.width/2 + c0.x, canvas.height/2 + c0.y);
  ctx.lineTo(canvas.width/2 + c1.x, canvas.height/2 + c1.y);
  ctx.lineTo(canvas.width/2 + c2.x, canvas.height/2 + c2.y);
  ctx.lineTo(canvas.width/2 + c3.x, canvas.height/2 + c3.y);
  ctx.closePath();
  ctx.stroke();
}

// Inner dark hole ellipse
function drawHoleVoid(vx, vy) {
  const pos = toIso(hole.x - vx, hole.y - vy);
  const sx = canvas.width / 2 + pos.x;
  const sy = canvas.height / 2 + pos.y;
  const rx = hole.radius * ISO_COS * 2;
  const ry = hole.radius * ISO_SIN * 2;

  // Create inner cavity gradient (simulating depth)
  const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, rx);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(0.7, '#070914');
  grad.addColorStop(1, '#181b30');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Set up Canvas Clipping path based on hole void ellipse
function clipHoleVoid(vx, vy) {
  const pos = toIso(hole.x - vx, hole.y - vy);
  const sx = canvas.width / 2 + pos.x;
  const sy = canvas.height / 2 + pos.y;
  // Make ellipse clipping slightly smaller to prevent drawing overlaps outside borders
  const rx = hole.radius * ISO_COS * 1.95;
  const ry = hole.radius * ISO_SIN * 1.95;

  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
}

// Timer mechanics
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (isPaused || !gameActive) return;
    
    timeRemaining--;
    updateTimerDisplay();

    if (timeRemaining <= 0) {
      triggerGameOver();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerWidget = document.getElementById('timerWidget');
  const timerVal = document.getElementById('gameTimer');
  
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const displayString = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  timerVal.innerText = displayString;

  if (timeRemaining <= 10) {
    timerWidget.classList.add('warning');
  } else {
    timerWidget.classList.remove('warning');
  }
}

// Level switching and loading
function loadLevel(levelNum) {
  currentLevel = levelNum;
  const cfg = LEVELS[currentLevel];
  
  if (levelNum === 2) {
    if (score < 1650) {
      score = 1650;
    }
  } else {
    score = 0;
  }
  
  timeRemaining = cfg.duration;
  
  // Set UI score & timer
  document.getElementById('currentScore').innerText = score.toString();
  updateTimerDisplay();
  
  // Set active levels css state safely (Level 2 is City card, Level 3/4 are locked)
  document.querySelectorAll('.level-card').forEach((card) => {
    card.classList.remove('level-active');
  });
  const cardElement = document.getElementById(`levelCard${levelNum}`);
  if (cardElement) {
    cardElement.classList.add('level-active');
  }
  
  // Restart layout
  hole.reset(cfg.initialHoleRadius);
  camera.x = 0;
  camera.y = 0;
  camera.zoom = 1.0;
  
  if (levelNum === 2) {
    isCityArea = true;
    document.getElementById('timerWidget').style.display = 'none';
    hole.speed = 5.5; // Slightly faster movement in City
  } else {
    isCityArea = false;
    document.getElementById('timerWidget').style.display = 'none'; // Keep hidden for World 1 as well!
    hole.speed = 4.5;
  }
  
  populateWorld(currentLevel);

  // Sync leaderboard player name score
  const player = leaderboardData.find(e => e.isPlayer);
  if (player) player.score = score;
  updateLeaderboardUI();
}

// Level selector clicks
document.querySelectorAll('.level-card').forEach((card) => {
  card.addEventListener('click', () => {
    const lvlAttr = card.getAttribute('data-level');
    if (!lvlAttr) return; // Skip locked cards
    const lvl = parseInt(lvlAttr);
    if (isNaN(lvl)) return;
    
    sfx.init();
    loadLevel(lvl);
    
    // Hide active screens and show play button
    isPaused = false;
    gameActive = false;
    document.getElementById('gameOverOverlay').classList.remove('active');
    document.getElementById('pausedOverlay').classList.remove('active');
    document.getElementById('startOverlay').classList.add('active');
    
    // reset pause btn icon
    document.getElementById('pauseBtn').querySelector('span').innerText = '‖';
  });
});

// UI Buttons Interactions
document.getElementById('startPlayBtn').addEventListener('click', () => {
  sfx.init();
  document.getElementById('startOverlay').classList.remove('active');
  gameActive = true;
  isPaused = false;
  startTimer();
});

document.getElementById('resumePlayBtn').addEventListener('click', () => {
  document.getElementById('pausedOverlay').classList.remove('active');
  isPaused = false;
  gameActive = true;
});

document.getElementById('restartPlayBtn').addEventListener('click', () => {
  document.getElementById('gameOverOverlay').classList.remove('active');
  loadLevel(currentLevel);
  gameActive = true;
  isPaused = false;
  startTimer();
});

document.getElementById('enterCityBtn').addEventListener('click', () => {
  document.getElementById('cityUnlockedOverlay').classList.remove('active');
  loadLevel(5);
  gameActive = true;
  isPaused = false;
});

// Pause/Resume logic
function togglePause() {
  if (!gameActive) return;
  
  isPaused = !isPaused;
  const pauseIcon = document.getElementById('pauseBtn').querySelector('span');
  
  if (isPaused) {
    pauseIcon.innerText = '▶';
    document.getElementById('pausedOverlay').classList.add('active');
  } else {
    pauseIcon.innerText = '‖';
    document.getElementById('pausedOverlay').classList.remove('active');
  }
}
document.getElementById('pauseBtn').addEventListener('click', togglePause);

// End states triggers
function triggerLevelWin() {
  gameActive = false;
  clearInterval(timerInterval);
  sfx.playLevelUp();

  // Animate transition to next level or loop to endless
  setTimeout(() => {
    if (currentLevel < 2) {
      loadLevel(currentLevel + 1);
      document.getElementById('startOverlay').classList.add('active');
    } else {
      // Completed last level!
      triggerGameOver();
    }
  }, 1000);
}

function triggerGameOver() {
  gameActive = false;
  clearInterval(timerInterval);
  sfx.playLose();

  document.getElementById('finalScore').innerText = score;
  
  // Verify high scores list
  const prevHighScore = localStorage.getItem('gobble_high_score') || 0;
  const badge = document.getElementById('newHighScoreBadge');
  
  if (score > prevHighScore) {
    localStorage.setItem('gobble_high_score', score);
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }

  // Update leaderboard with final scores
  const player = leaderboardData.find(e => e.isPlayer);
  if (player) {
    player.score = score;
  }
  
  // Mock bot growth! Give them random boosts to keep competition fresh
  leaderboardData.forEach((bot) => {
    if (!bot.isPlayer) {
      bot.score = Math.round(bot.score + (Math.random() - 0.4) * 150);
    }
  });

  saveLeaderboard();
  updateLeaderboardUI();
  
  document.getElementById('gameOverOverlay').classList.add('active');
}

function triggerCityUnlocked() {
  gameActive = false;
  clearInterval(timerInterval);
  timerInterval = null;
  sfx.playWin();
  document.getElementById('cityUnlockedOverlay').classList.add('active');
}

// RequestAnimationFrame Engine Loop
let lastTime = 0;
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Cap dt to prevent frame lag glitches
  const clampedDt = Math.min(dt, 0.1);

  update(clampedDt);
  render();

  requestAnimationFrame(gameLoop);
}

// Initial setup
window.addEventListener('load', () => {
  setTimeout(() => {
    resizeCanvas();
    loadLeaderboard();
    loadLevel(1);
    requestAnimationFrame(gameLoop);
  }, 100);
});

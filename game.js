// Minimal 2D tank game. WASD/Arrows to move, Space to shoot. R resets.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('game-wrap');
const touchControls = document.getElementById('touch-controls');

const world = {
  width: canvas.width,
  height: canvas.height,
  tile: 40,
};

const state = {
  keys: new Set(),
  bullets: [],
  enemies: [],
  explosions: [],
  score: 0,
  running: false,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createTank(x, y, color) {
  return {
    x,
    y,
    angle: 0,
    vx: 0,
    vy: 0,
    speed: 3,
    size: 28,
    color,
    cooldownMs: 0,
  };
}

const player = createTank(100, 100, '#7ee787');
player.speed = 3.4; // slightly faster player for easier gameplay

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  const padding = 30;
  let x = 0, y = 0;
  if (edge === 0) { x = padding; y = Math.random() * world.height; }
  if (edge === 1) { x = world.width - padding; y = Math.random() * world.height; }
  if (edge === 2) { x = Math.random() * world.width; y = padding; }
  if (edge === 3) { x = Math.random() * world.width; y = world.height - padding; }
  const enemy = createTank(x, y, '#58a6ff');
  enemy.speed = 1.0; // even slower enemies
  enemy.ai = true;
  state.enemies.push(enemy);
}

for (let i = 0; i < 3; i++) spawnEnemy();

function shoot(from) {
  if (from.cooldownMs > 0) return;
  const speed = from === player ? 8 : 4; // player bullets faster, enemy bullets slower
  const dx = Math.cos(from.angle) * speed;
  const dy = Math.sin(from.angle) * speed;
  state.bullets.push({ x: from.x, y: from.y, dx, dy, ttl: 120, friendly: from === player });
  from.cooldownMs = from === player ? 160 : 360; // player fires faster, enemies less often
}

function update(dtMs) {
  if (!state.running) return;

  // Input
  const up = state.keys.has('w') || state.keys.has('arrowup');
  const down = state.keys.has('s') || state.keys.has('arrowdown');
  const left = state.keys.has('a') || state.keys.has('arrowleft');
  const right = state.keys.has('d') || state.keys.has('arrowright');

  let ax = 0, ay = 0;
  if (left) ax -= 1;
  if (right) ax += 1;
  if (up) ay -= 1;
  if (down) ay += 1;

  const len = Math.hypot(ax, ay) || 1;
  ax /= len; ay /= len;

  player.vx = ax * player.speed;
  player.vy = ay * player.speed;
  if (ax !== 0 || ay !== 0) player.angle = Math.atan2(player.vy, player.vx);

  if (state.keys.has(' ') || state.keys.has('space')) shoot(player);

  // Move player
  player.x = clamp(player.x + player.vx, 16, world.width - 16);
  player.y = clamp(player.y + player.vy, 16, world.height - 16);

  // Cooldowns
  if (player.cooldownMs > 0) player.cooldownMs -= dtMs;

  // Enemies AI
  for (const e of state.enemies) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    e.vx = ux * e.speed;
    e.vy = uy * e.speed;
    e.angle = Math.atan2(uy, ux);
    e.x = clamp(e.x + e.vx, 16, world.width - 16);
    e.y = clamp(e.y + e.vy, 16, world.height - 16);

    if (Math.random() < 0.004) shoot(e); // further reduce enemy fire rate
    if (e.cooldownMs > 0) e.cooldownMs -= dtMs;
  }

  // Bullets
  for (const b of state.bullets) {
    b.x += b.dx;
    b.y += b.dy;
    b.ttl -= 1;
  }
  state.bullets = state.bullets.filter(b => b.ttl > 0 && b.x >= -10 && b.x <= world.width + 10 && b.y >= -10 && b.y <= world.height + 10);

  // Collisions
  const hitRadius = 12; // smaller hitbox for easier dodging
  // Player hit by enemy bullets
  for (const b of state.bullets) {
    if (b.friendly) continue;
    if (Math.hypot(b.x - player.x, b.y - player.y) < hitRadius) {
      state.status = 'Vuruldun! R ile yeniden başla';
      state.running = false;
    }
  }

  // Enemies hit by player bullets
  for (const b of state.bullets) {
    if (!b.friendly) continue;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (Math.hypot(b.x - e.x, b.y - e.y) < hitRadius) {
        state.enemies.splice(i, 1);
        b.ttl = 0;
        state.score += 100;
        // spawn small explosion
        state.explosions.push({ x: e.x, y: e.y, r: 6, ttl: 20 });
      }
    }
  }

  // explosions
  for (const ex of state.explosions) {
    ex.r += 1.8;
    ex.ttl -= 1;
  }
  state.explosions = state.explosions.filter(ex => ex.ttl > 0);

  // respawn enemies
  if (state.enemies.length < 3 && Math.random() < 0.01) spawnEnemy();

  // UI
  document.getElementById('score').textContent = `Skor: ${state.score}`;
  document.getElementById('status').textContent = state.status || '';
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = '#1f2432';
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.width; x += world.tile) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, world.height);
    ctx.stroke();
  }
  for (let y = 0; y <= world.height; y += world.tile) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(world.width, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTank(t) {
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);
  // body
  ctx.fillStyle = t.color;
  ctx.fillRect(-16, -12, 32, 24);
  // turret
  ctx.fillStyle = '#e6e6e6';
  ctx.fillRect(0, -4, 18, 8);
  // hatch
  ctx.beginPath();
  ctx.fillStyle = '#2f3548';
  ctx.arc(-6, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBullets() {
  ctx.save();
  for (const b of state.bullets) {
    ctx.fillStyle = b.friendly ? '#ffd166' : '#ff6b6b';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawExplosions() {
  ctx.save();
  ctx.strokeStyle = '#ffa94d';
  for (const ex of state.explosions) {
    ctx.globalAlpha = Math.max(0, ex.ttl / 20);
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

let lastTs = performance.now();
function frame(now) {
  const dt = now - lastTs; lastTs = now;
  ctx.clearRect(0, 0, world.width, world.height);
  drawGrid();
  drawTank(player);
  for (const e of state.enemies) drawTank(e);
  drawBullets();
  drawExplosions();
  update(dt);
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  state.keys.add(key);
  if (key === 'r') {
    resetGame();
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  state.keys.delete(key);
});

requestAnimationFrame(frame);

// Responsive scaling to fit viewport while keeping aspect ratio
function rescale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = vw / world.width;
  const sy = vh / world.height;
  const controlsRect = (touchControls && getComputedStyle(touchControls).display !== 'none') ? touchControls.getBoundingClientRect() : null;
  const controlsHeight = controlsRect ? Math.ceil(window.innerHeight - controlsRect.top) : 0;
  const isMobileLike = (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) || vw <= 900;
  const syAvailable = Math.max(0.9, (vh - controlsHeight) / world.height);
  // Expand to fill right-side space on mobile by preferring width scale
  const scale = isMobileLike ? Math.min(sx * 1.42, syAvailable) : Math.min(sx, syAvailable);
  wrap.style.transform = `scale(${scale})`;
  // center horizontally & vertically
  const scaledW = world.width * scale;
  const scaledH = world.height * scale;
  const offsetX = isMobileLike ? Math.max(0, vw - scaledW) : Math.max(0, (vw - scaledW) / 2);
  const offsetY = Math.max(0, (vh - controlsHeight - scaledH) / 2);
  wrap.style.position = 'absolute';
  wrap.style.left = `${offsetX}px`;
  wrap.style.top = `${offsetY}px`;
}

window.addEventListener('resize', rescale);
window.addEventListener('orientationchange', rescale);
rescale();

// Recompute scale when controls size/layout changes
if (window.ResizeObserver && touchControls) {
  const ro = new ResizeObserver(() => rescale());
  ro.observe(touchControls);
}

// Start overlay logic
const startOverlay = document.getElementById('start-overlay');
const btnStart = document.getElementById('btn-start');

function startGame() {
  state.running = true;
  if (startOverlay) {
    startOverlay.classList.add('hidden');
    startOverlay.style.display = 'none';
  }
  if (btnStart) btnStart.blur();
}

if (btnStart) {
  btnStart.addEventListener('click', startGame);
  btnStart.addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); }, { passive: false });
}

if (startOverlay) {
  startOverlay.addEventListener('click', () => { if (!state.running) startGame(); });
  startOverlay.addEventListener('touchstart', (e) => { if (!state.running) { e.preventDefault(); startGame(); } }, { passive: false });
}

canvas.addEventListener('touchstart', (e) => { if (!state.running) { e.preventDefault(); startGame(); } }, { passive: false });

window.addEventListener('keydown', (e) => {
  if (!state.running && (e.key === ' ' || e.key === 'Enter' || e.key === 'enter')) {
    e.preventDefault();
    startGame();
  }
});

// Global fallback: any first pointer/click starts the game (for stubborn mobile browsers)
document.addEventListener('pointerdown', () => { if (!state.running) startGame(); }, { once: false });
document.addEventListener('click', () => { if (!state.running) startGame(); }, { once: false });

function resetGame() {
  state.bullets = [];
  state.enemies = [];
  for (let i = 0; i < 5; i++) spawnEnemy();
  player.x = 100; player.y = 100; player.angle = 0; player.cooldownMs = 0;
  state.score = 0;
  state.running = true;
  state.status = '';
}

// Touch controls -> map to key set
function bindTouchButton(el, key) {
  if (!el) return;
  const lower = key.toLowerCase();
  const press = (ev) => {
    ev.preventDefault();
    if (lower === 'r') {
      resetGame();
      return;
    }
    state.keys.add(lower);
  };
  const release = (ev) => {
    ev.preventDefault();
    state.keys.delete(lower);
  };
  // Support touch and mouse (for testing on desktop)
  el.addEventListener('touchstart', press, { passive: false });
  el.addEventListener('touchend', release, { passive: false });
  el.addEventListener('touchcancel', release, { passive: false });
  el.addEventListener('mousedown', press);
  window.addEventListener('mouseup', release);
}

function setupTouchControls() {
  if (!touchControls) return;
  const buttons = touchControls.querySelectorAll('[data-key]');
  buttons.forEach(btn => bindTouchButton(btn, btn.getAttribute('data-key')));
}

// Prevent page scrolling while interacting with game on touch
function preventTouchScroll(el) {
  if (!el) return;
  const handler = (e) => {
    // Allow multi-touch pinch zoom outside canvas
    if (e.touches && e.touches.length > 1) return;
    e.preventDefault();
  };
  el.addEventListener('touchmove', handler, { passive: false });
}

setupTouchControls();
preventTouchScroll(document.body);



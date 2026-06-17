/* ============================================================
   TÉTRISTE — Moteur de jeu
   Tetris complet : SRS + wall kicks, hold, ghost, 7-bag,
   25+ niveaux, scoring, combos, T-spin, responsive desktop/mobile.
   ============================================================ */
(function () {
  'use strict';

  // ---------------- Constantes plateau ----------------
  const COLS = 10, ROWS = 20, HIDDEN = 2; // 2 lignes cachées au-dessus
  const TOTAL_ROWS = ROWS + HIDDEN;
  let CELL = 30; // recalculé selon le canvas

  // ---------------- Tetrominoes ----------------
  // Matrices de rotation (SRS) — chaque pièce a 4 états.
  const SHAPES = {
    I: [
      [[0,1],[1,1],[2,1],[3,1]],
      [[2,0],[2,1],[2,2],[2,3]],
      [[0,2],[1,2],[2,2],[3,2]],
      [[1,0],[1,1],[1,2],[1,3]],
    ],
    J: [
      [[0,0],[0,1],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1],[2,2]],
      [[1,0],[1,1],[0,2],[1,2]],
    ],
    L: [
      [[2,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[1,2],[2,2]],
      [[0,1],[1,1],[2,1],[0,2]],
      [[0,0],[1,0],[1,1],[1,2]],
    ],
    O: [
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
    ],
    S: [
      [[1,0],[2,0],[0,1],[1,1]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[1,1],[2,1],[0,2],[1,2]],
      [[0,0],[0,1],[1,1],[1,2]],
    ],
    T: [
      [[1,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[2,1],[1,2]],
      [[1,0],[0,1],[1,1],[1,2]],
    ],
    Z: [
      [[0,0],[1,0],[1,1],[2,1]],
      [[2,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,2]],
      [[1,0],[0,1],[1,1],[0,2]],
    ],
  };
  const PIECES = ['I','J','L','O','S','T','Z'];

  // Couleurs (gradient haut/bas) par pièce
  const COLORS = {
    I: ['#5ff5ff','#1aa6c4'], J: ['#5a7bff','#2d3bb8'], L: ['#ffac4a','#c46a17'],
    O: ['#ffe14a','#d4a017'], S: ['#5dff8f','#1f9e4d'], T: ['#c46aff','#7b2dc4'],
    Z: ['#ff5a7b','#c41f3b'],
  };

  // Wall kicks SRS (J,L,S,T,Z) et I à part
  const KICKS = {
    '0>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1>0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1>2':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '2>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '3>2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '0>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  };
  const KICKS_I = {
    '0>1':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1>0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1>2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2>1':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2>3':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3>2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0>3':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  };

  // ---------------- Vitesse par niveau (ms / cellule) ----------------
  // Courbe inspirée des guidelines : se durcit fortement après le niveau 20.
  function gravityMs(level) {
    const t = Math.pow(0.8 - ((level - 1) * 0.007), level - 1); // secondes/ligne
    return Math.max(8, t * 1000);
  }
  const LINES_PER_LEVEL = 10;
  const MAX_LEVEL = 25;

  // ---------------- État ----------------
  const State = {
    grid: [], current: null, next: [], hold: null, canHold: true,
    bag: [], score: 0, lines: 0, level: 1, startLevel: 1,
    combo: -1, b2b: false, running: false, paused: false, over: false,
    dropTimer: 0, dropInterval: 1000, lockTimer: 0, lockDelay: 500,
    lockResets: 0, maxLockResets: 15, softDropping: false,
    elapsed: 0, lastTime: 0, marathon: false,
  };

  // ---------------- Paramètres (persistés) ----------------
  const Settings = {
    volMusic: 0.6, volSfx: 0.8, musicOn: true, track: 'korobeiniki',
    theme: 'theme-neon', ghost: true, grid: true, particles: true, shake: true,
    das: 130, arr: 30, swipe: true, vibrate: true,
    touchOn: true, btnSize: 64, btnOpacity: 0.9, btnLayout: null, layoutV: 2,
  };
  const SAVE_KEY = 'tetriste_v1';
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const s = d.settings || {};
        Object.assign(Settings, s);
        // migration : un ancien format de disposition est ignoré au profit du nouveau défaut
        if (s.layoutV !== 2) Settings.btnLayout = null;
        Settings.layoutV = 2;
        best = d.best || { score: 0, level: 1 };
      }
    } catch (e) {}
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ settings: Settings, best })); } catch (e) {}
  }
  let best = { score: 0, level: 1 };

  // ---------------- DOM ----------------
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const app = $('#app');
  const boardCanvas = $('#board-canvas'), bctx = boardCanvas.getContext('2d');
  const fxCanvas = $('#fx-canvas'), fctx = fxCanvas.getContext('2d');
  const nextCanvas = $('#next-canvas'), nctx = nextCanvas.getContext('2d');
  const holdCanvas = $('#hold-canvas'), hctx = holdCanvas.getContext('2d');

  // ---------------- Utilitaires plateau ----------------
  function makeGrid() {
    return Array.from({ length: TOTAL_ROWS }, () => new Array(COLS).fill(null));
  }
  function refillBag() {
    const b = PIECES.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; }
    State.bag.push(...b);
  }
  function nextFromBag() {
    if (State.bag.length === 0) refillBag();
    return State.bag.shift();
  }
  function spawn() {
    while (State.next.length < 5) State.next.push(nextFromBag());
    const type = State.next.shift();
    State.next.push(nextFromBag());
    State.current = { type, rot: 0, x: 3, y: 0 };
    State.canHold = true;
    State.lockTimer = 0; State.lockResets = 0;
    if (collides(State.current)) gameOver();
    drawNext();
  }
  function cells(piece) {
    return SHAPES[piece.type][piece.rot].map(([cx, cy]) => [piece.x + cx, piece.y + cy]);
  }
  function collides(piece) {
    for (const [x, y] of cells(piece)) {
      if (x < 0 || x >= COLS || y >= TOTAL_ROWS) return true;
      if (y >= 0 && State.grid[y][x]) return true;
    }
    return false;
  }

  // ---------------- Mouvements ----------------
  function tryMove(dx, dy) {
    const p = { ...State.current, x: State.current.x + dx, y: State.current.y + dy };
    if (!collides(p)) { State.current = p; if (dy === 0) resetLock(); return true; }
    return false;
  }
  function rotate(dir) {
    const from = State.current.rot;
    const to = (from + dir + 4) % 4;
    if (State.current.type === 'O') { State.current.rot = to; return; }
    const table = State.current.type === 'I' ? KICKS_I : KICKS;
    const key = `${from}>${to}`;
    const kicks = table[key] || [[0, 0]];
    for (const [kx, ky] of kicks) {
      const p = { ...State.current, rot: to, x: State.current.x + kx, y: State.current.y - ky };
      if (!collides(p)) {
        State.current = p; resetLock();
        SFX('rotate'); vibrate(8);
        State.lastWasRotate = true;
        return true;
      }
    }
    SFX('invalid');
    return false;
  }
  function resetLock() {
    if (State.lockResets < State.maxLockResets) { State.lockTimer = 0; State.lockResets++; }
  }
  function ghostY() {
    const g = { ...State.current };
    while (!collides({ ...g, y: g.y + 1 })) g.y++;
    return g.y;
  }
  function hardDrop() {
    let dist = 0;
    while (tryMoveSilent(0, 1)) dist++;
    State.score += dist * 2;
    SFX('harddrop'); vibrate(20);
    shake(Math.min(8, 2 + dist * 0.3));
    lockPiece();
  }
  function tryMoveSilent(dx, dy) {
    const p = { ...State.current, x: State.current.x + dx, y: State.current.y + dy };
    if (!collides(p)) { State.current = p; return true; }
    return false;
  }
  function softDrop() {
    if (tryMoveSilent(0, 1)) { State.score += 1; State.lastWasRotate = false; }
  }
  function holdPiece() {
    if (!State.canHold) { SFX('invalid'); return; }
    SFX('hold'); vibrate(10);
    const cur = State.current.type;
    if (State.hold == null) { State.hold = cur; spawn(); }
    else {
      const h = State.hold; State.hold = cur;
      State.current = { type: h, rot: 0, x: 3, y: 0 };
      State.lockTimer = 0; State.lockResets = 0;
      if (collides(State.current)) gameOver();
    }
    State.canHold = false;
    drawHold();
  }

  // ---------------- Détection T-spin ----------------
  function isTSpin() {
    if (State.current.type !== 'T' || !State.lastWasRotate) return false;
    const { x, y } = State.current;
    const corners = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]];
    let filled = 0;
    for (const [cx, cy] of corners) {
      if (cx < 0 || cx >= COLS || cy >= TOTAL_ROWS || (cy >= 0 && State.grid[cy][cx])) filled++;
    }
    return filled >= 3;
  }

  // ---------------- Verrouillage + lignes ----------------
  function lockPiece() {
    const tspin = isTSpin();
    for (const [x, y] of cells(State.current)) {
      if (y >= 0) State.grid[y][x] = State.current.type;
    }
    SFX('lock');
    const cleared = clearLines();
    score(cleared, tspin);
    if (cleared === 0) {
      State.combo = -1;
      // game over si la pièce verrouille entièrement dans la zone cachée
      if (cells(State.current).every(([, y]) => y < HIDDEN)) { gameOver(); return; }
    }
    State.lastWasRotate = false;
    spawn();
  }

  function clearLines() {
    const full = [];
    for (let y = 0; y < TOTAL_ROWS; y++) {
      if (State.grid[y].every(c => c)) full.push(y);
    }
    if (full.length === 0) return 0;
    // FX
    spawnLineParticles(full);
    for (const y of full) State.grid.splice(y, 1);
    for (let i = 0; i < full.length; i++) State.grid.unshift(new Array(COLS).fill(null));

    if (full.length === 4) { SFX('tetris'); shake(7); }
    else { SFX('line'); shake(2 + full.length); }
    vibrate(30 + full.length * 10);
    return full.length;
  }

  function score(cleared, tspin) {
    if (cleared === 0 && !tspin) return;
    State.combo++;
    let base = 0, label = '';
    if (tspin) {
      base = cleared === 0 ? 400 : cleared === 1 ? 800 : cleared === 2 ? 1200 : 1600;
      label = ['T-SPIN', 'T-SPIN SIMPLE', 'T-SPIN DOUBLE', 'T-SPIN TRIPLE'][cleared];
    } else {
      base = [0, 100, 300, 500, 800][cleared];
      label = ['', '', 'DOUBLE', 'TRIPLE', 'TETRIS'][cleared];
    }
    // Back-to-back (Tetris ou T-spin avec lignes)
    const difficult = cleared === 4 || (tspin && cleared > 0);
    if (difficult && State.b2b) { base = Math.round(base * 1.5); label = 'B2B ' + label; }
    State.b2b = difficult;

    let pts = base * State.level;
    if (State.combo > 0) pts += 50 * State.combo * State.level;
    State.score += pts;
    State.lines += cleared;

    if (label) showCombo(label + (State.combo > 0 ? `  ×${State.combo + 1}` : ''));

    // niveau
    const newLevel = Math.min(MAX_LEVEL + (State.marathon ? 5 : 0),
      State.startLevel + Math.floor(State.lines / LINES_PER_LEVEL));
    if (newLevel > State.level) {
      State.level = newLevel;
      State.dropInterval = gravityMs(State.level);
      SFX('levelup');
      flashLevel(State.level);
    }
    updateHUD();
  }

  function gameOver() {
    State.running = false; State.over = true;
    SFX('gameover');
    if (State.score > best.score) best.score = State.score;
    if (State.level > best.level) best.level = State.level;
    persist();
    $('#go-score').textContent = State.score.toLocaleString('fr-FR');
    $('#go-lines').textContent = State.lines;
    $('#go-level').textContent = State.level;
    $('#go-best').textContent = best.score.toLocaleString('fr-FR');
    setTimeout(() => showOverlay('overlay-gameover'), 600);
    TetAudio.stopMusic();
  }

  // ---------------- Boucle ----------------
  function loop(time) {
    if (!State.running) return;
    const dt = time - (State.lastTime || time);
    State.lastTime = time;
    if (!State.paused && !State.over) {
      State.elapsed += dt;
      const interval = State.softDropping ? Math.min(50, State.dropInterval) : State.dropInterval;
      State.dropTimer += dt;
      if (State.dropTimer >= interval) {
        State.dropTimer = 0;
        if (tryMoveSilent(0, 1)) {
          if (State.softDropping) State.score += 1;
          State.lastWasRotate = false;
        }
      }
      // lock delay : le timer ne s'écoule que lorsque la pièce repose sur la pile
      if (collidesBelow()) {
        State.lockTimer += dt;
        if (State.lockTimer >= State.lockDelay) lockPiece();
      } else {
        State.lockTimer = 0;
      }
      handleDAS(dt);
      updateTime();
    }
    render();
    updateParticles(dt);
    requestAnimationFrame(loop);
  }
  function collidesBelow() {
    return collides({ ...State.current, y: State.current.y + 1 });
  }

  // ---------------- DAS / ARR ----------------
  const input = { left: false, right: false, dasTimer: 0, arrTimer: 0, dir: 0 };
  function handleDAS(dt) {
    if (input.dir === 0) return;
    input.dasTimer += dt;
    if (input.dasTimer >= Settings.das) {
      input.arrTimer += dt;
      const arr = Settings.arr;
      if (arr <= 0) {
        // déplacement instantané jusqu'au mur
        while (tryMoveSilent(input.dir, 0)) {}
        input.arrTimer = 0;
      } else if (input.arrTimer >= arr) {
        input.arrTimer = 0;
        if (tryMoveSilent(input.dir, 0)) { resetLock(); }
      }
    }
  }
  function startMove(dir) {
    input.dir = dir; input.dasTimer = 0; input.arrTimer = 0;
    if (tryMoveSilent(dir, 0)) { SFX('move'); resetLock(); State.lastWasRotate = false; vibrate(5); }
  }
  function stopMove(dir) {
    if (input.dir === dir) input.dir = 0;
  }

  // ============================================================
  //  RENDU
  // ============================================================
  function fitCanvas() {
    const wrap = boardCanvas.parentElement;
    const w = wrap.clientWidth;
    CELL = Math.floor(w / COLS);
    const cw = CELL * COLS, ch = CELL * ROWS;
    for (const c of [boardCanvas, fxCanvas]) {
      c.width = cw; c.height = ch;
      c.style.width = cw + 'px'; c.style.height = ch + 'px';
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCell(ctx, gx, gy, type, alpha = 1, ghost = false) {
    const x = gx * CELL, y = gy * CELL;
    const [c1, c2] = COLORS[type];
    ctx.save();
    ctx.globalAlpha = alpha;
    if (ghost) {
      ctx.strokeStyle = c1; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
      roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 5); ctx.stroke();
      ctx.restore(); return;
    }
    const grad = ctx.createLinearGradient(x, y, x, y + CELL);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    roundRect(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 5); ctx.fill();
    // reflet
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x + 3, y + 3, CELL - 6, (CELL - 6) * 0.4, 4); ctx.fill();
    ctx.restore();
  }

  function render() {
    const W = boardCanvas.width, H = boardCanvas.height;
    bctx.clearRect(0, 0, W, H);
    // fond grille
    if (Settings.grid) {
      bctx.strokeStyle = 'rgba(255,255,255,.05)';
      bctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) { bctx.beginPath(); bctx.moveTo(x * CELL, 0); bctx.lineTo(x * CELL, H); bctx.stroke(); }
      for (let y = 1; y < ROWS; y++) { bctx.beginPath(); bctx.moveTo(0, y * CELL); bctx.lineTo(W, y * CELL); bctx.stroke(); }
    }
    // pile
    for (let y = HIDDEN; y < TOTAL_ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (State.grid[y][x]) drawCell(bctx, x, y - HIDDEN, State.grid[y][x]);
      }
    }
    if (State.current && !State.over) {
      // ghost
      if (Settings.ghost) {
        const gy = ghostY();
        for (const [x, y] of cells({ ...State.current, y: gy })) {
          if (y >= HIDDEN) drawCell(bctx, x, y - HIDDEN, State.current.type, 1, true);
        }
      }
      // pièce active
      for (const [x, y] of cells(State.current)) {
        if (y >= HIDDEN) drawCell(bctx, x, y - HIDDEN, State.current.type);
      }
    }
  }

  function drawMini(ctx, type, ox, oy, scale) {
    const sh = SHAPES[type][0];
    const xs = sh.map(c => c[0]), ys = sh.map(c => c[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs);
    const miny = Math.min(...ys), maxy = Math.max(...ys);
    const w = (maxx - minx + 1), h = (maxy - miny + 1);
    const cell = scale;
    const px = ox - (w * cell) / 2, py = oy - (h * cell) / 2;
    for (const [cx, cy] of sh) {
      const x = px + (cx - minx) * cell, y = py + (cy - miny) * cell;
      const [c1, c2] = COLORS[type];
      const grad = ctx.createLinearGradient(x, y, x, y + cell);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, 4); ctx.fill();
    }
  }
  function drawNext() {
    const isWide = nextCanvas.clientWidth > nextCanvas.clientHeight;
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const n = Math.min(5, State.next.length);
    const scale = 22;
    for (let i = 0; i < n; i++) {
      if (isWide) drawMini(nctx, State.next[i], (i + 0.5) * (nextCanvas.width / n), nextCanvas.height / 2, scale * 0.7);
      else drawMini(nctx, State.next[i], nextCanvas.width / 2, (i + 0.5) * (nextCanvas.height / n), scale);
    }
  }
  function drawHold() {
    hctx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (State.hold) drawMini(hctx, State.hold, holdCanvas.width / 2, holdCanvas.height / 2, 22);
  }

  // ---------------- Particules (FX) ----------------
  let particles = [];
  function spawnLineParticles(rows) {
    if (!Settings.particles) return;
    for (const y of rows) {
      for (let x = 0; x < COLS; x++) {
        const type = State.grid[y][x] || 'I';
        const [c1] = COLORS[type];
        for (let k = 0; k < 3; k++) {
          particles.push({
            x: (x + 0.5) * CELL, y: (y - HIDDEN + 0.5) * CELL,
            vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.8) * 6,
            life: 1, color: c1, size: 3 + Math.random() * 4,
          });
        }
      }
    }
  }
  function updateParticles(dt) {
    fctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    if (particles.length === 0) return;
    const f = dt / 16;
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x += p.vx * f; p.y += p.vy * f; p.vy += 0.35 * f; p.life -= 0.02 * f;
      fctx.globalAlpha = Math.max(0, p.life);
      fctx.fillStyle = p.color;
      fctx.beginPath(); fctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); fctx.fill();
    }
    fctx.globalAlpha = 1;
  }

  // ---------------- HUD ----------------
  function updateHUD() {
    $('#ui-score').textContent = State.score.toLocaleString('fr-FR');
    $('#ui-lines').textContent = State.lines;
    $('#ui-level').textContent = State.level;
    $('#ui-level-2').textContent = State.level;
    const into = State.lines % LINES_PER_LEVEL;
    $('#level-bar-fill').style.width = (into / LINES_PER_LEVEL * 100) + '%';
  }
  function updateTime() {
    const s = Math.floor(State.elapsed / 1000);
    $('#ui-time').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function showCombo(text) {
    const el = $('#combo-popup');
    el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  function flashLevel(lvl) {
    const el = $('#levelup-flash');
    el.querySelector('span').textContent = 'NIVEAU ' + lvl;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  function shake(amount) {
    if (!Settings.shake) return;
    const el = $('.canvas-stack');
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  // ---------------- Audio helpers ----------------
  function SFX(name) { TetAudio.play(name); }
  function vibrate(ms) { if (Settings.vibrate && navigator.vibrate) navigator.vibrate(ms); }

  // ============================================================
  //  CONTRÔLES CLAVIER
  // ============================================================
  const KEYMAP = [
    { keys: ['ArrowLeft'], label: '←', name: 'Gauche', action: () => startMove(-1) },
    { keys: ['ArrowRight'], label: '→', name: 'Droite', action: () => startMove(1) },
  ];
  function onKeyDown(e) {
    if (!State.running) return;
    if (['p', 'Escape'].includes(e.key)) { togglePause(); return; }
    if (State.paused || State.over) return;
    switch (e.key) {
      case 'ArrowLeft': if (!e.repeat) startMove(-1); e.preventDefault(); break;
      case 'ArrowRight': if (!e.repeat) startMove(1); e.preventDefault(); break;
      case 'ArrowDown': State.softDropping = true; e.preventDefault(); break;
      case 'ArrowUp': case 'x': case 'X': if (!e.repeat) rotate(1); e.preventDefault(); break;
      case 'z': case 'Z': case 'Control': if (!e.repeat) rotate(-1); e.preventDefault(); break;
      case ' ': if (!e.repeat) hardDrop(); e.preventDefault(); break;
      case 'c': case 'C': case 'Shift': if (!e.repeat) holdPiece(); e.preventDefault(); break;
    }
  }
  function onKeyUp(e) {
    switch (e.key) {
      case 'ArrowLeft': stopMove(-1); break;
      case 'ArrowRight': stopMove(1); break;
      case 'ArrowDown': State.softDropping = false; break;
    }
  }

  // ============================================================
  //  CONTRÔLES TACTILES
  // ============================================================
  function bindTouchButtons() {
    $$('.tc-btn').forEach(btn => {
      const action = btn.dataset.action;
      let held = null;
      const press = (e) => {
        e.preventDefault();
        if (layoutEditing) return;
        if (!State.running || State.paused) return;
        switch (action) {
          case 'left': startMove(-1); break;
          case 'right': startMove(1); break;
          case 'softdrop': State.softDropping = true; break;
          case 'rotateCW': rotate(1); break;
          case 'rotateCCW': rotate(-1); break;
          case 'harddrop': hardDrop(); break;
          case 'hold': holdPiece(); break;
        }
      };
      const release = (e) => {
        if (action === 'left') stopMove(-1);
        if (action === 'right') stopMove(1);
        if (action === 'softdrop') State.softDropping = false;
      };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release);
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    });
  }

  // gestes (swipe) sur le plateau
  function bindSwipe() {
    const stack = $('.canvas-stack');
    let sx = 0, sy = 0, st = 0, lastX = 0, moved = false, startCol = 0;
    stack.addEventListener('touchstart', (e) => {
      if (!Settings.swipe || !State.running || State.paused) return;
      const t = e.touches[0]; sx = lastX = t.clientX; sy = t.clientY; st = Date.now(); moved = false;
    }, { passive: true });
    stack.addEventListener('touchmove', (e) => {
      if (!Settings.swipe || !State.running || State.paused) return;
      const t = e.touches[0];
      const dx = t.clientX - lastX;
      const threshold = CELL * 0.8;
      if (Math.abs(dx) > threshold) {
        const dir = dx > 0 ? 1 : -1;
        if (tryMoveSilent(dir, 0)) { SFX('move'); resetLock(); vibrate(5); }
        lastX = t.clientX; moved = true;
      }
      const dy = t.clientY - sy;
      if (dy > CELL * 1.2) { State.softDropping = true; }
    }, { passive: true });
    stack.addEventListener('touchend', (e) => {
      State.softDropping = false;
      if (!Settings.swipe || !State.running || State.paused) return;
      const dt = Date.now() - st;
      const t = e.changedTouches[0];
      const dy = t.clientY - sy, dx = t.clientX - sx;
      if (!moved && dt < 250 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        rotate(1); // tap = rotation
      } else if (dy > CELL * 4 && dt < 300 && Math.abs(dx) < CELL * 2) {
        hardDrop(); // swipe rapide vers le bas = hard drop
      }
    }, { passive: true });
  }

  // ---------------- Placement des boutons tactiles ----------------
  // Les positions sont mémorisées par le CENTRE du bouton, en pourcentage
  // de l'écran. Le placement réel est recadré pour que le bouton reste
  // toujours entièrement visible, quelle que soit la taille d'écran.
  let layoutEditing = false;
  let layoutReturnScreen = 'screen-home';

  function safeInset(side) {
    // lit la marge de sécurité (encoches / barre gestuelle) si disponible
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-' + side);
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function placeButtonCenter(btn, cxPct, cyPct) {
    const W = window.innerWidth, H = window.innerHeight;
    const size = Settings.btnSize;
    const m = 10; // marge minimale aux bords
    const sb = safeInset('bottom'), st = safeInset('top');
    let cx = (cxPct / 100) * W;
    let cy = (cyPct / 100) * H;
    cx = Math.max(size / 2 + m, Math.min(W - size / 2 - m, cx));
    cy = Math.max(size / 2 + m + st, Math.min(H - size / 2 - m - sb, cy));
    btn.style.left = (cx - size / 2) + 'px';
    btn.style.top = (cy - size / 2) + 'px';
  }
  function buttonCenterPct(btn) {
    const size = Settings.btnSize;
    const cx = (parseFloat(btn.style.left) || 0) + size / 2;
    const cy = (parseFloat(btn.style.top) || 0) + size / 2;
    return { x: cx / window.innerWidth * 100, y: cy / window.innerHeight * 100 };
  }

  function applyButtonLayout() {
    const tc = $('#touch-controls');
    tc.style.setProperty('--btn-size', Settings.btnSize + 'px');
    tc.style.setProperty('--btn-opacity', Settings.btnOpacity);
    const layout = Settings.btnLayout || defaultLayout();
    $$('.tc-btn').forEach(btn => {
      const pos = layout[btn.dataset.action];
      if (pos) placeButtonCenter(btn, pos.x, pos.y);
    });
  }
  function defaultLayout() {
    // centres en % de l'écran — manettes en bas, façon pouce gauche/droit.
    // DROITE = déplacements (gauche / droite / descente)
    // GAUCHE = rotations + chute instantanée + réserve
    return {
      // --- côté droit : déplacements (croix directionnelle) ---
      left:      { x: 72, y: 80 },
      right:     { x: 90, y: 80 },
      softdrop:  { x: 81, y: 90 },
      // --- côté gauche : rotations, chute, réserve ---
      rotateCCW: { x: 10, y: 80 },
      rotateCW:  { x: 27, y: 80 },
      harddrop:  { x: 18.5, y: 90 },
      hold:      { x: 10, y: 68 },
    };
  }
  function enableLayoutEdit() {
    layoutEditing = true;
    // mémoriser l'écran d'origine pour y revenir ensuite
    const active = document.querySelector('.screen.active');
    layoutReturnScreen = active ? active.id : 'screen-home';
    closeAllOverlays();
    // afficher le plateau comme repère, même si aucune partie n'est en cours
    if (!State.grid || State.grid.length === 0) State.grid = makeGrid();
    showScreen('screen-game');
    fitCanvas(); applyButtonLayout(); render();
    $('#touch-controls').classList.add('visible', 'editing');
    $('#layout-toolbar').classList.add('visible');
    $('#layout-hint').classList.add('visible');
    $$('.tc-btn').forEach(btn => {
      let dragging = false;
      const move = (clientX, clientY) => {
        // le bouton suit le doigt par son centre (pas de saut), avec recadrage
        placeButtonCenter(btn, clientX / window.innerWidth * 100, clientY / window.innerHeight * 100);
      };
      btn._drag = {
        ts: (e) => { dragging = true; vibrate(8); },
        tm: (e) => { if (!dragging) return; const t = e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); },
        te: () => { dragging = false; },
        md: (e) => { dragging = true; e.preventDefault(); },
        mm: (e) => { if (dragging) move(e.clientX, e.clientY); },
        mu: () => { dragging = false; },
      };
      btn.addEventListener('touchstart', btn._drag.ts, { passive: false });
      btn.addEventListener('touchmove', btn._drag.tm, { passive: false });
      btn.addEventListener('touchend', btn._drag.te);
      btn.addEventListener('mousedown', btn._drag.md);
      window.addEventListener('mousemove', btn._drag.mm);
      window.addEventListener('mouseup', btn._drag.mu);
    });
  }
  // Sortie d'édition. save=true : enregistre les positions ; save=false : annule.
  function exitLayoutEdit(save) {
    layoutEditing = false;
    $('#touch-controls').classList.remove('editing');
    $('#layout-toolbar').classList.remove('visible');
    $('#layout-hint').classList.remove('visible');
    const layout = {};
    $$('.tc-btn').forEach(btn => {
      layout[btn.dataset.action] = buttonCenterPct(btn);
      if (btn._drag) {
        btn.removeEventListener('touchstart', btn._drag.ts);
        btn.removeEventListener('touchmove', btn._drag.tm);
        btn.removeEventListener('touchend', btn._drag.te);
        btn.removeEventListener('mousedown', btn._drag.md);
        window.removeEventListener('mousemove', btn._drag.mm);
        window.removeEventListener('mouseup', btn._drag.mu);
        btn._drag = null;
      }
    });
    if (save) { Settings.btnLayout = layout; persist(); }
    // si on annule, applyButtonLayout restaure la disposition précédente (Settings inchangé)
    applyButtonLayout();
    // revenir à l'écran d'origine (accueil ou jeu) puis rouvrir les paramètres
    showScreen(layoutReturnScreen);
    updateTouchVisibility();
    openSettings();
  }
  // Remet la disposition par défaut sans quitter l'édition (annulable ensuite)
  function previewDefaultLayout() {
    const d = defaultLayout();
    $$('.tc-btn').forEach(btn => {
      const p = d[btn.dataset.action];
      if (p) placeButtonCenter(btn, p.x, p.y);
    });
    SFX('click'); vibrate(10);
  }

  function isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }
  function updateTouchVisibility() {
    if (layoutEditing) return; // en édition, les boutons restent visibles
    const show = Settings.touchOn && isTouchDevice() && State.running;
    $('#touch-controls').classList.toggle('visible', show);
  }

  // ============================================================
  //  ÉCRANS / OVERLAYS
  // ============================================================
  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#' + id).classList.add('active');
  }
  function showOverlay(id) { $('#' + id).classList.add('active'); }
  function hideOverlay(id) { $('#' + id).classList.remove('active'); }
  function closeAllOverlays() { $$('.overlay').forEach(o => o.classList.remove('active')); }

  function startGame(marathon = false) {
    TetAudio.unlock();
    State.grid = makeGrid();
    State.bag = []; State.next = []; State.hold = null;
    State.score = 0; State.lines = 0;
    State.startLevel = parseInt($('#start-level').value, 10) || 1;
    State.level = State.startLevel;
    State.combo = -1; State.b2b = false;
    State.dropInterval = gravityMs(State.level);
    State.elapsed = 0; State.lastTime = 0; State.dropTimer = 0; State.lockTimer = 0;
    State.over = false; State.paused = false; State.running = true;
    State.marathon = marathon;
    State.softDropping = false;
    State.lastWasRotate = false;
    particles = [];
    spawn(); drawHold(); updateHUD();
    closeAllOverlays();
    showScreen('screen-game');
    fitCanvas(); drawNext();
    updateTouchVisibility();
    if (Settings.musicOn) TetAudio.startMusic();
    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (!State.running || State.over) return;
    State.paused = !State.paused;
    SFX('pause');
    if (State.paused) { showOverlay('overlay-pause'); TetAudio.pauseAll(); }
    else { hideOverlay('overlay-pause'); TetAudio.resumeAll(); State.lastTime = performance.now(); }
  }
  function quitToHome() {
    State.running = false; State.paused = false;
    TetAudio.stopMusic();
    closeAllOverlays();
    refreshHomeStats();
    showScreen('screen-home');
  }
  function refreshHomeStats() {
    $('#home-best').textContent = best.score.toLocaleString('fr-FR');
    $('#home-best-level').textContent = best.level;
  }

  // ============================================================
  //  PARAMÈTRES — UI
  // ============================================================
  function buildMusicList() {
    const list = $('#music-list'); list.innerHTML = '';
    TetAudio.tracksMeta().forEach(t => {
      const el = document.createElement('div');
      el.className = 'music-item' + (t.id === Settings.track ? ' active' : '');
      el.innerHTML = `<span class="mi-icon">${t.icon}</span><span class="mi-name">${t.name}</span><span class="mi-play">${t.id === Settings.track ? '● en cours' : '▶'}</span>`;
      el.addEventListener('click', () => {
        Settings.track = t.id; TetAudio.setTrack(t.id);
        if (Settings.musicOn && t.id !== 'none') { TetAudio.unlock(); TetAudio.startMusic(); }
        persist(); buildMusicList(); SFX('click');
      });
      list.appendChild(el);
    });
  }
  const THEMES = [
    { id: 'theme-neon', name: 'Néon', c: '#4af0ff' },
    { id: 'theme-sunset', name: 'Coucher de soleil', c: '#ff9e4a' },
    { id: 'theme-forest', name: 'Forêt', c: '#5dffa0' },
    { id: 'theme-candy', name: 'Bonbon', c: '#ff7be0' },
    { id: 'theme-mono', name: 'Monochrome', c: '#e8e8e8' },
  ];
  function buildThemeList() {
    const list = $('#theme-list'); list.innerHTML = '';
    THEMES.forEach(t => {
      const el = document.createElement('div');
      el.className = 'theme-item' + (t.id === Settings.theme ? ' active' : '');
      el.innerHTML = `<span class="theme-swatch" style="background:${t.c}"></span><span class="ti-name">${t.name}</span>`;
      el.addEventListener('click', () => {
        Settings.theme = t.id; applyTheme(); persist(); buildThemeList(); SFX('click');
      });
      list.appendChild(el);
    });
  }
  function applyTheme() {
    app.className = Settings.theme;
  }
  function buildKeymap() {
    const km = $('#keymap');
    const rows = [
      ['← →', 'Déplacer'], ['↓', 'Descente douce'], ['Espace', 'Chute instantanée'],
      ['↑ / X', 'Rotation horaire'], ['Z / Ctrl', 'Rotation anti-horaire'],
      ['C / Maj', 'Réserve'], ['P / Échap', 'Pause'],
    ];
    km.innerHTML = rows.map(([k, d]) => `<div class="km-row"><span>${d}</span><kbd>${k}</kbd></div>`).join('');
  }

  function syncSettingsUI() {
    $('#vol-music').value = Settings.volMusic * 100;
    $('#out-vol-music').textContent = Math.round(Settings.volMusic * 100) + '%';
    $('#vol-sfx').value = Settings.volSfx * 100;
    $('#out-vol-sfx').textContent = Math.round(Settings.volSfx * 100) + '%';
    $('#chk-music-on').checked = Settings.musicOn;
    $('#chk-ghost').checked = Settings.ghost;
    $('#chk-grid').checked = Settings.grid;
    $('#chk-particles').checked = Settings.particles;
    $('#chk-shake').checked = Settings.shake;
    $('#das').value = Settings.das; $('#out-das').textContent = Settings.das + ' ms';
    $('#arr').value = Settings.arr; $('#out-arr').textContent = Settings.arr + ' ms';
    $('#chk-swipe').checked = Settings.swipe;
    $('#chk-vibrate').checked = Settings.vibrate;
    $('#chk-touch-on').checked = Settings.touchOn;
    $('#btn-size').value = Settings.btnSize; $('#out-btn-size').textContent = Settings.btnSize + ' px';
    $('#btn-opacity').value = Settings.btnOpacity * 100; $('#out-btn-opacity').textContent = Math.round(Settings.btnOpacity * 100) + '%';
  }

  function applyAllSettings() {
    TetAudio.setMusicVolume(Settings.volMusic);
    TetAudio.setSfxVolume(Settings.volSfx);
    TetAudio.setMusicEnabled(Settings.musicOn);
    TetAudio.setTrack(Settings.track);
    applyTheme();
    applyButtonLayout();
    updateTouchVisibility();
  }

  // ============================================================
  //  ÉVÉNEMENTS UI
  // ============================================================
  function bindUI() {
    // Accueil
    $('#btn-play').addEventListener('click', () => { SFX('click'); startGame(false); });
    $('#btn-marathon').addEventListener('click', () => { SFX('click'); startGame(true); });
    $('#btn-open-settings').addEventListener('click', () => { TetAudio.unlock(); openSettings(); });
    $('#btn-open-help').addEventListener('click', () => { TetAudio.unlock(); showOverlay('overlay-help'); });
    const sl = $('#start-level');
    sl.addEventListener('input', () => { $('#start-level-out').textContent = sl.value; });

    // En jeu
    $('#btn-pause').addEventListener('click', togglePause);
    $('#btn-mute').addEventListener('click', () => {
      Settings.musicOn = !Settings.musicOn;
      $('#btn-mute').textContent = Settings.musicOn ? '🎵' : '🔇';
      TetAudio.setMusicEnabled(Settings.musicOn);
      if (Settings.musicOn) TetAudio.startMusic();
      persist();
    });

    // Pause overlay
    $('#btn-resume').addEventListener('click', togglePause);
    $('#btn-pause-settings').addEventListener('click', openSettings);
    $('#btn-restart').addEventListener('click', () => { SFX('click'); startGame(State.marathon); });
    $('#btn-quit').addEventListener('click', () => { SFX('click'); quitToHome(); });

    // Game over
    $('#btn-again').addEventListener('click', () => { SFX('click'); startGame(State.marathon); });
    $('#btn-go-home').addEventListener('click', () => { SFX('click'); quitToHome(); });

    // Settings
    $('#btn-close-settings').addEventListener('click', () => { hideOverlay('overlay-settings'); if (State.paused) showOverlay('overlay-pause'); });
    $('#btn-close-help').addEventListener('click', () => hideOverlay('overlay-help'));
    $$('.settings-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.settings-tabs .tab').forEach(t => t.classList.remove('active'));
        $$('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        $(`.tab-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
        SFX('click');
      });
    });

    // sliders & switches
    $('#vol-music').addEventListener('input', e => { Settings.volMusic = e.target.value / 100; $('#out-vol-music').textContent = e.target.value + '%'; TetAudio.setMusicVolume(Settings.volMusic); persist(); });
    $('#vol-sfx').addEventListener('input', e => { Settings.volSfx = e.target.value / 100; $('#out-vol-sfx').textContent = e.target.value + '%'; TetAudio.setSfxVolume(Settings.volSfx); persist(); });
    $('#chk-music-on').addEventListener('change', e => { Settings.musicOn = e.target.checked; TetAudio.setMusicEnabled(Settings.musicOn); if (Settings.musicOn) TetAudio.startMusic(); $('#btn-mute').textContent = Settings.musicOn ? '🎵' : '🔇'; persist(); });
    $('#chk-ghost').addEventListener('change', e => { Settings.ghost = e.target.checked; persist(); });
    $('#chk-grid').addEventListener('change', e => { Settings.grid = e.target.checked; persist(); });
    $('#chk-particles').addEventListener('change', e => { Settings.particles = e.target.checked; persist(); });
    $('#chk-shake').addEventListener('change', e => { Settings.shake = e.target.checked; persist(); });
    $('#das').addEventListener('input', e => { Settings.das = +e.target.value; $('#out-das').textContent = e.target.value + ' ms'; persist(); });
    $('#arr').addEventListener('input', e => { Settings.arr = +e.target.value; $('#out-arr').textContent = e.target.value + ' ms'; persist(); });
    $('#chk-swipe').addEventListener('change', e => { Settings.swipe = e.target.checked; persist(); });
    $('#chk-vibrate').addEventListener('change', e => { Settings.vibrate = e.target.checked; persist(); });
    $('#chk-touch-on').addEventListener('change', e => { Settings.touchOn = e.target.checked; updateTouchVisibility(); persist(); });
    $('#btn-size').addEventListener('input', e => { Settings.btnSize = +e.target.value; $('#out-btn-size').textContent = e.target.value + ' px'; applyButtonLayout(); persist(); });
    $('#btn-opacity').addEventListener('input', e => { Settings.btnOpacity = e.target.value / 100; $('#out-btn-opacity').textContent = e.target.value + '%'; applyButtonLayout(); persist(); });
    $('#btn-edit-layout').addEventListener('click', () => { hideOverlay('overlay-settings'); enableLayoutEdit(); });
    $('#btn-reset-layout').addEventListener('click', () => { Settings.btnLayout = defaultLayout(); applyButtonLayout(); persist(); SFX('click'); });
    $('#btn-done-layout').addEventListener('click', () => { SFX('click'); exitLayoutEdit(true); });
    $('#btn-cancel-layout').addEventListener('click', () => { SFX('click'); exitLayoutEdit(false); });
    $('#btn-default-layout').addEventListener('click', previewDefaultLayout);

    // Clavier
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Resize
    window.addEventListener('resize', () => { applyButtonLayout(); if ($('#screen-game').classList.contains('active')) { fitCanvas(); render(); } });
    window.addEventListener('orientationchange', () => setTimeout(() => { applyButtonLayout(); fitCanvas(); render(); }, 200));

    // pause si l'onglet perd le focus
    document.addEventListener('visibilitychange', () => { if (document.hidden && State.running && !State.paused && !State.over) togglePause(); });
  }

  function openSettings() {
    if (State.paused) hideOverlay('overlay-pause');
    syncSettingsUI(); buildMusicList(); buildThemeList(); buildKeymap();
    showOverlay('overlay-settings'); SFX('click');
  }

  // ============================================================
  //  INIT
  // ============================================================
  function init() {
    loadSave();
    applyTheme();
    syncSettingsUI();
    applyAllSettings();
    refreshHomeStats();
    $('#start-level').value = best.level > 1 ? Math.min(best.level, 25) : 1;
    $('#start-level-out').textContent = $('#start-level').value;
    $('#btn-mute').textContent = Settings.musicOn ? '🎵' : '🔇';
    bindUI();
    bindTouchButtons();
    bindSwipe();
    applyButtonLayout();
    // déverrouiller l'audio à la première interaction
    const unlockOnce = () => { TetAudio.unlock(); window.removeEventListener('pointerdown', unlockOnce); };
    window.addEventListener('pointerdown', unlockOnce);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

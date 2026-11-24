// Volt Dash entry: game state machine, player physics, collisions and the frame loop.
import { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import * as T from './track.js';
import { createAudio } from './audio.js';
import { createEntities } from './entities.js';
import { createHero } from './hero.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { FOG_COLOR, createWorld } from './world.js';

const MAX_DT = 1 / 30; // a long frame never advances the sim more than this
const SUBSTEP = 1 / 120; // physics step, keeps per-step travel < 0.3 units at top speed
const GRAVITY = 48;
const JUMP_V = Math.sqrt(2 * GRAVITY * 1.55);
const SPRING_V = Math.sqrt(2 * GRAVITY * 3.4); // high enough to land on a pod top
const ROLL_TIME = 0.6;
const FAST_FALL_V = -30;
const JUMP_BUFFER = 0.15;
const STEP = 0.4; // how far below a surface the hero may be and still step onto it
const HALF_D = 0.35; // hero half depth along the track
const STAND_H = 1.45;
const ROLL_H = 0.7;
const HIT_X = 1.15; // lateral overlap for front hits
const SIDE_X = 1.45; // lateral distance at which a pod's side bounces the hero back
const INVULN_TIME = 1.5;
const STUMBLE_WINDOW = 4;
const MAGNET_RANGE = 30;
const TITLE_FOV = 58;
const CAUSES = {
  pod: 'Smacked into a cargo pod. Switch lanes or use a ramp.',
  barrier: 'Tripped on a barrier. Swipe up to jump.',
  gate: 'Clipped a gate. Swipe down to roll under.',
  stumble: 'Two bumps in a row knocked Volt over.',
};

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('voltdash.' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('voltdash.' + key, JSON.stringify(value));
    } catch {
      /* storage blocked or full: progress just isn't saved */
    }
  },
};

function boot() {
  const params = new URLSearchParams(location.search);
  const fixedSeed = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;

  const ui = createUI({
    onPlay: () => startRun(),
    onPause: () => pause(),
    onResume: () => resume(),
    onHome: () => goHome(),
    onMute: () => {
      audio.setMuted(!audio.muted);
      store.set('muted', audio.muted);
      ui.muted(audio.muted);
      audio.play('click');
    },
  });
  const audio = createAudio(store.get('muted', false) === true);
  ui.muted(audio.muted);

  /** @type {WebGLRenderer} */
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('WebGL init failed', err);
    ui.fatal('Volt Dash needs WebGL 2, which this device could not start. Try updating Android System WebView.');
    window.__onBack = () => 'exit'; // never trap the Back button on the error screen
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(FOG_COLOR);
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(TITLE_FOV, 1, 0.1, 600);
  const world = createWorld(scene, renderer);
  const hero = createHero(scene);
  const entities = createEntities(scene);

  const G = {
    /** @type {'title'|'playing'|'paused'|'dying'|'over'} */
    mode: 'title',
    time: 0,
    run: 0,
    d: 0,
    speed: 0,
    score: 0,
    cells: 0,
    streak: 0,
    lastCell: -9,
    shake: 0,
    dyingT: 0,
    invulnT: 0,
    cause: 'pod',
    best: Number(store.get('best', 0)) || 0,
    total: Number(store.get('cells', 0)) || 0,
  };
  const P = {
    lane: 1,
    laneFrom: 1,
    x: 0,
    xFrom: 0,
    xTo: 0,
    laneT: 1,
    laneVel: 0,
    y: 0,
    vy: 0,
    grounded: true,
    floor: 0,
    rollT: 0,
    jumpBuf: 0,
    stumbleAt: -99,
    power: { magnet: 0, spring: 0, shield: 0, x2: 0 },
  };

  function resetPlayer() {
    Object.assign(P, { lane: 1, laneFrom: 1, x: 0, xFrom: 0, xTo: 0, laneT: 1, laneVel: 0, y: 0, vy: 0 });
    Object.assign(P, { grounded: true, floor: 0, rollT: 0, jumpBuf: 0, stumbleAt: -99 });
    for (const k in P.power) P.power[k] = 0;
  }

  // ---------- run lifecycle ----------
  function startRun() {
    if (G.mode === 'playing' || G.mode === 'dying') return;
    audio.unlock();
    resetPlayer();
    hero.reset();
    Object.assign(G, { d: 0, run: 0, score: 0, cells: 0, streak: 0, invulnT: 0, shake: 0, speed: T.SPEED_MIN });
    entities.reset(fixedSeed ?? (Math.random() * 2 ** 31) >>> 0);
    entities.spawn(0, 0);
    world.reset(0);
    G.mode = 'playing';
    ui.hud(0, 0, P.power);
    ui.show('hud');
    audio.play('start');
  }

  function pause() {
    if (G.mode !== 'playing') return;
    G.mode = 'paused';
    ui.show('pause');
    audio.suspend();
  }

  function resume() {
    if (G.mode !== 'paused') return;
    audio.unlock();
    G.mode = 'playing';
    last = performance.now();
    ui.show('hud');
  }

  function goHome() {
    G.mode = 'title';
    entities.clear();
    resetPlayer();
    hero.reset();
    G.d = 0;
    world.reset(0);
    ui.titleStats(G.best, G.total);
    ui.show('title');
  }

  function crash(cause) {
    if (P.power.shield > 0) {
      P.power.shield = 0;
      G.invulnT = INVULN_TIME;
      G.shake = 0.35;
      audio.play('shield');
      return false;
    }
    G.mode = 'dying';
    G.dyingT = 0;
    G.cause = cause;
    G.shake = 0.7;
    hero.crash();
    audio.play('crash');
    return true;
  }

  function gameOver() {
    G.mode = 'over';
    const score = Math.floor(G.score);
    const isBest = score > G.best;
    if (isBest) {
      G.best = score;
      store.set('best', score);
    }
    G.total += G.cells;
    store.set('cells', G.total);
    ui.gameOver({ score, cells: G.cells, best: G.best, isBest, cause: CAUSES[G.cause] });
    ui.show('over');
  }

  // ---------- actions ----------
  function changeLane(dir) {
    const target = P.lane + dir;
    if (target < 0 || target >= T.LANES) return;
    P.laneFrom = P.lane;
    P.lane = target;
    P.xFrom = P.x;
    P.xTo = T.laneX(target);
    P.laneT = 0;
  }

  function doJump() {
    P.vy = P.power.spring > 0 ? SPRING_V : JUMP_V;
    P.grounded = false;
    P.rollT = 0;
    P.jumpBuf = 0;
    hero.jump();
    audio.play('jump');
  }

  function jump() {
    if (P.grounded) doJump();
    else P.jumpBuf = JUMP_BUFFER; // pressed just before landing: jump on touchdown
  }

  function roll() {
    if (!P.grounded) P.vy = Math.min(P.vy, FAST_FALL_V);
    P.rollT = ROLL_TIME;
    P.jumpBuf = 0;
    audio.play('roll');
  }

  /** @param {import('./input.js').Action} a */
  function onAction(a) {
    audio.unlock();
    if (G.mode === 'title' || G.mode === 'over') {
      if (a === 'confirm' || a === 'up') startRun();
      return;
    }
    if (G.mode === 'paused') {
      if (a === 'confirm' || a === 'pause') resume();
      return;
    }
    if (G.mode !== 'playing') return;
    if (a === 'left') changeLane(-1);
    else if (a === 'right') changeLane(1);
    else if (a === 'up') jump();
    else if (a === 'down') roll();
    else if (a === 'pause') pause();
  }

  // ---------- physics ----------
  const laneOf = (x) => Math.max(0, Math.min(T.LANES - 1, Math.round(x / T.LANE_W) + 1));

  /** Highest pod surface in `lane` at d that the hero (feet at y) can stand on. */
  function floorAt(lane, d, y) {
    let f = 0;
    for (const ob of entities.obstacles) {
      if (ob.kind !== 'pod' || ob.lane !== lane) continue;
      const h = T.podSurface(ob, d);
      if (h > f && h <= y + STEP) f = h;
    }
    return f;
  }

  /** Would moving sideways into `lane` hit the side of a pod (or a ramp too high to step on)? */
  function sideBlocked(lane, d, y) {
    for (const ob of entities.obstacles) {
      if (ob.kind !== 'pod' || ob.lane !== lane) continue;
      const front = T.podFront(ob);
      if (d + HALF_D > front && d - HALF_D < ob.s + ob.len && y < T.POD_H - STEP) return true;
      if (ob.ramp && d >= ob.s && d < front && T.podSurface(ob, d) > y + STEP) return true;
    }
    return false;
  }

  /** @returns {keyof typeof CAUSES | null} */
  function hitTest(d) {
    for (const ob of entities.obstacles) {
      if (Math.abs(P.x - T.laneX(ob.lane)) >= HIT_X) continue;
      const front = ob.kind === 'pod' ? T.podFront(ob) : ob.s;
      if (d + HALF_D <= front || d - HALF_D >= ob.s + ob.len) continue;
      if (ob.kind === 'pod') {
        if (P.y < T.POD_H - STEP) return 'pod';
      } else if (ob.kind === 'barrier') {
        if (P.y < T.BARRIER_H - 0.12) return 'barrier';
      } else if (P.y + (P.rollT > 0 ? ROLL_H : STAND_H) > T.GATE_BOTTOM + 0.05) {
        return 'gate';
      }
    }
    return null;
  }

  function stumble() {
    G.shake = 0.4;
    hero.stumble();
    audio.play('bump');
    if (G.invulnT > 0) return;
    if (G.run - P.stumbleAt < STUMBLE_WINDOW) crash('stumble');
    else P.stumbleAt = G.run;
  }

  function bounce() {
    const back = P.laneFrom;
    P.lane = back;
    P.xFrom = P.x;
    P.xTo = T.laneX(back);
    P.laneT = 0;
    stumble();
  }

  function collectCell() {
    G.cells++;
    G.streak = G.time - G.lastCell < 0.45 ? G.streak + 1 : 0;
    G.lastCell = G.time;
    audio.play('cell', G.streak);
  }

  function pickups(d) {
    const cy = P.y + (P.rollT > 0 ? 0.4 : 0.75);
    const cells = entities.cells;
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      if (c.pulled || Math.abs(c.s - d) > 0.9 || Math.abs(c.x - P.x) > 0.95 || Math.abs(c.y - cy) > 1.0) continue;
      entities.removeCell(i);
      collectCell();
    }
    const powers = entities.powers;
    for (let i = powers.length - 1; i >= 0; i--) {
      const p = powers[i];
      if (Math.abs(p.s - d) > 1.0 || Math.abs(T.laneX(p.lane) - P.x) > 1.1 || Math.abs(p.y - cy) > 1.3) continue;
      P.power[p.kind] = T.POWER_TIME;
      entities.removePower(i);
      audio.play('power');
    }
  }

  function step(h) {
    G.d += G.speed * h;
    G.score += G.speed * h * (P.power.x2 > 0 ? 2 : 1);
    const d = G.d;

    if (P.laneT < 1) {
      P.laneT = Math.min(1, P.laneT + h / T.LANE_TIME);
      const e = 1 - (1 - P.laneT) ** 2;
      P.x = P.xFrom + (P.xTo - P.xFrom) * e;
      if (P.lane !== P.laneFrom && Math.abs(P.x - T.laneX(P.lane)) < SIDE_X && sideBlocked(P.lane, d, P.y)) {
        bounce();
        if (G.mode !== 'playing') return;
      }
    }

    P.rollT = Math.max(0, P.rollT - h);
    P.jumpBuf = Math.max(0, P.jumpBuf - h);
    P.vy -= GRAVITY * h;
    P.y += P.vy * h;
    P.floor = floorAt(laneOf(P.x), d, P.y);
    if (P.y <= P.floor) {
      if (!P.grounded) hero.land(Math.min(1, -P.vy / 22));
      P.y = P.floor;
      P.vy = 0;
      P.grounded = true;
      if (P.jumpBuf > 0) doJump();
    } else if (P.y > P.floor + 0.02) {
      P.grounded = false;
    }

    if (G.invulnT <= 0) {
      const hit = hitTest(d);
      if (hit && crash(hit)) return;
    }
    pickups(d);
  }

  /** Magnet pulls nearby cells off the track; pulled cells fly to the hero even after it ends. */
  function magnet(dt) {
    const cells = entities.cells;
    const cy = P.y + 0.75;
    const pulling = P.power.magnet > 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      if (!c.pulled) {
        const ahead = c.s - G.d;
        if (!pulling || ahead > MAGNET_RANGE || ahead < -1) continue;
        Object.assign(c, { pulled: true, px: c.x, py: c.y, pz: -ahead });
      }
      const dx = P.x - c.px;
      const dy = cy - c.py;
      const dz = -c.pz;
      const dist = Math.hypot(dx, dy, dz);
      const move = (G.speed + 28) * dt;
      if (dist <= Math.max(move, 0.7)) {
        entities.removeCell(i);
        collectCell();
        continue;
      }
      c.px += (dx / dist) * move;
      c.py += (dy / dist) * move;
      c.pz += (dz / dist) * move;
    }
  }

  // ---------- camera ----------
  const camPos = new Vector3(1.15, 1.85, 5.0);
  const camLook = new Vector3(0, 1.05, 0);
  const tgtPos = new Vector3();
  const tgtLook = new Vector3();
  let runFov = 70;

  /** Vertical FOV that keeps ~50 degrees horizontally, so all three lanes fit in portrait. */
  const fitFov = (aspect) => {
    const v = (2 * Math.atan(Math.tan((50 * Math.PI) / 360) / aspect) * 180) / Math.PI;
    return Math.min(92, Math.max(56, v));
  };

  function updateCamera(dt) {
    const title = G.mode === 'title';
    if (title) {
      tgtPos.set(1.15, 1.85, 5.0);
      tgtLook.set(0, 1.05, 0);
    } else {
      const lift = P.floor * 0.75 + Math.max(0, P.y - P.floor) * 0.2;
      tgtPos.set(P.x * 0.4, 4.6 + lift, 5.6);
      tgtLook.set(P.x * 0.5, 0.3 + lift * 0.8, -14);
    }
    const k = 1 - Math.exp(-dt * (title ? 2.5 : 6));
    camPos.lerp(tgtPos, k);
    camLook.lerp(tgtLook, k);
    const fov = title ? TITLE_FOV : runFov;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(camPos);
    if (G.shake > 0) {
      G.shake = Math.max(0, G.shake - dt * 1.6);
      const a = G.shake * 0.35;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
    }
    camera.lookAt(camLook);
  }

  // ---------- frame ----------
  /** @type {import('./hero.js').HeroFrame} */
  const heroFrame = {
    time: 0, running: false, speed: 0, x: 0, y: 0, floor: 0, grounded: true, vy: 0,
    rolling: false, laneVel: 0, facing: Math.PI, spring: false, shield: false, invuln: 0,
  };

  function update(dt) {
    G.time += dt;
    const prevX = P.x;
    if (G.mode === 'playing') {
      G.run += dt;
      G.speed = T.speedAt(G.run);
      const n = Math.ceil(dt / SUBSTEP - 1e-9);
      for (let i = 0; i < n && G.mode === 'playing'; i++) step(dt / n);
      for (const k in P.power) P.power[k] = Math.max(0, P.power[k] - dt);
      G.invulnT = Math.max(0, G.invulnT - dt);
      if (G.mode === 'playing') {
        magnet(dt);
        entities.spawn(G.d, T.difficultyAt(G.speed));
      }
      ui.hud(G.score, G.cells, P.power);
    } else if (G.mode === 'dying') {
      G.dyingT += dt;
      if (G.dyingT >= 0.95) gameOver();
    }
    P.laneVel = (P.x - prevX) / dt;

    world.update(G.d, camera);
    entities.sync(G.d, G.time);
    Object.assign(heroFrame, {
      time: G.time,
      running: G.mode === 'playing',
      speed: G.mode === 'playing' ? G.speed : 0,
      x: P.x,
      y: P.y,
      floor: P.floor,
      grounded: P.grounded,
      vy: P.vy,
      rolling: P.rollT > 0,
      laneVel: P.laneVel,
      facing: G.mode === 'title' ? Math.PI : 0,
      spring: P.power.spring > 0,
      shield: P.power.shield > 0,
      invuln: G.invulnT,
    });
    hero.update(dt, heroFrame);
    updateCamera(dt);
  }

  const render = () => renderer.render(scene, camera);
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    if (G.mode === 'paused' || dt <= 0) return; // the canvas keeps showing the last frame
    update(dt);
    render();
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    runFov = fitFov(camera.aspect);
    camera.updateProjectionMatrix();
    if (G.mode === 'paused') render();
  }

  // ---------- wiring ----------
  createInput(renderer.domElement, onAction);
  for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, () => audio.unlock(), { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // allow three.js to restore the context
    pause();
  });

  // Host hooks for the Android shell (MainActivity) and tests.
  window.__pause = () => pause();
  window.__onBack = () => {
    if (G.mode === 'title') return 'exit';
    if (G.mode === 'playing') pause();
    else if (G.mode === 'paused' || G.mode === 'over') goHome();
    return 'paused';
  };
  window.__voltState = () => ({ mode: G.mode, lane: P.lane, d: G.d, score: Math.floor(G.score), cells: G.cells });

  resize();
  world.reset(0);
  ui.titleStats(G.best, G.total);
  ui.show('title');
  requestAnimationFrame(frame);
}

boot();

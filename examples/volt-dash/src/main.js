// Volt Dash entry: app state machine (menu / run / revive / results), player physics,
// collisions, stage progression and the frame loop. Economy rules live in meta.js,
// screens in ui.js, the save in save.js.
import { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import * as T from './track.js';
import * as C from './catalog.js';
import * as M from './meta.js';
import { openSave } from './save.js';
import { createAudio } from './audio.js';
import { POWER_COLORS, createEntities } from './entities.js';
import { createHero } from './hero.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { FOG_COLOR, createWorld } from './world.js';

const MAX_DT = 1 / 30; // a long frame never advances the sim more than this
const SUBSTEP = 1 / 120; // physics step, keeps per-step travel < 0.5 units at top speed
const SPRING_H = 3.4; // high enough to land on a pod top
const ROLL_TIME = 0.6;
const FAST_FALL_V = -30;
const JUMP_BUFFER = 0.15;
const STEP = 0.4; // how far below a surface the hero may be and still step onto it
const HALF_D = T.HALF_D;
const STAND_H = 1.45;
const ROLL_H = 0.7;
const HIT_X = 1.15; // lateral overlap for front hits
const SIDE_X = 1.45; // lateral distance at which a pod's side bounces the hero back
const INVULN_TIME = 1.5;
const REVIVE_INVULN = 2.5;
const STUMBLE_WINDOW = 4;
const MAGNET_RANGE = 30;
const HYPER_Y = 3.0; // Hyper Dash flies above every obstacle
const HYPER_MUL = 1.6;
const HYPER_AFTER = 1.2; // grace period after a dash ends
const MENU_FOV = 58;
const CAUSES = {
  pod: 'Smacked into a cargo pod. Switch lanes or use a ramp.',
  barrier: 'Tripped on a barrier. Swipe up to jump.',
  gate: 'Clipped a gate. Swipe down to roll under.',
  stumble: 'Two bumps in a row knocked you over.',
  roller: 'Flattened by a rolling boulder. Dodge to another lane.',
  slider: 'A sliding pod caught you. Watch its flashing arrow.',
  laser: 'Zapped by a laser gate. Pass while its lights are green.',
  gap: 'Fell through a gap. Jump over missing road.',
};

function boot() {
  const params = new URLSearchParams(location.search);
  // Debug-only URL params (the APK loads index.html without a query string).
  const fixedSeed = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
  const debugStage = Math.max(1, Math.min(20, Math.floor(Number(params.get('stage'))) || 1));
  const god = params.get('god') === '1';

  let storage = null;
  try {
    storage = window.localStorage;
  } catch {
    /* storage blocked: play without saving */
  }
  const save = openSave(storage);
  const S = () => save.data;
  const audio = createAudio({ sound: S().settings.sound, music: S().settings.music });
  const today = () => C.dayKey(new Date());
  const view = { charIndex: 0, shopTab: 'upgrades' };
  const fmtMult = (m) => String(Math.round(m * 10) / 10);
  const viewState = () => ({
    ...view,
    mult: fmtMult(C.scoreMultiplier(S().missions.tier, S().level, false)),
    badges: M.badges(S(), today()),
    missions: M.missions(S()),
    daily: C.dailyStatus(S().daily, today()),
  });
  const vibrate = (p) => {
    try {
      if (S().settings.vibe && navigator.vibrate) navigator.vibrate(p);
    } catch {
      /* haptics are optional */
    }
  };

  const ui = createUI({ act: (a, arg, el) => act(a, arg, el) });
  const refresh = () => ui.render(S(), viewState());
  const commit = () => {
    save.persist();
    refresh();
  };

  /** @type {WebGLRenderer} */
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('WebGL init failed', err);
    ui.fatal('Volt Dash needs WebGL, which this device could not start. Try updating Android System WebView.');
    window.__onBack = () => 'exit'; // never trap the Back button on the error screen
    return;
  }
  renderer.setClearColor(FOG_COLOR);
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(MENU_FOV, 1, 0.1, 600);
  const world = createWorld(scene, renderer);
  const hero = createHero(scene);
  const entities = createEntities(scene);

  const G = {
    /** @type {'menu'|'playing'|'paused'|'dying'|'revive'|'over'} */
    mode: 'menu',
    time: 0, run: 0, d: 0, d0: 0, speed: 0, score: 0, cells: 0, gems: 0, streak: 0, lastCell: -9,
    shake: 0, dyingT: 0, invulnT: 0, cause: 'pod', stage: 1, mult: 1, dashTo: -1, wasHyper: false,
    shieldHits: 0, revivesPaid: 0, tokenUsed: false, tut: 0, missionT: 0,
    useHeadstart: false, useBooster: false, reviveAllowed: false,
    perk: { id: 'volt', value: 0, level: 1 }, jumpV: 0, springV: 0, grav: T.GRAVITY,
    stats: /** @type {Record<string, number>} */ ({}),
    doneAtStart: [false, false, false],
    toasted: [false, false, false],
  };
  const P = {
    lane: 1, laneFrom: 1, x: 0, xFrom: 0, xTo: 0, laneT: 1, laneVel: 0, y: 0, vy: 0,
    grounded: true, floor: 0, rollT: 0, jumpBuf: 0, stumbleAt: -99,
    power: { magnet: 0, spring: 0, shield: 0, x2: 0, hyper: 0 },
    powerMax: { magnet: 1, spring: 1, shield: 1, x2: 1, hyper: 1 },
  };

  function resetPlayer() {
    Object.assign(P, { lane: 1, laneFrom: 1, x: 0, xFrom: 0, xTo: 0, laneT: 1, laneVel: 0, y: 0, vy: 0 });
    Object.assign(P, { grounded: true, floor: 0, rollT: 0, jumpBuf: 0, stumbleAt: -99 });
    for (const k in P.power) P.power[k] = 0;
  }
  const isHyper = () => P.power.hyper > 0 || G.d < G.dashTo;
  const safe = () => G.invulnT > 0 || god;

  // ---------- menu actions ----------
  function setTab(name) {
    if (G.mode !== 'menu') return;
    ui.closeSheet();
    if (name === 'chars') view.charIndex = Math.max(0, C.CHARACTERS.findIndex((c) => c.id === S().selected));
    hero.setModel(name === 'chars' ? C.CHARACTERS[view.charIndex].id : S().selected);
    ui.setTab(name);
    refresh();
  }

  /** Shared feedback for anything that spends currency. */
  function spend(r, el, kind) {
    if (r.ok) {
      audio.play('buy');
      vibrate(15);
      ui.fly(kind, el, 6, true);
      commit();
      return true;
    }
    audio.play('error');
    vibrate([30, 40, 30]);
    ui.shake(el);
    if (r.reason === 'funds') ui.toast({ ic: kind === 'gems' ? 'gem' : 'cell', color: '#ff4a5e', title: `Not enough ${kind === 'gems' ? 'Gems' : 'Cells'}` });
    if (r.reason === 'level') ui.toast({ ic: 'lock', color: '#ff4a5e', title: 'Account level too low' });
    return false;
  }
  function earn(prize, el) {
    if (prize.cells) ui.fly('cells', el, 10);
    if (prize.gems) ui.fly('gems', el, 6);
  }
  function levelToast(ups) {
    if (!ups) return;
    audio.play('levelup');
    ui.toast({ ic: 'star', color: '#ffb02e', title: `Level up! Level ${S().level}`, sub: `+${2 * ups} Gems · score bonus +${2 * (S().level - 1)}%` });
  }
  const priceKind = (p) => (p.gems && !p.cells ? 'gems' : 'cells');

  /** @param {string} a @param {string|undefined} arg @param {HTMLElement} el */
  function act(a, arg, el) {
    audio.unlock();
    switch (a) {
      case 'tab':
        if (ui.tab !== arg) audio.play('click');
        setTab(arg);
        break;
      case 'shop':
        audio.play('click');
        view.shopTab = arg || 'upgrades';
        if (G.mode === 'menu') setTab('shop');
        break;
      case 'shop-tab':
        audio.play('click');
        view.shopTab = arg;
        refresh();
        break;
      case 'play':
        if (G.mode !== 'menu') break;
        audio.play('click');
        vibrate(10);
        ui.openSheet('loadout', S(), viewState());
        break;
      case 'go':
      case 'again':
        beginRun();
        break;
      case 'pause':
        pause();
        break;
      case 'resume':
        resume();
        break;
      case 'quit':
        quitRun();
        break;
      case 'home':
        audio.play('click');
        goHome();
        break;
      case 'close':
        audio.play('click');
        ui.closeSheet();
        refresh();
        break;
      case 'settings':
        audio.play('click');
        ui.openSheet('settings', S(), viewState());
        break;
      case 'set': {
        const st = S().settings;
        st[arg] = !st[arg];
        applySettings();
        audio.play('toggle');
        if (arg === 'vibe') vibrate(30);
        commit();
        break;
      }
      case 'quality':
        S().settings.quality = arg === 'low' ? 'low' : 'high';
        applySettings();
        audio.play('toggle');
        commit();
        break;
      case 'reset':
        audio.play('click');
        ui.openSheet('confirm', S(), viewState());
        break;
      case 'reset-yes':
        save.reset();
        applySettings();
        ui.closeSheet();
        setTab('home');
        ui.toast({ ic: 'reset', color: '#ff4a5e', title: 'Progress reset' });
        refresh();
        break;
      case 'daily':
        audio.play('click');
        ui.openSheet('daily', S(), viewState());
        break;
      case 'claim-daily': {
        const r = M.claimDaily(S(), today());
        if (!r.ok) {
          ui.shake(el);
          audio.play('error');
          break;
        }
        audio.play('claim');
        vibrate(25);
        earn(r.prize, el);
        ui.toast({ ic: 'calendar', color: '#ff6aa8', title: `Day ${r.slot + 1} reward claimed!` });
        commit();
        break;
      }
      case 'up':
        spend(M.buyUpgrade(S(), arg), el, 'cells');
        break;
      case 'item':
        spend(M.buyItem(S(), arg), el, priceKind(C.ITEMS[arg].price));
        break;
      case 'open-box': {
        const r = M.openMystery(S(), Math.random());
        if (!r.ok) break;
        audio.play('open');
        vibrate([20, 60, 40]);
        save.persist();
        ui.mystery(r.prize);
        refresh();
        break;
      }
      case 'char': {
        const n = C.CHARACTERS.length;
        view.charIndex = (view.charIndex + Number(arg) + n) % n;
        hero.setModel(C.CHARACTERS[view.charIndex].id);
        hero.pop();
        audio.play('click');
        refresh();
        break;
      }
      case 'char-select':
        if (M.selectChar(S(), arg).ok) {
          audio.play('claim');
          vibrate(15);
          hero.pop();
          commit();
        }
        break;
      case 'char-unlock': {
        const c = C.charById(arg);
        if (spend(M.unlockChar(S(), arg), el, priceKind(c.unlock))) {
          hero.pop();
          ui.toast({ ic: 'chars', color: c.color, title: `${c.name} unlocked!`, sub: 'Selected for your next run' });
        }
        break;
      }
      case 'char-upgrade':
        if (spend(M.upgradeChar(S(), arg), el, 'cells')) {
          hero.pop();
          const c = C.charById(arg);
          ui.toast({ ic: 'star', color: c.color, title: `${c.name} reached level ${S().chars[arg]}`, sub: c.perkText(S().chars[arg]) });
        }
        break;
      case 'claim': {
        const r = M.claimMission(S(), Number(arg));
        if (!r.ok) break;
        audio.play('claim');
        vibrate(25);
        earn(r.reward, el);
        if (r.tierUp) ui.toast({ ic: 'missions', color: '#8a5cff', title: `Multiplier x${S().missions.tier}!`, sub: 'New missions unlocked' });
        levelToast(r.levelUps);
        commit();
        break;
      }
      case 'lo':
        S().loadout[arg] = !S().loadout[arg];
        audio.play('toggle');
        commit();
        break;
      case 'rv-token':
      case 'rv-gems':
        doRevive(a === 'rv-token');
        break;
      case 'rv-skip':
        if (G.mode === 'revive') gameOver();
        break;
      case 'tick':
        audio.play('tick');
        break;
      default:
        break;
    }
  }

  function applySettings() {
    const st = S().settings;
    audio.setSound(st.sound);
    audio.setMusic(st.music);
    world.setQuality(st.quality);
    resize();
  }

  // ---------- run lifecycle ----------
  function beginRun() {
    if (G.mode === 'playing' || G.mode === 'dying' || G.mode === 'revive') return;
    const s = S();
    const use = (k) => s.loadout[k] && s.items[k] > 0;
    G.useHeadstart = use('headstart');
    G.useBooster = use('booster');
    G.reviveAllowed = use('revive');
    if (G.useHeadstart) s.items.headstart--;
    if (G.useBooster) s.items.booster--;
    save.persist();
    startRun();
  }

  function startRun() {
    audio.unlock();
    ui.closeSheet();
    const s = S();
    const d0 = T.stageStart(debugStage);
    resetPlayer();
    hero.setModel(s.selected);
    hero.reset();
    G.perk = M.perk(s);
    const nimbus = G.perk.id === 'nimbus' ? 1 + G.perk.value / 100 : 1;
    G.grav = T.GRAVITY * (G.perk.id === 'nimbus' ? 0.86 : 1);
    G.jumpV = Math.sqrt(2 * G.grav * T.JUMP_H * nimbus);
    G.springV = Math.sqrt(2 * G.grav * SPRING_H);
    G.tut = s.tutorialDone ? 0 : 1;
    Object.assign(G, {
      d: d0, d0, run: 0, score: 0, cells: 0, gems: 0, streak: 0, invulnT: 0, shake: 0, speed: T.entrySpeed(debugStage),
      stage: debugStage, revivesPaid: 0, tokenUsed: false, dashTo: G.useHeadstart ? d0 + C.HEADSTART_M : -1, wasHyper: false,
      shieldHits: 0, missionT: 0, toasted: [false, false, false],
      mult: C.scoreMultiplier(s.missions.tier, s.level, G.useBooster),
      stats: { jumps: 0, gates: 0, powers: 0, lanes: 0 },
    });
    G.doneAtStart = M.missions(s).map((m) => m.done);
    entities.reset(fixedSeed ?? (Math.random() * 2 ** 31) >>> 0, d0, G.tut ? T.START_S + 70 : T.START_S);
    entities.spawn(d0);
    const theme = T.themeOf(G.stage);
    world.setTheme(theme, true);
    world.reset(d0);
    audio.song(theme, 'run');
    G.mode = 'playing';
    ui.show('hud');
    ui.tutorial(G.tut);
    ui.banner(G.stage, T.stageName(G.stage), theme);
    audio.play('start');
    if (G.useHeadstart) audio.play('hyper');
    if (G.useBooster) ui.toast({ ic: 'booster', color: '#ffb02e', title: 'Score Booster active', sub: `Multiplier x${fmtMult(G.mult)}` });
    last = performance.now();
  }

  function pause() {
    if (G.mode !== 'playing') return;
    G.mode = 'paused';
    ui.show('pause');
    audio.suspend();
  }

  function resume() {
    if (G.mode !== 'paused') return;
    ui.closeSheet();
    audio.unlock();
    G.mode = 'playing';
    last = performance.now();
    ui.show('hud');
  }

  function goHome() {
    G.mode = 'menu';
    entities.clear();
    resetPlayer();
    hero.reset();
    G.d = 0;
    G.dashTo = -1;
    world.setTheme(0, true);
    world.reset(0);
    audio.song(0, 'menu');
    audio.unlock();
    ui.tutorial(0);
    ui.clearBanner();
    ui.closeSheet();
    ui.show('menu');
    setTab('home');
  }

  function crash(cause) {
    if (god) return false;
    if (P.power.shield > 0) {
      G.shieldHits--;
      if (G.shieldHits <= 0) P.power.shield = 0;
      G.invulnT = INVULN_TIME;
      G.shake = 0.35;
      audio.play('shield');
      vibrate(40);
      return false;
    }
    G.mode = 'dying';
    G.dyingT = 0;
    G.cause = cause;
    G.shake = 0.7;
    hero.crash();
    audio.play('crash');
    vibrate(160);
    return true;
  }

  function reviveOffer() {
    const s = S();
    const tokenOk = G.reviveAllowed && !G.tokenUsed && s.items.revive > 0;
    const cost = C.reviveGems(G.revivesPaid);
    const gemsOk = G.revivesPaid < 4 && s.gems >= cost;
    return { tokens: s.items.revive, tokenOk, cost, gemsOk };
  }

  function afterDeath() {
    const offer = reviveOffer();
    if (!offer.tokenOk && !offer.gemsOk) return gameOver();
    G.mode = 'revive';
    ui.revive(offer, () => act('rv-skip'));
  }

  function doRevive(token) {
    if (G.mode !== 'revive') return;
    const s = S();
    const offer = reviveOffer();
    if (token && offer.tokenOk) {
      s.items.revive--;
      G.tokenUsed = true;
    } else if (!token && offer.gemsOk) {
      s.gems -= offer.cost;
      G.revivesPaid++;
    } else return;
    save.persist();
    entities.clearAhead(G.d - 6, G.d + 50);
    hero.revive();
    hero.reset();
    Object.assign(P, { y: 0, vy: 0, grounded: true, floor: 0, rollT: 0, jumpBuf: 0, stumbleAt: -99 });
    G.invulnT = REVIVE_INVULN;
    G.mode = 'playing';
    ui.show('hud');
    audio.play('power');
    vibrate(30);
    last = performance.now();
  }

  /** Bank the run into the save; returns applyRun's summary. */
  function finishRun() {
    const s = S();
    const score = Math.floor(G.score);
    const stats = liveStats();
    const res = M.applyRun(s, { score, meters: stats.meters, cells: G.cells, gems: G.gems, stats });
    s.tutorialDone = true;
    save.persist();
    levelToast(res.levelUps);
    return { score, stats, res };
  }

  function gameOver() {
    G.mode = 'over';
    const { score, stats, res } = finishRun();
    const ms = M.missions(S());
    ui.results({
      score,
      isBest: res.isBest,
      cause: CAUSES[G.cause],
      stage: G.stage,
      tally: [
        { ic: 'flag', label: 'Distance', value: stats.meters, suffix: ' m' },
        { ic: 'cell', label: 'Cells', value: G.cells },
        { ic: 'gem', label: 'Gems', value: G.gems },
        { ic: 'star', label: 'XP', value: res.xp },
      ],
      missions: ms.map((m) => ({ text: m.text, progress: m.progress, target: m.target, done: m.done })),
    });
    ui.show('over');
    if (res.isBest) {
      audio.play('levelup');
      vibrate([30, 50, 30]);
    }
    refresh();
  }

  function quitRun() {
    if (G.mode !== 'paused') return;
    finishRun();
    goHome();
  }

  const liveStats = () => ({
    ...G.stats,
    cells: G.cells,
    meters: Math.floor(G.d - G.d0),
    score: Math.floor(G.score),
    stage: G.stage,
  });

  function checkMissions() {
    const ms = M.missions(S(), liveStats());
    ms.forEach((m, i) => {
      if (m.done && !G.doneAtStart[i] && !G.toasted[i]) {
        G.toasted[i] = true;
        audio.play('claim');
        ui.toast({ ic: 'missions', color: '#3ddc84', title: 'Mission complete!', sub: m.text });
      }
    });
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
    G.stats.lanes++;
    if (G.tut === 1) setTut(2);
  }

  function doJump() {
    P.vy = P.power.spring > 0 ? G.springV : G.jumpV;
    P.grounded = false;
    P.rollT = 0;
    P.jumpBuf = 0;
    G.stats.jumps++;
    hero.jump();
    audio.play('jump');
    if (G.tut === 2) setTut(3);
  }

  function jump() {
    if (isHyper()) return;
    if (P.grounded) doJump();
    else P.jumpBuf = JUMP_BUFFER; // pressed just before landing: jump on touchdown
  }

  function roll() {
    if (isHyper()) return;
    if (!P.grounded) P.vy = Math.min(P.vy, FAST_FALL_V);
    P.rollT = ROLL_TIME;
    P.jumpBuf = 0;
    audio.play('roll');
    if (G.tut === 3) setTut(0);
  }

  function setTut(step) {
    G.tut = step;
    ui.tutorial(step);
    if (step === 0) ui.toast({ ic: 'check', color: '#3ddc84', title: "You're ready!", sub: 'Grab Cells, dodge everything' });
  }

  /** @param {import('./input.js').Action} a */
  function onAction(a) {
    audio.unlock();
    if (G.mode === 'menu') {
      if (ui.tab === 'chars' && !ui.sheet && (a === 'left' || a === 'right')) act('char', a === 'left' ? '-1' : '1', document.body);
      else if (a === 'confirm') act(ui.sheet === 'loadout' ? 'go' : ui.sheet ? 'close' : 'play', undefined, document.body);
      return;
    }
    if (G.mode === 'over') {
      if (a === 'confirm') beginRun();
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

  function overGap(lane, d) {
    for (const ob of entities.obstacles) {
      if (ob.kind === 'gap' && ob.lane === lane && d > ob.s + 0.2 && d < ob.s + ob.len - 0.2) return true;
    }
    return false;
  }

  /** Highest surface in `lane` at d that the hero (feet at y) can stand on; -20 over a gap. */
  function floorAt(lane, d, y) {
    let f = overGap(lane, d) && !safe() ? -20 : 0;
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
    const top = P.y + (P.rollT > 0 ? ROLL_H : STAND_H);
    for (const ob of entities.obstacles) {
      if (ob.kind === 'gap') continue;
      const ox = ob.kind === 'slider' ? T.sliderX(ob, d) : T.laneX(ob.lane);
      if (Math.abs(P.x - ox) >= HIT_X) continue;
      const front = ob.kind === 'pod' ? T.podFront(ob) : ob.kind === 'roller' ? T.rollerS(ob, d) : ob.s;
      const back = ob.kind === 'roller' ? front + ob.len : ob.s + ob.len;
      if (d + HALF_D <= front || d - HALF_D >= back) continue;
      switch (ob.kind) {
        case 'pod':
          if (P.y < T.POD_H - STEP) return 'pod';
          break;
        case 'barrier':
          if (P.y < T.BARRIER_H - 0.12) return 'barrier';
          break;
        case 'gate':
          if (top > T.GATE_BOTTOM + 0.05) return 'gate';
          break;
        case 'roller':
          if (P.y < T.ROLLER_H - STEP) return 'roller';
          break;
        case 'slider':
          if (P.y < T.SLIDER_H - STEP) return 'slider';
          break;
        case 'laser':
          if (T.laserOn(ob, d)) return 'laser';
          break;
        default:
          break;
      }
    }
    return null;
  }

  function stumble() {
    G.shake = 0.4;
    hero.stumble();
    audio.play('bump');
    vibrate(30);
    if (safe()) return;
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

  const x2 = () => (P.power.x2 > 0 ? 2 : 1);

  function collectCell() {
    G.cells++;
    G.score += 5 * G.mult * x2();
    G.streak = G.time - G.lastCell < 0.45 ? G.streak + 1 : 0;
    G.lastCell = G.time;
    audio.play('cell', G.streak);
    if (G.perk.id === 'orbit' && Math.random() * 100 < G.perk.value) {
      G.gems++;
      audio.play('gem');
    }
  }

  function givePower(kind) {
    const dur = M.powerDuration(S(), kind);
    P.power[kind] = dur;
    P.powerMax[kind] = dur;
    if (kind === 'shield') G.shieldHits = G.perk.id === 'moss' && G.perk.level >= 5 ? 2 : 1;
    G.stats.powers++;
    audio.play(kind === 'hyper' ? 'hyper' : 'power');
    vibrate(20);
  }

  function pickups(d, hyper) {
    const cy = P.y + (P.rollT > 0 ? 0.4 : 0.75);
    const near = (s, x, y, rs, rx, ry) => Math.abs(s - d) <= rs && Math.abs(x - P.x) <= rx && (hyper || Math.abs(y - cy) <= ry);
    const cells = entities.cells;
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      if (c.pulled || !near(c.s, c.x, c.y, 0.9, 0.95, 1.0)) continue;
      entities.removeCell(i);
      collectCell();
    }
    const powers = entities.powers;
    for (let i = powers.length - 1; i >= 0; i--) {
      const p = powers[i];
      if (!near(p.s, T.laneX(p.lane), p.y, 1.0, 1.1, 1.3)) continue;
      givePower(p.kind);
      entities.removePower(i);
    }
    const gems = entities.gems;
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      if (!near(g.s, T.laneX(g.lane), g.y, 1.0, 1.1, 1.3)) continue;
      G.gems++;
      entities.removeGem(i);
      audio.play('gem');
      vibrate(20);
    }
  }

  function step(h, v, hyper) {
    G.d += v * h;
    const voltBonus = G.perk.id === 'volt' ? 1 + G.perk.value / 100 : 1;
    G.score += v * h * G.mult * x2() * voltBonus; // 1 point per metre at x1
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
    if (hyper) {
      P.y += (HYPER_Y - P.y) * Math.min(1, h * 8);
      P.vy = 0;
      P.grounded = false;
      P.rollT = 0;
      P.floor = Math.max(0, floorAt(laneOf(P.x), d, P.y));
    } else {
      P.vy -= G.grav * h;
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
      if (P.y < -0.6 && crash('gap')) return;
      if (P.y < -0.6) P.y = 0; // shield saved us: pop back up onto the road
    }

    if (!hyper && !safe()) {
      const hit = hitTest(d);
      if (hit && crash(hit)) return;
    }
    for (const ob of entities.obstacles) {
      if (ob.kind !== 'gate' || ob.done || d - HALF_D <= ob.s + ob.len) continue;
      ob.done = true;
      if (Math.abs(P.x - T.laneX(ob.lane)) < HIT_X && P.rollT > 0) G.stats.gates++;
    }
    pickups(d, hyper);
  }

  /** Magnet (and Hyper Dash) pull nearby cells off the track; pulled cells fly to the hero. */
  function magnet(dt, hyper) {
    const cells = entities.cells;
    const cy = P.y + 0.75;
    const pulling = P.power.magnet > 0 || hyper;
    const range = hyper ? 45 : MAGNET_RANGE;
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      if (!c.pulled) {
        const ahead = c.s - G.d;
        if (!pulling || ahead > range || ahead < -1) continue;
        Object.assign(c, { pulled: true, px: c.x, py: c.y, pz: -ahead });
      }
      const dx = P.x - c.px;
      const dy = cy - c.py;
      const dz = -c.pz;
      const dist = Math.hypot(dx, dy, dz);
      const move = (G.speed * (hyper ? HYPER_MUL : 1) + 28) * dt;
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
    const menu = G.mode === 'menu';
    if (menu && ui.tab === 'chars') {
      tgtPos.set(0, 1.7, 5.8);
      tgtLook.set(0, 0.55, 0);
    } else if (menu) {
      tgtPos.set(1.15, 1.85, 5.0);
      tgtLook.set(0, 1.05, 0);
    } else {
      const floor = Math.max(0, P.floor);
      const lift = floor * 0.75 + Math.max(0, P.y - floor) * 0.2;
      tgtPos.set(P.x * 0.4, 4.6 + lift, 5.6);
      tgtLook.set(P.x * 0.5, 0.3 + lift * 0.8, -14);
    }
    const k = 1 - Math.exp(-dt * (menu ? 3 : 6));
    camPos.lerp(tgtPos, k);
    camLook.lerp(tgtLook, k);
    const fov = menu ? MENU_FOV : runFov;
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
    rolling: false, laneVel: 0, facing: Math.PI, spring: false, shield: false, hyper: false, invuln: 0, spinY: 0,
  };
  const powerFracs = { magnet: 0, spring: 0, shield: 0, x2: 0, hyper: 0 };

  function update(dt) {
    G.time += dt;
    const prevX = P.x;
    if (G.mode === 'playing') {
      G.run += dt;
      G.speed = T.accelerate(G.speed, dt, T.stageAt(G.d));
      const hyper = isHyper();
      if (G.wasHyper && !hyper) {
        G.invulnT = Math.max(G.invulnT, HYPER_AFTER);
        P.vy = 0;
      }
      G.wasHyper = hyper;
      const v = G.speed * (hyper ? HYPER_MUL : 1);
      const n = Math.ceil(dt / SUBSTEP - 1e-9);
      for (let i = 0; i < n && G.mode === 'playing'; i++) step(dt / n, v, hyper);
      for (const k in P.power) P.power[k] = Math.max(0, P.power[k] - dt);
      G.invulnT = Math.max(0, G.invulnT - dt);
      if (G.mode === 'playing') {
        magnet(dt, hyper);
        entities.spawn(G.d);
        const st = T.stageAt(G.d);
        if (st !== G.stage) {
          G.stage = st;
          const theme = T.themeOf(st);
          world.setTheme(theme);
          audio.song(theme, 'run');
          audio.play('stage');
          vibrate([20, 40, 20]);
          ui.banner(st, T.stageName(st), theme);
        }
        G.missionT -= dt;
        if (G.missionT <= 0) {
          G.missionT = 0.5;
          checkMissions();
        }
      }
      for (const k in powerFracs) powerFracs[k] = P.power[k] > 0 ? P.power[k] / P.powerMax[k] : 0;
      if (G.d < G.dashTo) powerFracs.hyper = Math.max(powerFracs.hyper, (G.dashTo - G.d) / C.HEADSTART_M);
      ui.hud(G.score, G.cells, G.gems, `x${fmtMult(G.mult * x2())}`);
      ui.powers(powerFracs, POWER_COLORS);
      ui.stage(G.stage, (G.d - T.stageStart(G.stage)) / T.STAGE_LEN, T.stageName(G.stage));
    } else if (G.mode === 'dying') {
      G.dyingT += dt;
      if (G.dyingT >= 0.95) afterDeath();
    }
    P.laneVel = (P.x - prevX) / dt;

    world.update(G.d, camera, dt);
    entities.sync(G.d, G.time);
    const menu = G.mode === 'menu';
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
      facing: menu ? Math.PI : 0,
      spinY: menu && ui.tab === 'chars' ? Math.sin(G.time * 0.7) * 0.6 : 0,
      spring: P.power.spring > 0,
      shield: P.power.shield > 0,
      hyper: G.mode === 'playing' && isHyper(),
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
    const ratio = S().settings.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
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
    if (document.hidden) {
      pause();
      audio.suspend();
    } else if (G.mode === 'menu') audio.unlock();
  });
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // allow three.js to restore the context
    pause();
  });

  // Host hooks for the Android shell (MainActivity) and tests.
  window.__pause = () => pause();
  /** Back button: close sheet -> pause -> leave run/results -> home tab -> exit. */
  window.__onBack = () => {
    if (ui.sheet) {
      ui.closeSheet();
      refresh();
      return 'closed';
    }
    switch (G.mode) {
      case 'playing':
        pause();
        return 'paused';
      case 'paused':
        quitRun();
        return 'home';
      case 'revive':
        act('rv-skip', undefined, document.body);
        return 'results';
      case 'over':
        goHome();
        return 'home';
      case 'dying':
        return 'busy';
      default:
        if (ui.tab !== 'home') {
          setTab('home');
          return 'home';
        }
        return 'exit';
    }
  };
  window.__voltState = () => ({
    mode: G.mode, lane: P.lane, d: G.d, score: Math.floor(G.score), cells: G.cells, gems: G.gems, stage: G.stage,
    hyper: isHyper(), tab: ui.tab, sheet: ui.sheet, tut: G.tut,
    ahead: entities.obstacles.map((o) => ({ k: o.kind, a: Math.round(o.s - G.d) })),
  });
  window.__voltSave = () => JSON.parse(JSON.stringify(S()));

  applySettings();
  world.setTheme(0, true);
  world.reset(0);
  audio.song(0, 'menu');
  if (save.migrated) ui.toast({ ic: 'check', color: '#3ddc84', title: 'Welcome to Volt Dash 2.0!', sub: 'Your best score and Cells came with you' });
  ui.show('menu');
  setTab('home');
  requestAnimationFrame(frame);
}

boot();

// Assert-based self-check for the pure game rules:
//  - pattern generator, per stage: every row has a passable lane at the moment the hero
//    reaches it (sliders counted in their final lane, lasers in their state at that moment),
//    rows are spaced for the stage speed cap, pickups never sit inside an obstacle,
//    each stage introduces its obstacle and earlier stages never contain later ones;
//  - moving-obstacle timing: lasers hold one state through the whole pass, sliders finish
//    drifting with time to react, rollers meet the hero exactly at their row, gaps are jumpable;
//  - economy: costs/durations escalate, save validation and v1 -> v3 / v2 -> v3 migration;
//  - v3: daily-word letter tokens never sit inside obstacles, Clank's chase state machine
//    (stumble -> close -> caught, timeout fall-back), combo math, outfits, word, achievements.
import assert from 'node:assert/strict';
import * as T from '../src/track.js';
import * as C from '../src/catalog.js';
import * as M from '../src/meta.js';
import { SAVE_KEY, V2_KEY, defaults, migrateV1, openSave, sanitize } from '../src/save.js';
import { CHASE, createChase } from '../src/chase.js';

const SEEDS = 300;
const R = 0.35; // pickup radius used for overlap checks
const STAGES = 8;
const LATE = ['roller', 'slider', 'laser', 'gap'];
const INTRO = { roller: 2, slider: 3, laser: 4, gap: 5 };
const seen = Array.from({ length: STAGES + 1 }, () => new Set());
let rows = 0;
let walls = 0;
let maxBlocked = 0;
let laserChecks = 0;
let letters = 0;
let lastLetter = -Infinity;
let minLetterGap = Infinity;

for (let seed = 1; seed <= SEEDS; seed++) {
  const gen = T.createGenerator(seed);
  let s = T.START_S;
  let prevEnd = -Infinity;
  let i = 0;
  while (s < T.STAGE_LEN * STAGES) {
    const row = gen.next(s);
    rows++;
    const where = `seed ${seed} row ${i} (stage ${row.stage}, s=${row.s.toFixed(1)})`;
    assert.equal(row.stage, T.stageAt(row.s), `${where}: stage mismatch`);
    for (const o of row.obstacles) {
      seen[row.stage].add(o.kind);
      if (o.kind in INTRO) assert.ok(row.stage >= INTRO[o.kind], `${where}: ${o.kind} before stage ${INTRO[o.kind]}`);
    }

    // Passability at the meet moment.
    const passable = T.passableLanes(row.obstacles);
    assert.ok(passable.length >= 1, `${where}: no passable lane`);
    assert.ok(passable.includes(row.safeLane), `${where}: safe lane ${row.safeLane} is blocked`);
    maxBlocked = Math.max(maxBlocked, 3 - passable.length);
    if (row.obstacles.length === 3 && row.obstacles.every((o) => o.kind === row.obstacles[0].kind)) walls++;

    // Spacing and geometry.
    assert.ok(row.s >= prevEnd, `${where}: overlaps previous row`);
    const gapTime = (row.nextS - row.end) / T.stageCap(row.stage);
    assert.ok(gapTime >= T.MIN_GAP_TIME, `${where}: gap ${gapTime.toFixed(3)}s < ${T.MIN_GAP_TIME}s`);
    const meetLanes = new Map();
    for (const o of row.obstacles) {
      assert.ok(o.s >= row.s && o.s + o.len <= row.end + 1e-9, `${where}: obstacle outside row`);
      const ml = T.meetLane(o);
      assert.ok(!meetLanes.has(ml), `${where}: two obstacles in lane ${ml} at meet`);
      meetLanes.set(ml, o);

      if (o.kind === 'slider') {
        assert.ok(Math.abs(o.to - o.lane) === 1, `${where}: slider must move exactly one lane`);
        assert.notEqual(o.to, row.safeLane, `${where}: slider drifts into the safe lane`);
        assert.ok(!row.obstacles.some((p) => p !== o && p.lane === o.to), `${where}: slider target lane occupied`);
        // Still in its start lane while the warning shows, fully across before the hero gets close.
        assert.equal(T.sliderX(o, o.s - T.DRIFT_START - 1), T.laneX(o.lane));
        assert.equal(T.sliderX(o, o.s - T.DRIFT_END), T.laneX(o.to));
        for (let d = o.s - T.DRIFT_END; d <= o.s + o.len; d += 0.5) assert.equal(T.sliderX(o, d), T.laneX(o.to), `${where}: slider moving near hero`);
      }
      if (o.kind === 'laser') {
        // One state for the whole time the hero's body overlaps the beam (plus margin).
        const on = T.laserOn(o, o.s);
        for (let d = o.s - T.HALF_D - 0.6; d <= o.s + o.len + T.HALF_D + 0.6; d += 0.05) {
          assert.equal(T.laserOn(o, d), on, `${where}: laser toggles mid-pass`);
          laserChecks++;
        }
        // And it visibly toggles on the approach.
        const states = new Set();
        for (let d = o.s - 80; d < o.s - 5; d += 2) states.add(T.laserOn(o, d));
        assert.equal(states.size, 2, `${where}: laser never toggles on approach`);
      }
      if (o.kind === 'roller') {
        assert.ok(Math.abs(T.rollerS(o, o.s) - o.s) < 1e-9, `${where}: roller does not meet at its row`);
        assert.ok(T.rollerS(o, o.s - 50) > o.s, `${where}: roller should start ahead of its row`);
      }
    }

    // Pickups never inside anything at meet time (sliders: both lanes; lasers/rollers: whole lane interval).
    if (row.letter) {
      letters++;
      minLetterGap = Math.min(minLetterGap, row.letter.s - lastLetter);
      lastLetter = row.letter.s;
      // A letter owns its lane in its row: no obstacle, no Spark line, no gem or power-up there.
      assert.ok(!row.obstacles.some((o) => o.lane === row.letter.lane || T.meetLane(o) === row.letter.lane), `${where}: letter shares a lane with an obstacle`);
      assert.ok(!row.cells.some((c) => c.lane === row.letter.lane), `${where}: letter on a Spark line`);
      assert.ok(row.gem?.lane !== row.letter.lane && row.power?.lane !== row.letter.lane, `${where}: letter on another pickup`);
    }
    const pickups = [...row.cells, ...(row.power ? [row.power] : []), ...(row.gem ? [row.gem] : []), ...(row.letter ? [row.letter] : [])];
    for (const c of pickups) {
      for (const o of row.obstacles) {
        const lanes = o.kind === 'slider' ? [o.lane, o.to] : [o.lane];
        if (!lanes.includes(c.lane) || c.s + R < o.s || c.s - R > o.s + o.len) continue;
        if (o.kind === 'barrier') assert.ok(c.y - R > T.BARRIER_H, `${where}: pickup inside barrier`);
        else if (o.kind === 'gate') assert.ok(c.y + R < T.GATE_BOTTOM, `${where}: pickup inside gate`);
        else if (o.kind === 'pod') {
          const top = Math.max(T.podSurface(o, c.s - R), T.podSurface(o, c.s), T.podSurface(o, c.s + R));
          assert.ok(c.y - R > top, `${where}: pickup inside pod`);
        } else if (o.kind === 'gap') assert.ok(c.y - R > 0.3, `${where}: pickup in a gap`);
        else assert.fail(`${where}: pickup inside ${o.kind}`);
      }
    }
    prevEnd = row.end;
    if (i === 0) lastLetter = -Infinity;
    s = row.nextS;
    i++;
  }
}

for (const k of LATE) {
  assert.ok(seen[INTRO[k]].has(k), `${k} never appears in its intro stage ${INTRO[k]}`);
  for (let st = INTRO[k]; st <= STAGES; st++) assert.ok(seen[st].has(k), `${k} missing from stage ${st}`);
}

// Gaps: a jump started anywhere in a reasonable window clears GAP_LEN plus the hero's depth, at the slowest speed.
const air = (2 * Math.sqrt(2 * T.GRAVITY * T.JUMP_H)) / T.GRAVITY;
const window = T.SPEED_MIN * air - (T.GAP_LEN + 2 * T.HALF_D);
assert.ok(window >= 2.5, `gap jump window only ${window.toFixed(2)} m at ${T.SPEED_MIN} u/s`);
// Sliders: drift finishes with time for a lane change plus reaction even at top speed.
assert.ok(T.DRIFT_END / T.SPEED_MAX >= T.LANE_TIME + 0.3, 'slider drift ends too late at SPEED_MAX');
assert.ok(T.TELEGRAPH - T.DRIFT_START >= 30, 'slider telegraph too short');
// Rollers: never move far enough per physics substep (1/120 s) to tunnel through the hero.
assert.ok(((1 + T.ROLLER_RATIO) * T.SPEED_MAX) / 120 < T.ROLLER_LEN + 2 * T.HALF_D, 'roller can tunnel');

// Pod surface: ramp rises linearly to the top, top is flat, nothing past the end.
const ramp = { kind: 'pod', lane: 0, s: 0, len: T.RAMP_LEN + T.POD_LEN, ramp: true };
assert.equal(T.podSurface(ramp, 0), 0);
assert.equal(T.podSurface(ramp, T.RAMP_LEN / 2), T.POD_H / 2);
assert.equal(T.podSurface(ramp, T.RAMP_LEN), T.POD_H);
assert.equal(T.podSurface(ramp, T.RAMP_LEN + T.POD_LEN + 0.01), -Infinity);
assert.equal(T.podSurface({ kind: 'pod', lane: 0, s: 10, len: T.POD_LEN, ramp: false }, 9.99), -Infinity);

// Speed: caps rise per stage, never exceed SPEED_MAX, two lane changes fit the min gap.
for (let st = 2; st <= 20; st++) assert.ok(T.stageCap(st) >= T.stageCap(st - 1) && T.stageCap(st) <= T.SPEED_MAX);
assert.equal(T.accelerate(T.SPEED_MIN, 1, 1), T.SPEED_MIN + T.ACCEL);
assert.equal(T.accelerate(T.stageCap(1), 1, 1), T.stageCap(1));
assert.ok(T.MIN_GAP_TIME >= 2 * T.LANE_TIME + 0.3, 'gap too short for two lane changes');
let t = 0;
for (let v = T.SPEED_MIN, d = 0; d < T.STAGE_LEN; t += 0.1) {
  v = T.accelerate(v, 0.1, 1);
  d += v * 0.1;
}
assert.ok(t > 35 && t < 70, `stage 2 reached after ${t.toFixed(0)} s of clean running (want ~1 min)`);

// Economy tables escalate.
for (const k in C.UPGRADES) {
  const dur = C.UPGRADES[k].dur;
  assert.equal(dur.length, C.MAX_UPGRADE);
  for (let i = 1; i < dur.length; i++) assert.ok(dur[i] > dur[i - 1], `${k} duration must grow`);
}
for (let l = 2; l < C.MAX_UPGRADE; l++) assert.ok(C.upgradeCost(l) > C.upgradeCost(l - 1));
assert.equal(C.upgradeCost(C.MAX_UPGRADE), null);
assert.equal(C.charUpgradeCost(C.MAX_CHAR_LEVEL), null);
assert.equal(new Set(C.CHARACTERS.map((c) => c.id)).size, C.CHARACTERS.length);
assert.ok(C.CHARACTERS.length >= 6);
assert.deepEqual(C.addXp(1, 0, C.xpForLevel(1) + 5), { level: 2, xp: 5, ups: 1 });
assert.equal(C.scoreMultiplier(99, 1, false), C.MAX_TIER);
for (let tier = 1; tier <= 30; tier++) {
  const set = C.missionSet(tier);
  assert.equal(new Set(set.map((m) => m.type)).size, 3);
  assert.deepEqual(set, C.missionSet(tier), 'mission sets must be deterministic');
  for (const m of set) assert.ok(m.target > 0 && Number.isFinite(m.target));
}
for (let i = 0; i < 1000; i++) assert.ok(C.rollMystery(i / 1000));
assert.deepEqual(C.dailyStatus({ last: '', streak: 0 }, '2026-01-01'), { claimable: true, slot: 0 });
assert.deepEqual(C.dailyStatus({ last: '2026-01-01', streak: 1 }, '2026-01-01'), { claimable: false, slot: 0 });
assert.deepEqual(C.dailyStatus({ last: '2026-01-31', streak: 3 }, '2026-02-01'), { claimable: true, slot: 3 });
assert.deepEqual(C.dailyStatus({ last: '2026-01-01', streak: 7 }, '2026-01-02'), { claimable: true, slot: 0 });
assert.deepEqual(C.dailyStatus({ last: '2026-01-01', streak: 5 }, '2026-01-04'), { claimable: true, slot: 0 });

// Save: garbage sanitizes to defaults; v1 keys migrate once; corrupt JSON doesn't throw.
const junk = sanitize({ best: -5, cells: 'x', gems: 1e99, upgrades: { magnet: 99 }, chars: { bit: 3, nope: 2 }, selected: 'nope', daily: { last: 'bad' } });
assert.equal(junk.best, 0);
assert.equal(junk.cells, 0);
assert.equal(junk.upgrades.magnet, C.MAX_UPGRADE);
assert.deepEqual(junk.chars, { mina: 3, rio: 1 }, 'v2 robot ids map to couriers, unknown ids drop');
assert.equal(junk.selected, 'rio');
assert.equal(junk.daily.last, '');
const mem = (init) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};
const v1 = mem({ 'voltdash.best': '1234', 'voltdash.cells': '567', 'voltdash.muted': 'true' });
const opened = openSave(v1);
assert.ok(opened.migrated);
assert.equal(opened.data.best, 1234);
assert.equal(opened.data.cells, 567);
assert.equal(opened.data.settings.sound, false);
assert.equal(opened.migrated, 'v1');
assert.ok(v1.m.has(SAVE_KEY), 'migration must persist the v3 save');
assert.equal(openSave(v1).migrated, '', 'migration runs only once');
assert.equal(migrateV1(() => null), null);
assert.equal(openSave(mem({ [SAVE_KEY]: '{not json' })).data.best, 0);
assert.equal(openSave(null).data.level, 1);

// Meta actions: purchases charge exactly once, refuse when broke, missions tier up after 3 claims.
{
  const S = defaults();
  assert.deepEqual(M.buyUpgrade(S, 'magnet'), { ok: false, reason: 'funds' });
  S.cells = 10000;
  assert.ok(M.buyUpgrade(S, 'magnet').ok);
  assert.equal(S.cells, 10000 - C.upgradeCost(1));
  assert.equal(S.upgrades.magnet, 2);
  assert.equal(M.unlockChar(S, 'noor').reason, 'level');
  assert.ok(M.unlockChar(S, 'mina').ok && S.selected === 'mina');
  assert.ok(M.upgradeChar(S, 'mina').ok && S.chars.mina === 2);
  assert.ok(M.powerDuration(S, 'magnet') > C.UPGRADES.magnet.dur[1], 'Mina perk stretches magnet');
  assert.equal(M.powerDuration(S, 'shield'), C.UPGRADES.shield.dur[0], 'perk only stretches its own power');
  S.gems = 3;
  assert.ok(M.buyItem(S, 'revive').ok && S.gems === 0 && S.items.revive === 1);
  S.items.mystery = 1;
  assert.ok(M.openMystery(S, 0.5).ok && S.items.mystery === 0);
  const tier = S.missions.tier;
  S.missions.progress = [1e9, 1e9, 1e9];
  for (let i = 0; i < 3; i++) assert.ok(M.claimMission(S, i).ok);
  assert.equal(S.missions.tier, tier + 1, 'three claims bump the tier');
  assert.equal(M.claimMission(S, 0).ok, false);
  const run = M.applyRun(S, { score: 5000, meters: 900, cells: 120, gems: 1, stats: { jumps: 5 } });
  assert.ok(run.isBest && S.best === 5000 && run.xp === C.runXp(900, 120));
  assert.ok(M.claimDaily(S, '2026-03-01').ok && !M.claimDaily(S, '2026-03-01').ok);
}

// ---------- v3: letters ----------
assert.ok(letters > SEEDS * 4, `too few letter slots (${letters})`);
assert.ok(minLetterGap >= T.LETTER_EVERY, `letter slots only ${minLetterGap.toFixed(0)} m apart`);

// ---------- v3: save migration v2 -> v3 (robot ids map to couriers, everything carries) ----------
{
  const v2save = {
    v: 2, best: 8250, cells: 24000, gems: 80, level: 7, xp: 420, tutorialDone: true, runs: 12,
    settings: { sound: false, music: true, vibe: false, quality: 'low' },
    items: { headstart: 2, revive: 1, booster: 1, mystery: 1 },
    upgrades: { magnet: 1, spring: 3, shield: 2, x2: 1, hyper: 2 },
    chars: { volt: 2, moss: 1, orbit: 5 }, selected: 'orbit',
    loadout: { headstart: false, revive: true, booster: false },
    missions: { tier: 3, progress: [999, 40, 2], claimed: [true, false, false] },
    daily: { last: '2026-11-20', streak: 4 },
  };
  const store = mem({ [V2_KEY]: JSON.stringify(v2save), 'voltdash.best': '5' });
  const o = openSave(store);
  assert.equal(o.migrated, 'v2', 'v2 save wins over stale v1 keys');
  const d = o.data;
  assert.equal(d.v, 3);
  for (const k of ['best', 'cells', 'gems', 'level', 'xp', 'tutorialDone']) assert.equal(d[k], v2save[k], `v2 ${k} carries over`);
  assert.deepEqual(d.upgrades, v2save.upgrades);
  assert.deepEqual(d.items, { ...v2save.items, scooter: 0 });
  assert.deepEqual(d.chars, { rio: 2, tomas: 1, oskar: 5 }, 'owned/upgraded characters map to couriers');
  assert.equal(d.selected, 'oskar');
  assert.deepEqual(d.missions, v2save.missions);
  assert.deepEqual(d.daily, v2save.daily);
  assert.deepEqual(d.settings, v2save.settings);
  assert.equal(d.loadout.headstart, false);
  assert.equal(d.stats.runs, 12, 'run counter seeds lifetime stats');
  assert.deepEqual(d.outfits.rio, { own: [0], sel: 0 });
  assert.ok(store.m.has(SAVE_KEY) && store.m.has(V2_KEY), 'v3 written, v2 kept for older APKs');
  assert.equal(openSave(store).migrated, '', 'v2 migration runs once');
  assert.deepEqual(openSave(store).data, d, 'migrated save round-trips');
  // v1 straight to v3
  const v1only = openSave(mem({ 'voltdash.best': '900', 'voltdash.cells': '50' }));
  assert.equal(v1only.migrated, 'v1');
  assert.equal(v1only.data.v, 3);
  assert.equal(v1only.data.best, 900);
  assert.equal(v1only.data.cells, 50);
  assert.deepEqual(v1only.data.chars, { rio: 1 });
  // corrupt v3 does not fall back to deleting progress silently: it starts fresh but keeps v2 untouched
  const bad = mem({ [SAVE_KEY]: '{oops', [V2_KEY]: JSON.stringify(v2save) });
  assert.equal(openSave(bad).data.best, 0);
  assert.ok(bad.m.get(V2_KEY).includes('8250'));
  // hostile values validate
  const h = sanitize({ outfits: { rio: { own: [2, 2, 9, -1, 'x'], sel: 9 } }, word: { day: 'nope', got: [1, true] }, ach: ['first', 'fake', 'first'], stats: { jumps: -4, meters: 'x' } });
  assert.deepEqual(h.outfits.rio, { own: [0, 2], sel: 0 });
  assert.deepEqual(h.word, { day: '', got: [false, true, false, false, false], claimed: false });
  assert.deepEqual(h.ach, ['first']);
  assert.equal(h.stats.jumps, 0);
}

// ---------- v3: Clank's chase state machine ----------
{
  const run = (c, secs) => {
    let ev = null;
    for (let t = 0; t < secs; t += 1 / 60) ev = c.update(1 / 60) || ev;
    return ev;
  };
  const c = createChase();
  assert.equal(c.mode, 'away');
  c.start();
  assert.equal(c.mode, 'intro');
  assert.ok(c.gap <= CHASE.NEAR, 'visible right behind at the start');
  run(c, CHASE.INTRO_TIME + 0.05);
  assert.equal(c.mode, 'away', 'drops back after the intro');
  run(c, 8);
  assert.equal(c.gap, CHASE.FAR, 'fully off-screen once away');
  assert.equal(c.danger(), 0);
  // stumble -> close (warning), closes the gap fast
  assert.equal(c.stumble(), 'close');
  run(c, 1.2);
  assert.equal(c.gap, CHASE.NEAR, 'closes in within ~1 s');
  assert.ok(c.danger() > 0.99);
  // timeout: ~6 s without stumbles -> falls back, reported once as an escape
  assert.equal(run(c, CHASE.CLOSE_TIME - 1.2 - 0.1), null, 'no escape before the timeout');
  assert.equal(c.mode, 'close');
  assert.equal(run(c, 0.2), 'escaped');
  assert.equal(c.mode, 'away');
  assert.equal(run(c, 1), null, 'escape fires once');
  // stumble -> close -> second stumble while close = caught
  assert.equal(c.stumble(), 'close');
  run(c, 3);
  assert.equal(c.stumble(), 'caught', 'second stumble while close catches you');
  run(c, 1);
  assert.equal(c.gap, CHASE.LUNGE, 'lunges onto the runner');
  // revive / shield save releases; a stumble during the intro counts as the first one
  c.release();
  assert.equal(c.mode, 'away');
  c.start();
  assert.equal(c.stumble(), 'close');
  assert.equal(c.stumble(), 'caught');
  c.hide();
  assert.equal(c.gap, CHASE.FAR);
  c.lunge();
  assert.equal(c.mode, 'caught');
}

// ---------- v3: combo math ----------
{
  assert.equal(C.comboMult(0), 1);
  assert.equal(C.comboMult(2), 1);
  assert.equal(C.comboMult(3), 1.25);
  assert.equal(C.comboMult(9), 1.75);
  assert.equal(C.comboMult(24), 3);
  assert.equal(C.comboMult(999), 3, 'combo multiplier caps at x3');
  for (let n = 1; n < 60; n++) assert.ok(C.comboMult(n) >= C.comboMult(n - 1), 'multiplier never drops as the chain grows');
  assert.equal(C.comboWord(3), 'NICE');
  assert.equal(C.comboWord(6), 'GREAT');
  assert.equal(C.comboWord(10), 'INSANE');
  assert.equal(C.comboWord(15), 'INSANE');
  assert.equal(C.comboWord(4), null);
  let k = { n: 0, last: -99 };
  k = C.comboAdd(k, 1);
  assert.equal(k.n, 1);
  k = C.comboAdd(k, 1 + C.COMBO_WINDOW); // exactly on the window edge still chains
  assert.equal(k.n, 2);
  assert.equal(C.comboLive(k, k.last + C.COMBO_WINDOW + 0.01), 0, 'chain expires after the window');
  k = C.comboAdd(k, k.last + C.COMBO_WINDOW + 0.5);
  assert.equal(k.n, 1, 'a late trick starts a new chain');
}

// ---------- v3: outfits, daily word, achievements ----------
{
  const S = defaults();
  assert.equal(M.wearOutfit(S, 'rio', 1).reason, 'funds');
  S.gems = C.OUTFIT_PRICE[1];
  assert.ok(M.wearOutfit(S, 'rio', 1).bought && S.gems === 0 && S.outfits.rio.sel === 1);
  assert.ok(M.wearOutfit(S, 'rio', 0).ok && !M.wearOutfit(S, 'rio', 1).bought, 'owned outfits are free to re-wear');
  assert.equal(M.wearOutfit(S, 'esme', 1).reason, 'locked', 'locked couriers cannot buy outfits');
  for (const ch of C.CHARACTERS) assert.equal(ch.outfits.length, C.OUTFIT_PRICE.length);
  assert.deepEqual(new Set(Object.values(C.CHAR_MAP)), new Set(C.CHARACTERS.map((c) => c.id)), 'every v2 id maps to a distinct courier');

  for (const w of C.WORDS) assert.match(w, /^[A-Z]{5}$/);
  assert.equal(C.wordOfDay('2026-11-28'), C.wordOfDay('2026-11-28'));
  assert.ok(new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map(C.wordOfDay)).size >= 3, 'the word changes from day to day');
  const day = '2026-11-28';
  assert.equal(M.claimWord(S, day).ok, false);
  for (let i = 0; i < 5; i++) assert.equal(M.collectLetter(S, day), i, 'letters fill in order');
  assert.equal(M.collectLetter(S, day), -1);
  const gems = S.gems;
  assert.ok(M.claimWord(S, day).ok && S.gems >= gems + C.WORD_GEMS && S.stats.words === 1);
  assert.equal(M.claimWord(S, day).ok, false, 'one reward per day');
  assert.equal(M.wordStatus(S, '2026-11-29').got.filter(Boolean).length, 0, 'a new day starts a new word');

  const run = M.applyRun(S, { score: 10, meters: 2100, cells: 30, gems: 0, stats: { jumps: 3, rolls: 2, bestCombo: 11, caught: 1, scooter: 1, stage: 5 } });
  const ids = run.unlocked.map((a) => a.id);
  for (const id of ['first', 'crosstown', 'onfire', 'swept', 'skyway']) assert.ok(ids.includes(id), `${id} unlocks`);
  assert.ok(!ids.includes('untouch'));
  assert.equal(M.checkAchievements(S).length, 0, 'achievements pay out once');
  assert.ok(C.ACHIEVEMENTS.length >= 10 && C.ACHIEVEMENTS.length <= 15);
  assert.equal(new Set(C.ACHIEVEMENTS.map((a) => a.id)).size, C.ACHIEVEMENTS.length);
}

console.log(
  `selfcheck ok: ${rows} rows over ${SEEDS} seeds x ${STAGES} stages; every row passable at meet ` +
    `(max ${maxBlocked} blocked lanes, ${walls} full-width walls); ${laserChecks} laser timing samples; ` +
    `stage 2 after ${t.toFixed(0)} s; gap jump window ${window.toFixed(1)} m; economy + save/migration checks passed; ` +
    `${letters} letter slots (none inside obstacles); chase, combo, word, outfit and achievement checks passed`,
);

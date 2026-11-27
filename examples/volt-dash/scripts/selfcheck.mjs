// Assert-based self-check for the pure game rules:
//  - pattern generator, per stage: every row has a passable lane at the moment the hero
//    reaches it (sliders counted in their final lane, lasers in their state at that moment),
//    rows are spaced for the stage speed cap, pickups never sit inside an obstacle,
//    each stage introduces its obstacle and earlier stages never contain later ones;
//  - moving-obstacle timing: lasers hold one state through the whole pass, sliders finish
//    drifting with time to react, rollers meet the hero exactly at their row, gaps are jumpable;
//  - economy: costs/durations escalate, save validation and v1 -> v2 migration.
import assert from 'node:assert/strict';
import * as T from '../src/track.js';
import * as C from '../src/catalog.js';
import * as M from '../src/meta.js';
import { SAVE_KEY, defaults, migrateV1, openSave, sanitize } from '../src/save.js';

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
    const pickups = [...row.cells, ...(row.power ? [row.power] : []), ...(row.gem ? [row.gem] : [])];
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
assert.deepEqual(junk.chars, { bit: 3, volt: 1 });
assert.equal(junk.selected, 'volt');
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
assert.ok(v1.m.has(SAVE_KEY), 'migration must persist the v2 save');
assert.equal(openSave(v1).migrated, false, 'migration runs only once');
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
  assert.equal(M.unlockChar(S, 'nimbus').reason, 'level');
  assert.ok(M.unlockChar(S, 'bit').ok && S.selected === 'bit');
  assert.ok(M.upgradeChar(S, 'bit').ok && S.chars.bit === 2);
  assert.ok(M.powerDuration(S, 'magnet') > C.UPGRADES.magnet.dur[1], 'Bit perk stretches magnet');
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

console.log(
  `selfcheck ok: ${rows} rows over ${SEEDS} seeds x ${STAGES} stages; every row passable at meet ` +
    `(max ${maxBlocked} blocked lanes, ${walls} full-width walls); ${laserChecks} laser timing samples; ` +
    `stage 2 after ${t.toFixed(0)} s; gap jump window ${window.toFixed(1)} m; economy + save/migration checks passed`,
);

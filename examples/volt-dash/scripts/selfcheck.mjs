// Assert-based self-check for the pattern generator: every row leaves a passable
// lane, rows are spaced so they are reachable at top speed, and pickups never sit
// inside an obstacle.
import assert from 'node:assert/strict';
import * as T from '../src/track.js';

const SEEDS = 500;
const ROWS = 300;
const R = 0.35; // pickup radius used for overlap checks
let rows = 0;
let walls = 0;
let maxBlocked = 0;

for (let seed = 1; seed <= SEEDS; seed++) {
  const gen = T.createGenerator(seed);
  let s = T.START_S;
  let prevEnd = -Infinity;
  for (let i = 0; i < ROWS; i++) {
    const diff = Math.min(1, i / 150);
    const row = gen.next(s, diff);
    rows++;
    const where = `seed ${seed} row ${i}`;

    const byLane = [0, 1, 2].map((l) => row.obstacles.filter((o) => o.lane === l));
    const passable = [0, 1, 2].filter((l) => T.isPassable(byLane[l]));
    assert.ok(passable.length >= 1, `${where}: no passable lane`);
    assert.ok(passable.includes(row.safeLane), `${where}: safe lane ${row.safeLane} is blocked`);
    maxBlocked = Math.max(maxBlocked, 3 - passable.length);
    if (row.obstacles.length === 3 && row.obstacles.every((o) => o.kind === row.obstacles[0].kind)) walls++;

    assert.ok(row.s >= prevEnd, `${where}: overlaps previous row`);
    for (const o of row.obstacles) {
      assert.ok(o.s >= row.s && o.s + o.len <= row.end + 1e-9, `${where}: obstacle outside row`);
    }
    const gapTime = (row.nextS - row.end) / T.SPEED_MAX;
    assert.ok(gapTime >= T.MIN_GAP_TIME, `${where}: gap ${gapTime.toFixed(3)}s < ${T.MIN_GAP_TIME}s`);

    const pickups = [...row.cells, ...(row.power ? [row.power] : [])];
    for (const c of pickups) {
      for (const o of byLane[c.lane]) {
        if (c.s + R < o.s || c.s - R > o.s + o.len) continue;
        if (o.kind === 'barrier') assert.ok(c.y - R > T.BARRIER_H, `${where}: pickup inside barrier`);
        else if (o.kind === 'gate') assert.ok(c.y + R < T.GATE_BOTTOM, `${where}: pickup inside gate`);
        else {
          const top = Math.max(T.podSurface(o, c.s - R), T.podSurface(o, c.s), T.podSurface(o, c.s + R));
          assert.ok(c.y - R > top, `${where}: pickup inside pod`);
        }
      }
    }
    prevEnd = row.end;
    s = row.nextS;
  }
}

// Pod surface: ramp rises linearly to the top, top is flat, nothing past the end.
const ramp = { kind: 'pod', lane: 0, s: 0, len: T.RAMP_LEN + T.POD_LEN, ramp: true };
assert.equal(T.podSurface(ramp, 0), 0);
assert.equal(T.podSurface(ramp, T.RAMP_LEN / 2), T.POD_H / 2);
assert.equal(T.podSurface(ramp, T.RAMP_LEN), T.POD_H);
assert.equal(T.podSurface(ramp, T.RAMP_LEN + T.POD_LEN), T.POD_H);
assert.equal(T.podSurface(ramp, T.RAMP_LEN + T.POD_LEN + 0.01), -Infinity);
assert.equal(T.podSurface(ramp, -0.01), -Infinity);
const plain = { kind: 'pod', lane: 0, s: 10, len: T.POD_LEN, ramp: false };
assert.equal(T.podSurface(plain, 9.99), -Infinity);
assert.equal(T.podSurface(plain, 10), T.POD_H);

// Two lane changes plus a reaction must fit in the minimum gap.
assert.ok(T.MIN_GAP_TIME >= 2 * T.LANE_TIME + 0.3, 'gap too short for two lane changes');
assert.equal(T.speedAt(0), T.SPEED_MIN);
assert.equal(T.speedAt(T.RAMP_SECONDS * 2), T.SPEED_MAX);

console.log(
  `selfcheck ok: ${rows} rows over ${SEEDS} seeds, every row has a passable lane ` +
    `(max ${maxBlocked} blocked lanes, ${walls} full-width jump/roll walls), min gap >= ${T.MIN_GAP_TIME}s at ${T.SPEED_MAX} u/s`,
);

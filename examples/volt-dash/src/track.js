// Pure track rules for Volt Dash: lane geometry, the difficulty curve, the seeded
// row generator and pod surface heights. No DOM or three.js here, so node can
// self-check it (scripts/selfcheck.mjs).

export const LANES = 3;
export const LANE_W = 2.2;
export const LANE_TIME = 0.12; // seconds for one lane-change tween
export const POD_H = 2.5;
export const POD_LEN = 8;
export const RAMP_LEN = 6;
export const BARRIER_H = 0.8;
export const BARRIER_D = 0.4;
export const GATE_BOTTOM = 1.15; // underside of the overhead gate bar
export const GATE_D = 0.4;
export const CELL_Y = 0.75;
export const SPEED_MIN = 14;
export const SPEED_MAX = 34;
export const RAMP_SECONDS = 180; // time to reach SPEED_MAX
export const START_S = 55; // track position of the first row
export const MIN_GAP_TIME = 0.6; // guaranteed seconds between rows, even at SPEED_MAX
export const POWER_TIME = 10;
export const POWER_KINDS = ['magnet', 'spring', 'shield', 'x2'];

/**
 * @typedef {'barrier'|'gate'|'pod'} ObstacleKind
 * @typedef {{kind: ObstacleKind, lane: number, s: number, len: number, ramp: boolean}} Obstacle
 *   s/len are the track interval it occupies; for a ramped pod that includes the ramp.
 * @typedef {{lane: number, s: number, y: number}} CellSpec
 * @typedef {'magnet'|'spring'|'shield'|'x2'} PowerKind
 * @typedef {{kind: PowerKind, lane: number, s: number, y: number}} PowerSpec
 * @typedef {'none'|'barrier'|'gate'|'pod'|'podRamp'} Slot
 * @typedef {{s: number, end: number, nextS: number, safeLane: number, slots: Slot[],
 *   obstacles: Obstacle[], cells: CellSpec[], power: PowerSpec|null}} Row
 */

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const laneX = (lane) => (lane - 1) * LANE_W;
export const speedAt = (t) => SPEED_MIN + (SPEED_MAX - SPEED_MIN) * clamp01(t / RAMP_SECONDS);
export const difficultyAt = (speed) => clamp01((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN));

/** Small deterministic PRNG so a seed reproduces a whole run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Track position where a pod's solid body starts (after its ramp, if any). */
export const podFront = (ob) => (ob.ramp ? ob.s + RAMP_LEN : ob.s);

/** Height of a pod's ramp/top at track position p, or -Infinity if p is not over it. */
export function podSurface(ob, p) {
  if (ob.kind !== 'pod') return -Infinity;
  const front = podFront(ob);
  if (p >= front && p <= ob.s + ob.len) return POD_H;
  if (ob.ramp && p >= ob.s && p < front) return (POD_H * (p - ob.s)) / RAMP_LEN;
  return -Infinity;
}

/** A lane is passable unless it holds a pod with no ramp (jump/roll/run-up all work). */
export const isPassable = (laneObstacles) => !laneObstacles.some((o) => o.kind === 'pod' && !o.ramp);

function weighted(rnd, table) {
  let total = 0;
  for (const k in table) total += table[k];
  let r = rnd() * total;
  for (const k in table) {
    r -= table[k];
    if (r < 0) return k;
  }
  return Object.keys(table)[0];
}

/** @param {number} seed */
export function createGenerator(seed) {
  const rnd = mulberry32(seed);
  let index = 0;
  let powerIn = 240; // track distance until a power-up may appear

  /** @returns {Slot} */
  function slotFor(diff, safe) {
    if (safe) return rnd() < 0.6 - 0.3 * diff ? 'none' : weighted(rnd, { barrier: 3, gate: 3, podRamp: 2 });
    return rnd() < 0.5 - 0.3 * diff ? 'none' : weighted(rnd, { pod: 4, barrier: 2, gate: 2, podRamp: 1 });
  }

  return {
    /**
     * Build the row starting at track position s.
     * @param {number} s
     * @param {number} difficulty 0..1
     * @returns {Row}
     */
    next(s, difficulty) {
      const diff = clamp01(difficulty);
      // The safe lane is chosen first and only ever gets a passable slot.
      const safeLane = Math.floor(rnd() * LANES);
      /** @type {Slot[]} */
      let slots;
      if (index > 1 && rnd() < 0.04 + 0.06 * diff) {
        const k = rnd() < 0.5 ? 'barrier' : 'gate'; // full-width wall: everyone jumps or rolls
        slots = [k, k, k];
      } else {
        slots = [0, 1, 2].map((l) => slotFor(diff, l === safeLane));
        if (index < 2) {
          // Warm-up rows: at most one obstacle, never in the safe lane.
          let kept = false;
          slots = slots.map((k, l) => {
            if (l === safeLane || k === 'none' || kept) return 'none';
            kept = true;
            return k === 'pod' ? 'podRamp' : k;
          });
        }
      }

      const front = s + RAMP_LEN; // every body/bar front in a row lines up here
      /** @type {Obstacle[]} */
      const obstacles = [];
      slots.forEach((k, lane) => {
        if (k === 'barrier') obstacles.push({ kind: 'barrier', lane, s: front, len: BARRIER_D, ramp: false });
        else if (k === 'gate') obstacles.push({ kind: 'gate', lane, s: front, len: GATE_D, ramp: false });
        else if (k === 'pod') obstacles.push({ kind: 'pod', lane, s: front, len: POD_LEN, ramp: false });
        else if (k === 'podRamp') obstacles.push({ kind: 'pod', lane, s, len: RAMP_LEN + POD_LEN, ramp: true });
      });
      const end = Math.max(front + 1, ...obstacles.map((o) => o.s + o.len));

      /** @type {CellSpec[]} */
      const cells = [];
      const cellLanes = new Set();
      const line = (lane, from, to, y) => {
        for (let p = from; p <= to + 1e-6; p += 2.4) cells.push({ lane, s: p, y });
        cellLanes.add(lane);
      };
      if (rnd() < 0.8) {
        const k = slots[safeLane];
        if (k === 'none') line(safeLane, front - 5, front + 7, CELL_Y);
        else if (k === 'gate') line(safeLane, front - 4.8, front + 4.8, 0.55);
        else if (k === 'barrier') {
          for (let i = -2; i <= 2; i++) {
            cells.push({ lane: safeLane, s: front + BARRIER_D / 2 + i * 2.2, y: CELL_Y + 1.35 * (1 - (i / 2) ** 2) });
          }
          cellLanes.add(safeLane);
        } else {
          const ramp = obstacles.find((o) => o.lane === safeLane);
          for (let p = s + 1.2; p <= front + POD_LEN - 0.6; p += 2.4) {
            cells.push({ lane: safeLane, s: p, y: podSurface(ramp, p) + CELL_Y });
          }
          cellLanes.add(safeLane);
        }
      }
      slots.forEach((k, lane) => {
        if (lane === safeLane || cellLanes.has(lane)) return;
        if (k === 'none' && rnd() < 0.25) line(lane, front - 2, front + 8, CELL_Y);
        else if (k === 'pod' && rnd() < 0.2) line(lane, front + 1, front + POD_LEN - 1, POD_H + CELL_Y); // spring-boots bonus
      });

      /** @type {PowerSpec|null} */
      let power = null;
      powerIn -= end - s;
      if (powerIn <= 0) {
        const free = [0, 1, 2].filter((l) => slots[l] === 'none' && !cellLanes.has(l));
        if (free.length) {
          power = {
            kind: /** @type {PowerKind} */ (POWER_KINDS[Math.floor(rnd() * POWER_KINDS.length)]),
            lane: free[Math.floor(rnd() * free.length)],
            s: front + 2,
            y: 1.0,
          };
          powerIn = 380 + rnd() * 320;
        }
      }

      // Gap scales with the speed this difficulty implies; its minimum (at diff 0 or 1)
      // is still >= SPEED_MAX * MIN_GAP_TIME, so rows stay reachable at any real speed.
      const speedD = SPEED_MIN + diff * (SPEED_MAX - SPEED_MIN);
      const gap = speedD * (1.7 - 0.9 * diff) * (0.9 + 0.25 * rnd());
      powerIn -= gap;
      index++;
      return { s, end, nextS: end + gap, safeLane, slots, obstacles, cells, power };
    },
  };
}

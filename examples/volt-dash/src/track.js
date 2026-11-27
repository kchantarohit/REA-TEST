// Pure track rules for Volt Dash: lane geometry, stages and their speed caps, the
// seeded row generator, and the time/distance behaviour of moving obstacles. No DOM
// or three.js here, so node can self-check it (scripts/selfcheck.mjs).

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
export const START_S = 55; // first row, measured from where the run starts
export const MIN_GAP_TIME = 0.6; // guaranteed seconds between rows at the stage speed cap
export const POWER_KINDS = ['magnet', 'spring', 'shield', 'x2', 'hyper'];

// Hero physics shared with main.js so the self-check can prove gaps are jumpable.
export const GRAVITY = 48;
export const JUMP_H = 1.55;
export const HALF_D = 0.35; // hero half depth along the track

// Stages: every STAGE_LEN metres the theme changes, the speed cap rises and a new
// obstacle joins the mix. After the 5th theme it loops with the difficulty still rising.
export const STAGE_LEN = 800;
export const THEMES = 5;
export const STAGE_NAMES = ['Neon City', 'Sunset Canyon', 'Frost Line', 'Storm Foundry', 'Cosmic Skyway'];
export const STAGE_COLORS = ['#45f3ff', '#ff9a3c', '#9fe8ff', '#ff3b30', '#c058ff'];
export const SPEED_MIN = 14;
export const SPEED_MAX = 46;
export const ACCEL = 0.16; // u/s^2 while below the stage cap
export const BREATHER = 45; // empty metres after each stage boundary (banner time)

// Stage 2: boulder that rolls towards the hero and reaches its row exactly when the hero does.
export const ROLLER_LEN = 2.1;
export const ROLLER_H = 2.1;
export const ROLLER_RATIO = 0.35; // extra closing speed as a fraction of the hero's
export const ROLLER_SHOW = 120; // appears this far ahead of its row
// Stage 3: sliding pod that drifts one lane sideways, telegraphed by a flashing arrow.
export const SLIDER_LEN = 4.5;
export const SLIDER_H = 2.3;
export const TELEGRAPH = 75; // arrow starts flashing this far ahead
export const DRIFT_START = 36;
export const DRIFT_END = 24; // fully in its new lane while still this far ahead
// Stage 4: laser gate that toggles on a distance rhythm (steady speed => steady beat).
export const LASER_D = 0.3;
export const LASER_PERIOD = 36;
// Stage 5: missing road segment that has to be jumped.
export const GAP_LEN = 3.2;

/**
 * @typedef {'barrier'|'gate'|'pod'|'roller'|'slider'|'laser'|'gap'} ObstacleKind
 * @typedef {{kind: ObstacleKind, lane: number, s: number, len: number, ramp: boolean, to?: number, phase?: number}} Obstacle
 *   s/len are the track interval it occupies when the hero reaches it (for a ramped pod
 *   that includes the ramp). Sliders start in `lane` and end in `to`; lasers use `phase`.
 * @typedef {{lane: number, s: number, y: number}} CellSpec
 * @typedef {'magnet'|'spring'|'shield'|'x2'|'hyper'} PowerKind
 * @typedef {{kind: PowerKind, lane: number, s: number, y: number}} PowerSpec
 * @typedef {{s: number, end: number, nextS: number, stage: number, safeLane: number, slots: string[],
 *   obstacles: Obstacle[], cells: CellSpec[], power: PowerSpec|null, gem: CellSpec|null}} Row
 */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => t * t * (3 - 2 * t);

export const laneX = (lane) => (lane - 1) * LANE_W;
export const stageAt = (s) => Math.max(1, Math.floor(s / STAGE_LEN) + 1);
export const stageStart = (stage) => (stage - 1) * STAGE_LEN;
export const themeOf = (stage) => (stage - 1) % THEMES;
export const stageName = (stage) => STAGE_NAMES[themeOf(stage)];
export const stageCap = (stage) => (stage <= 5 ? 18 + 4 * stage : Math.min(SPEED_MAX, 38 + 1.5 * (stage - 5)));
export const accelerate = (speed, dt, stage) => Math.min(stageCap(stage), Math.max(SPEED_MIN, speed + ACCEL * dt));
/** Speed to start a run at when it begins in `stage` (debug ?stage=N). */
export const entrySpeed = (stage) => (stage <= 1 ? SPEED_MIN : stageCap(stage - 1));

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

/** Roller front edge when the hero is at d: it closes in faster than the road and meets the hero at its row. */
export const rollerS = (ob, d) => ob.s + ROLLER_RATIO * (ob.s - d);
/** 0 -> still in its start lane, 1 -> fully in `to`. */
export const sliderProgress = (ob, d) => clamp01((DRIFT_START - (ob.s - d)) / (DRIFT_START - DRIFT_END));
export const sliderX = (ob, d) => laneX(ob.lane) + (laneX(ob.to ?? ob.lane) - laneX(ob.lane)) * smooth(sliderProgress(ob, d));
/** Laser state when the hero is at d. phase 0.25 = on when reached, 0.75 = off when reached. */
export function laserOn(ob, d) {
  const u = ((((ob.s - d) / LASER_PERIOD + (ob.phase ?? 0.25)) % 1) + 1) % 1;
  return u < 0.5;
}
/** Lane an obstacle occupies at the moment the hero reaches its row. */
export const meetLane = (ob) => (ob.kind === 'slider' ? ob.to ?? ob.lane : ob.lane);
/** Does this obstacle make its meet lane impassable (no jump/roll/ramp gets past it)? */
export const blocksAtMeet = (ob) =>
  (ob.kind === 'pod' && !ob.ramp) || ob.kind === 'roller' || ob.kind === 'slider' || (ob.kind === 'laser' && laserOn(ob, ob.s));
/** Lanes the hero can get through when it reaches the row. */
export const passableLanes = (obstacles) => [0, 1, 2].filter((l) => !obstacles.some((o) => meetLane(o) === l && blocksAtMeet(o)));

function weighted(rnd, table) {
  let total = 0;
  for (const k in table) total += table[k];
  let r = rnd() * total;
  for (const k in table) {
    if (table[k] <= 0) continue;
    r -= table[k];
    if (r < 0) return k;
  }
  return Object.keys(table).find((k) => table[k] > 0);
}

/** @param {number} seed */
export function createGenerator(seed) {
  const rnd = mulberry32(seed);
  let index = 0;
  let powerIn = 240; // track distance until a power-up may appear
  const reserved = [-Infinity, -Infinity, -Infinity]; // lane stays empty until s passes this (roller path)

  function slotFor(stage, level, safe) {
    const has = (n) => stage >= n;
    const intro = (n) => (stage === n ? 1.7 : 1); // a stage's new obstacle shows up more in that stage
    if (safe) {
      if (rnd() < Math.max(0.18, 0.6 - 0.08 * level)) return 'none';
      return weighted(rnd, {
        barrier: 3, gate: 3, podRamp: 2,
        gap: has(5) ? 3 * intro(5) : 0,
        laserOpen: has(4) ? 1.5 * intro(4) : 0,
      });
    }
    if (rnd() < Math.max(0.12, 0.5 - 0.07 * level)) return 'none';
    return weighted(rnd, {
      pod: 4, barrier: 2, gate: 2, podRamp: 1,
      roller: has(2) ? 2.2 * intro(2) : 0,
      slider: has(3) ? 2 * intro(3) : 0,
      laser: has(4) ? 2.2 * intro(4) : 0,
      gap: has(5) ? 2 * intro(5) : 0,
    });
  }

  return {
    /**
     * Build the row starting at track position s; the stage comes from s itself.
     * @param {number} s
     * @returns {Row}
     */
    next(s) {
      const stage = stageAt(s);
      const into = s - stageStart(stage);
      const level = stage - 1 + 0.8 * clamp01(into / STAGE_LEN);
      const breather = stage > 1 && into < BREATHER;
      // The safe lane is chosen first and only ever gets a passable slot.
      const safeLane = Math.floor(rnd() * LANES);
      /** @type {string[]} */
      let slots;
      if (breather) {
        slots = ['none', 'none', 'none'];
      } else if (index > 1 && rnd() < Math.min(0.13, 0.04 + 0.015 * level)) {
        const k = stage >= 5 ? weighted(rnd, { barrier: 1, gate: 1, gap: 1 }) : rnd() < 0.5 ? 'barrier' : 'gate';
        slots = [k, k, k]; // full-width wall: everyone jumps or rolls
      } else {
        slots = [0, 1, 2].map((l) => slotFor(stage, level, l === safeLane));
        if (index < 2) {
          // Warm-up rows: at most one simple obstacle, never in the safe lane.
          let kept = false;
          slots = slots.map((k, l) => {
            if (l === safeLane || kept || !['pod', 'podRamp', 'barrier', 'gate'].includes(k)) return 'none';
            kept = true;
            return k === 'pod' ? 'podRamp' : k;
          });
        }
      }
      for (let l = 0; l < LANES; l++) if (reserved[l] > s) slots[l] = 'none';

      // A slider needs an empty, non-safe neighbour lane to drift into.
      /** @type {(number|undefined)[]} */
      const slideTo = [];
      slots.forEach((k, a) => {
        if (k !== 'slider') return;
        // Clearing a non-safe neighbour only ever removes obstacles, so passability is unaffected.
        const options = [a - 1, a + 1].filter((b) => b >= 0 && b < LANES && b !== safeLane && reserved[b] <= s && slots[b] !== 'slider' && slots[b] !== 'slideTarget');
        if (!options.length) {
          slots[a] = 'pod';
          return;
        }
        const b = options[Math.floor(rnd() * options.length)];
        slideTo[a] = b;
        slots[b] = 'slideTarget';
      });

      const front = s + RAMP_LEN; // every body/bar front in a row lines up here
      /** @type {Obstacle[]} */
      const obstacles = [];
      const add = (kind, lane, at, len, extra = {}) => obstacles.push({ kind, lane, s: at, len, ramp: false, ...extra });
      slots.forEach((k, lane) => {
        if (k === 'barrier') add('barrier', lane, front, BARRIER_D);
        else if (k === 'gate') add('gate', lane, front, GATE_D);
        else if (k === 'pod') add('pod', lane, front, POD_LEN);
        else if (k === 'podRamp') add('pod', lane, s, RAMP_LEN + POD_LEN, { ramp: true });
        else if (k === 'roller') {
          add('roller', lane, front, ROLLER_LEN);
          reserved[lane] = front + ROLLER_RATIO * ROLLER_SHOW + ROLLER_LEN + 2;
        } else if (k === 'slider') add('slider', lane, front, SLIDER_LEN, { to: slideTo[lane] });
        else if (k === 'laser') add('laser', lane, front, LASER_D, { phase: rnd() < 0.3 ? 0.75 : 0.25 });
        else if (k === 'laserOpen') add('laser', lane, front, LASER_D, { phase: 0.75 });
        else if (k === 'gap') add('gap', lane, front, GAP_LEN);
      });
      const end = Math.max(front + 1, ...obstacles.map((o) => o.s + o.len));

      /** @type {CellSpec[]} */
      const cells = [];
      const cellLanes = new Set();
      const line = (lane, from, to, y, skip = null) => {
        for (let p = from; p <= to + 1e-6; p += 2.4) {
          if (skip && p > skip[0] && p < skip[1]) continue;
          cells.push({ lane, s: p, y });
        }
        cellLanes.add(lane);
      };
      const arc = (lane, mid) => {
        for (let i = -2; i <= 2; i++) cells.push({ lane, s: mid + i * 2.2, y: CELL_Y + 1.35 * (1 - (i / 2) ** 2) });
        cellLanes.add(lane);
      };
      if (rnd() < 0.8) {
        const k = slots[safeLane];
        if (k === 'none') line(safeLane, front - 5, front + 7, CELL_Y);
        else if (k === 'gate') line(safeLane, front - 4.8, front + 4.8, 0.55);
        else if (k === 'barrier') arc(safeLane, front + BARRIER_D / 2);
        else if (k === 'gap') arc(safeLane, front + GAP_LEN / 2);
        else if (k === 'laserOpen') line(safeLane, front - 5, front + 7, CELL_Y, [front - 1.2, front + LASER_D + 1.2]);
        else {
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

      const free = () => [0, 1, 2].filter((l) => slots[l] === 'none' && !cellLanes.has(l));
      /** @type {PowerSpec|null} */
      let power = null;
      powerIn -= end - s;
      if (powerIn <= 0 && free().length) {
        const lanes = free();
        power = {
          kind: /** @type {PowerKind} */ (POWER_KINDS[Math.floor(rnd() * POWER_KINDS.length)]),
          lane: lanes[Math.floor(rnd() * lanes.length)],
          s: front + 2,
          y: 1.0,
        };
        cellLanes.add(power.lane);
        powerIn = 380 + rnd() * 320;
      }
      /** @type {CellSpec|null} */
      let gem = null;
      if (index > 3 && rnd() < 0.035 && free().length) {
        const lanes = free();
        gem = { lane: lanes[Math.floor(rnd() * lanes.length)], s: front + 3, y: 1.0 };
      }

      // Gap in seconds shrinks as the stage level rises; measured at the stage's speed cap
      // so it never drops under MIN_GAP_TIME at any speed the hero can actually run.
      const gapSec = Math.max(0.72, 1.45 - 0.12 * level) * (0.9 + 0.25 * rnd());
      const gap = stageCap(stage) * gapSec;
      powerIn -= gap;
      index++;
      return { s, end, nextS: end + gap, stage, safeLane, slots, obstacles, cells, power, gem };
    },
  };
}

// Pure game-economy data and formulas: upgrades, consumables, characters, missions,
// daily rewards, XP curve and score multiplier. No DOM, so node can self-check it.
import { mulberry32 } from './track.js';

export const MAX_UPGRADE = 6;
export const MAX_CHAR_LEVEL = 5;
export const MAX_TIER = 30; // mission tier == base score multiplier

/** Power-up upgrades: duration (s) per level 1..6 and the Cell cost to reach level n+1. */
export const UPGRADES = {
  magnet: { name: 'Magnet', desc: 'Pulls nearby Cells to you.', color: '#ff3d6e', dur: [8, 10, 12, 14, 17, 20] },
  spring: { name: 'Spring Boots', desc: 'Super jumps onto pod roofs.', color: '#4dff88', dur: [8, 10, 12, 14, 17, 20] },
  shield: { name: 'Shield', desc: 'Absorbs one crash.', color: '#4dc3ff', dur: [8, 10, 12, 14, 17, 20] },
  x2: { name: '2x Score', desc: 'Doubles points earned.', color: '#ffb02e', dur: [8, 10, 12, 14, 17, 20] },
  hyper: { name: 'Hyper Dash', desc: 'Invincible speed burst that vacuums Cells.', color: '#b36bff', dur: [3, 3.6, 4.2, 4.8, 5.4, 6] },
};
export const UPGRADE_COST = [250, 600, 1300, 2600, 5000]; // index = current level - 1
export const upgradeCost = (level) => (level >= MAX_UPGRADE ? null : UPGRADE_COST[level - 1]);

/** Consumables bought in the shop and toggled in the pre-run loadout. */
export const ITEMS = {
  headstart: { name: 'Head Start', desc: 'Launch the run with a 400 m Hyper Dash.', price: { cells: 700 }, loadout: true },
  revive: { name: 'Second Chance', desc: 'Revive once after a crash (auto-offered).', price: { gems: 3 }, loadout: true },
  booster: { name: 'Score Booster', desc: '+1 score multiplier for one run.', price: { cells: 500 }, loadout: true },
  mystery: { name: 'Mystery Box', desc: 'Random Cells, Gems or an item.', price: { cells: 900 }, loadout: false },
};
export const HEADSTART_M = 400;
/** Gem price of the n-th paid revive in one run (n = 0, 1, 2...). */
export const reviveGems = (n) => Math.min(16, 2 ** n);

/** Mystery box prize table; `roll` takes a 0..1 random. */
export const MYSTERY = [
  { w: 34, prize: { cells: 600 } },
  { w: 20, prize: { cells: 1500 } },
  { w: 6, prize: { cells: 4000 } },
  { w: 14, prize: { gems: 2 } },
  { w: 5, prize: { gems: 6 } },
  { w: 8, prize: { item: 'headstart' } },
  { w: 8, prize: { item: 'booster' } },
  { w: 5, prize: { item: 'revive' } },
];
export function rollMystery(r) {
  let x = r * MYSTERY.reduce((a, m) => a + m.w, 0);
  for (const m of MYSTERY) if ((x -= m.w) < 0) return m.prize;
  return MYSTERY[0].prize;
}

/**
 * Characters. `perk(level)` returns the numeric strength of the perk at level 1..5;
 * `perkText(level)` describes it. `unlock` is the price (and optional account level gate).
 */
export const CHARACTERS = [
  {
    id: 'volt', name: 'Volt', role: 'Courier Bot', color: '#45f3ff',
    unlock: null, perk: (l) => 2 * l, perkText: (l) => `+${2 * l}% score from distance`,
  },
  {
    id: 'bit', name: 'Bit', role: 'Pocket Cube Bot', color: '#7dff6a',
    unlock: { cells: 2500 }, perk: (l) => 10 + 10 * l, perkText: (l) => `Magnet lasts +${10 + 10 * l}% longer`,
  },
  {
    id: 'moss', name: 'Moss', role: 'Stone Golem', color: '#8bd450',
    unlock: { cells: 6000 }, perk: (l) => 10 + 10 * l,
    perkText: (l) => `Shield lasts +${10 + 10 * l}% longer${l >= 5 ? ', blocks 2 hits' : ''}`,
  },
  {
    id: 'ember', name: 'Ember', role: 'Blaze Bot', color: '#ff7a2e',
    unlock: { gems: 25 }, perk: (l) => 10 + 10 * l, perkText: (l) => `2x Score lasts +${10 + 10 * l}% longer`,
  },
  {
    id: 'nimbus', name: 'Nimbus', role: 'Cloud Sprite', color: '#bfe6ff',
    unlock: { cells: 5000, level: 4 }, perk: (l) => 6 + 4 * l, perkText: (l) => `Jumps ${6 + 4 * l}% higher and floatier`,
  },
  {
    id: 'orbit', name: 'Orbit', role: 'Star Cat Bot', color: '#c58bff',
    unlock: { gems: 40, level: 6 }, perk: (l) => 0.5 + 0.5 * l, perkText: (l) => `${0.5 + 0.5 * l}% of Cells turn into Gems`,
  },
];
export const CHAR_COST = [500, 1200, 2600, 5200]; // index = current level - 1
export const charUpgradeCost = (level) => (level >= MAX_CHAR_LEVEL ? null : CHAR_COST[level - 1]);
export const charById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

/** Account level: XP needed to go from `level` to level + 1. */
export const xpForLevel = (level) => 250 + 150 * (level - 1);
/** Apply gained XP; returns the new level/xp and how many levels were gained. */
export function addXp(level, xp, gained) {
  let l = level;
  let x = xp + gained;
  let ups = 0;
  while (x >= xpForLevel(l) && l < 99) {
    x -= xpForLevel(l);
    l++;
    ups++;
  }
  return { level: l, xp: x, ups };
}
/** XP for a finished run. */
export const runXp = (meters, cells) => Math.floor(meters / 10) + cells;

/** Score multiplier: mission tier is the base, account level adds +2% per level, booster +1. */
export const scoreMultiplier = (tier, level, booster) => (Math.min(MAX_TIER, tier) + (booster ? 1 : 0)) * (1 + 0.02 * (level - 1));

/**
 * Missions. `per: 'run'` = must happen inside a single run (best run counts),
 * otherwise progress accumulates across runs.
 */
export const MISSION_TYPES = {
  cells: { text: (n) => `Collect ${n} Cells`, base: 150, step: 60, per: 'total' },
  meters: { text: (n) => `Run ${n} m in one run`, base: 600, step: 180, per: 'run' },
  jumps: { text: (n) => `Jump ${n} times`, base: 25, step: 10, per: 'total' },
  gates: { text: (n) => `Roll under ${n} gates`, base: 6, step: 3, per: 'total' },
  stage: { text: (n) => `Reach stage ${n}`, base: 2, step: 0.5, per: 'run' },
  powers: { text: (n) => `Grab ${n} power-ups`, base: 3, step: 1, per: 'total' },
  score: { text: (n) => `Score ${n} in one run`, base: 1500, step: 900, per: 'run' },
  lanes: { text: (n) => `Switch lanes ${n} times`, base: 40, step: 15, per: 'total' },
};

/** The deterministic set of 3 missions for a tier. */
export function missionSet(tier) {
  const rnd = mulberry32(9001 + tier * 7919);
  const keys = Object.keys(MISSION_TYPES);
  const picked = [];
  while (picked.length < 3) {
    const k = keys[Math.floor(rnd() * keys.length)];
    if (!picked.includes(k)) picked.push(k);
  }
  return picked.map((type, i) => {
    const m = MISSION_TYPES[type];
    const raw = m.base + m.step * (tier - 1) * (0.8 + 0.4 * rnd());
    const target = type === 'stage' ? Math.min(12, Math.floor(raw)) : roundNice(raw);
    const reward = i === 2 ? { gems: 1 + Math.floor(tier / 4) } : { cells: 150 + 50 * tier };
    return { type, target, text: m.text(target), per: m.per, reward, xp: 60 + 20 * tier };
  });
}
function roundNice(v) {
  const step = v >= 1000 ? 100 : v >= 100 ? 10 : 1;
  return Math.max(step, Math.round(v / step) * step);
}

/** 7-day streak calendar. */
export const DAILY = [
  { cells: 200 }, { cells: 350 }, { gems: 1 }, { cells: 600 }, { item: 'headstart' }, { cells: 1000 }, { gems: 5 },
];
/** Local calendar day key (YYYY-MM-DD). */
export const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
/** Whole local days between two day keys. */
export function daysBetween(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  if (pa.length !== 3 || pb.length !== 3 || pa.some(isNaN) || pb.some(isNaN)) return Infinity;
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
}
/**
 * Daily reward state for today: which calendar slot (0..6) is up and whether it can be claimed.
 * @param {{last: string, streak: number}} daily streak = days claimed in the current cycle
 */
export function dailyStatus(daily, today) {
  if (!daily.last) return { claimable: true, slot: 0 };
  const gap = daysBetween(daily.last, today);
  if (gap <= 0) return { claimable: false, slot: (daily.streak - 1 + 7) % 7 };
  if (gap === 1) return { claimable: true, slot: daily.streak % 7 };
  return { claimable: true, slot: 0 }; // missed a day: streak restarts
}

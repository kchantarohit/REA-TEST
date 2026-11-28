// Pure game-economy data and formulas: upgrades, consumables, the courier crew and outfits,
// missions, daily rewards, the daily word, combos, achievements, XP curve and score multiplier. No DOM, so node can self-check it.
import { mulberry32 } from './track.js';

export const MAX_UPGRADE = 6;
export const MAX_CHAR_LEVEL = 5;
export const MAX_TIER = 30; // mission tier == base score multiplier

/** Power-up upgrades: duration (s) per level 1..6 and the Cell cost to reach level n+1. */
export const UPGRADES = {
  magnet: { name: 'Magnet', desc: 'Pulls nearby Sparks into your pockets.', color: '#ff3d6e', dur: [8, 10, 12, 14, 17, 20] },
  spring: { name: 'Spring Boots', desc: 'Bouncy jumps onto cargo pod roofs.', color: '#4dff88', dur: [8, 10, 12, 14, 17, 20] },
  shield: { name: 'Shield', desc: 'Bubble that eats one crash.', color: '#4dc3ff', dur: [8, 10, 12, 14, 17, 20] },
  x2: { name: '2x Score', desc: 'Every point counts twice.', color: '#ffb02e', dur: [8, 10, 12, 14, 17, 20] },
  hyper: { name: 'Hyper Dash', desc: 'Unstoppable sprint that hoovers up Sparks.', color: '#b36bff', dur: [3, 3.6, 4.2, 4.8, 5.4, 6] },
};
export const UPGRADE_COST = [250, 600, 1300, 2600, 5000]; // index = current level - 1
export const upgradeCost = (level) => (level >= MAX_UPGRADE ? null : UPGRADE_COST[level - 1]);

/** Consumables bought in the shop and toggled in the pre-run loadout. */
export const ITEMS = {
  headstart: { name: 'Head Start', desc: 'Launch the run with a 400 m Hyper Dash.', price: { cells: 700 }, loadout: true },
  revive: { name: 'Second Chance', desc: 'Revive once after a crash (auto-offered).', price: { gems: 3 }, loadout: true },
  booster: { name: 'Score Booster', desc: '+1 score multiplier for one run.', price: { cells: 500 }, loadout: true },
  scooter: { name: 'Kick Scooter', desc: 'Ride for 30 s. Shrugs off one crash.', price: { cells: 900 }, loadout: true },
  mystery: { name: 'Mystery Parcel', desc: 'Random Sparks, Gems or an item.', price: { cells: 900 }, loadout: false },
};
export const SCOOTER_TIME = 30;
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
  { w: 7, prize: { item: 'scooter' } },
];
export function rollMystery(r) {
  let x = r * MYSTERY.reduce((a, m) => a + m.w, 0);
  for (const m of MYSTERY) if ((x -= m.w) < 0) return m.prize;
  return MYSTERY[0].prize;
}

/**
 * The Volt Dash courier crew: six original human runners. `perkKind` picks what the perk
 * does in the run; `perk(level)` is its strength at level 1..5. `unlock` is the price (and
 * optional account level gate). `look` feeds the model builder (characters.js); each
 * character has 3 outfits (0 = default, 1 and 2 are bought with Gems).
 */
export const CHARACTERS = [
  {
    id: 'rio', name: 'Rio Vance', role: 'Bike messenger, on foot', color: '#3ee6f0', perkKind: 'distance',
    bio: 'Never late. Occasionally early. Always loud about it.',
    unlock: null, perk: (l) => 2 * l, perkText: (l) => `+${2 * l}% score from distance`,
    look: { build: 'lean', skin: '#8d5a3b', hair: '#1c1210', hairStyle: 'twists', acc: 'headphones', bag: 'messenger', sex: 'm' },
    outfits: [
      { name: 'Dispatch Teal', top: '#1fb3b0', top2: '#ffc46b', legs: '#2b2440', shoes: '#f4efe6', acc: '#ff4f7b' },
      { name: 'Night Shift', top: '#3b2a6e', top2: '#3ee6f0', legs: '#191526', shoes: '#ff4f7b', acc: '#3ee6f0' },
      { name: 'Sodium Lamp', top: '#ff9a3c', top2: '#2a1540', legs: '#3d3550', shoes: '#ffffff', acc: '#2a1540' },
    ],
  },
  {
    id: 'mina', name: 'Mina Park', role: 'Route planner', color: '#ffc46b', perkKind: 'magnet',
    bio: 'Hears a Spark drop from three blocks away.',
    unlock: { cells: 2500 }, perk: (l) => 10 + 10 * l, perkText: (l) => `Magnet lasts +${10 + 10 * l}% longer`,
    look: { build: 'slim', skin: '#f1c9a5', hair: '#16121c', hairStyle: 'bob', acc: 'bigphones', bag: 'none', sex: 'f' },
    outfits: [
      { name: 'Raincoat', top: '#ffc23d', top2: '#2a1540', legs: '#26304d', shoes: '#ff4f7b', acc: '#ff4f7b' },
      { name: 'Mint Chip', top: '#7fe0b8', top2: '#ffffff', legs: '#2c2a3a', shoes: '#ffffff', acc: '#2c2a3a' },
      { name: 'Ultraviolet', top: '#8a4dff', top2: '#ffc46b', legs: '#1a1430', shoes: '#ffc46b', acc: '#ffc46b' },
    ],
  },
  {
    id: 'tomas', name: 'Tomas Okafor', role: 'Heavy-parcel specialist', color: '#ff9a3c', perkKind: 'shield',
    bio: 'Built like a delivery van. Gentle like a cat.',
    unlock: { cells: 6000 }, perk: (l) => 10 + 10 * l,
    perkText: (l) => `Shield lasts +${10 + 10 * l}% longer${l >= 5 ? ', blocks 2 hits' : ''}`,
    look: { build: 'broad', skin: '#4a2c1d', hair: '#120c0a', hairStyle: 'shaved', beard: true, acc: 'beanie', bag: 'backpack', sex: 'm' },
    outfits: [
      { name: 'Hi-Vis', top: '#ff7a2e', top2: '#e8ff5a', legs: '#2f3445', shoes: '#ffc46b', acc: '#2f3445' },
      { name: 'Forest', top: '#2f7a55', top2: '#ffc46b', legs: '#2b2233', shoes: '#ffffff', acc: '#ffc46b' },
      { name: 'Cobalt', top: '#2a5ad8', top2: '#ffffff', legs: '#1c1a2a', shoes: '#ff4f7b', acc: '#ff4f7b' },
    ],
  },
  {
    id: 'esme', name: 'Esme Duarte', role: 'Rooftop shortcut queen', color: '#ff4f7b', perkKind: 'x2',
    bio: 'Turns every shortcut into a show.',
    unlock: { gems: 25 }, perk: (l) => 10 + 10 * l, perkText: (l) => `2x Score lasts +${10 + 10 * l}% longer`,
    look: { build: 'slim', skin: '#c68e62', hair: '#b4321c', hairStyle: 'puff', acc: 'scarf', bag: 'hip', sex: 'f' },
    outfits: [
      { name: 'Hot Sauce', top: '#ff4f7b', top2: '#ffc46b', legs: '#1f1a33', shoes: '#ffffff', acc: '#ffc46b' },
      { name: 'Denim', top: '#3c6fb4', top2: '#ff9a3c', legs: '#2a2f4a', shoes: '#ff9a3c', acc: '#ff9a3c' },
      { name: 'Midnight', top: '#1d1a2e', top2: '#ff4f7b', legs: '#3a2850', shoes: '#ff4f7b', acc: '#ff4f7b' },
    ],
  },
  {
    id: 'noor', name: 'Noor Haddad', role: 'Parkour courier', color: '#b58cff', perkKind: 'jump',
    bio: 'Takes the stairs. All of them. At once.',
    unlock: { cells: 5000, level: 4 }, perk: (l) => 6 + 4 * l, perkText: (l) => `Jumps ${6 + 4 * l}% higher and floatier`,
    look: { build: 'slim', skin: '#d9a77c', hair: '#2a1a12', hairStyle: 'wrap', acc: 'none', bag: 'sling', sex: 'f' },
    outfits: [
      { name: 'Lavender', top: '#f2efe8', top2: '#b58cff', legs: '#2d2342', shoes: '#b58cff', acc: '#b58cff' },
      { name: 'Coral Run', top: '#ff7f6b', top2: '#fff1dc', legs: '#2a2238', shoes: '#fff1dc', acc: '#3ee6f0' },
      { name: 'Teal Tide', top: '#14837f', top2: '#ffc46b', legs: '#1e2a33', shoes: '#ffc46b', acc: '#ffc46b' },
    ],
  },
  {
    id: 'oskar', name: 'Oskar Lind', role: 'Retired postman, unretired', color: '#7fe0b8', perkKind: 'gems',
    bio: 'Forty years on the same route. Knows where the Gems hide.',
    unlock: { gems: 40, level: 6 }, perk: (l) => 0.5 + 0.5 * l, perkText: (l) => `${0.5 + 0.5 * l}% of Sparks turn into Gems`,
    look: { build: 'lean', skin: '#f0c8b0', hair: '#d8d4cc', hairStyle: 'short', beard: true, acc: 'flatcap', glasses: true, bag: 'satchel', sex: 'm' },
    outfits: [
      { name: 'Postal Blue', top: '#3b5ba8', top2: '#ff4f7b', legs: '#2c2c3c', shoes: '#5a3a26', acc: '#7a5a3a' },
      { name: 'Cardigan', top: '#c0673a', top2: '#fff1dc', legs: '#3a3346', shoes: '#2a2230', acc: '#3a3346' },
      { name: 'Sunday Best', top: '#2f6f5a', top2: '#ffc46b', legs: '#24202e', shoes: '#ffc46b', acc: '#ffc46b' },
    ],
  },
];
/** v2 robot id -> v3 courier id, so owned/upgraded characters carry over. */
export const CHAR_MAP = { volt: 'rio', bit: 'mina', moss: 'tomas', ember: 'esme', nimbus: 'noor', orbit: 'oskar' };
export const OUTFIT_PRICE = [0, 8, 15]; // Gems per outfit index
export const STARTER = 'rio';
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
  cells: { text: (n) => `Collect ${n} Sparks`, base: 150, step: 60, per: 'total' },
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
  { cells: 200 }, { cells: 350 }, { gems: 1 }, { item: 'scooter' }, { item: 'headstart' }, { cells: 1000 }, { gems: 5 },
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

// ---------- combo ----------
/** Seconds without a new trick before the chain drops. */
export const COMBO_WINDOW = 3;
/** Score multiplier for a chain of n tricks: +0.25 every 3 tricks, capped at x3. */
export const comboMult = (n) => 1 + Math.min(8, Math.floor(n / 3)) * 0.25;
/** Popup word when the chain reaches n (null when nothing to shout). */
export const comboWord = (n) => (n === 3 ? 'NICE' : n === 6 ? 'GREAT' : n >= 10 && n % 5 === 0 ? 'INSANE' : null);
/**
 * Register one trick at time t. Pure: returns the next state.
 * @param {{n: number, last: number}} c
 */
export function comboAdd(c, t) {
  const n = t - c.last <= COMBO_WINDOW ? c.n + 1 : 1;
  return { n, last: t };
}
/** Chain length still alive at time t (0 once the window ran out). */
export const comboLive = (c, t) => (t - c.last <= COMBO_WINDOW ? c.n : 0);

// ---------- daily word ----------
export const WORDS = [
  'ROUTE', 'SPARK', 'BLOCK', 'DUSKY', 'STORM', 'FROST', 'LIGHT', 'SPEED', 'DRIFT', 'STAMP', 'CREWS', 'VOLTS', 'LANES',
  'ALLEY', 'PLAZA', 'RIDER', 'SWIFT', 'CARGO', 'BRAVE', 'QUICK', 'NIGHT', 'PULSE', 'HONKS', 'BOOST', 'TRAIL',
];
export const WORD_GEMS = 5;
/** The 5-letter word for a local day key; every player gets the same word that day. */
export function wordOfDay(day) {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return WORDS[h % WORDS.length];
}

// ---------- achievements ----------
/** Lifetime stats the save tracks (all integers). */
export const STAT_KEYS = ['runs', 'meters', 'bestMeters', 'sparks', 'gems', 'jumps', 'rolls', 'bestCombo', 'escapes', 'caught', 'scooters', 'words', 'stage'];
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Shift', desc: 'Finish a run', stat: 'runs', target: 1, gems: 1 },
  { id: 'regular', name: 'Night Owl', desc: 'Finish 25 runs', stat: 'runs', target: 25, gems: 3 },
  { id: 'longhaul', name: 'Long Haul', desc: 'Run 10,000 m in total', stat: 'meters', target: 10000, gems: 3 },
  { id: 'crosstown', name: 'Cross-Town', desc: 'Run 2,000 m in one go', stat: 'bestMeters', target: 2000, gems: 3 },
  { id: 'pockets', name: 'Deep Pockets', desc: 'Collect 5,000 Sparks', stat: 'sparks', target: 5000, gems: 3 },
  { id: 'hopper', name: 'Curb Hopper', desc: 'Jump 500 times', stat: 'jumps', target: 500, gems: 2 },
  { id: 'tuck', name: 'Tuck and Roll', desc: 'Roll 200 times', stat: 'rolls', target: 200, gems: 2 },
  { id: 'onfire', name: 'On Fire', desc: 'Chain a 10-trick combo', stat: 'bestCombo', target: 10, gems: 3 },
  { id: 'untouch', name: 'Untouchable', desc: 'Chain a 25-trick combo', stat: 'bestCombo', target: 25, gems: 5 },
  { id: 'shook', name: 'Shook Clank', desc: 'Lose Clank 10 times after he closes in', stat: 'escapes', target: 10, gems: 3 },
  { id: 'swept', name: 'Swept Up', desc: 'Get caught by Clank. It happens.', stat: 'caught', target: 1, gems: 1 },
  { id: 'kickit', name: 'Kick It', desc: 'Ride the Kick Scooter 5 times', stat: 'scooters', target: 5, gems: 2 },
  { id: 'words', name: 'Wordsmith', desc: 'Spell 3 daily words', stat: 'words', target: 3, gems: 5 },
  { id: 'skyway', name: 'Skyway Bound', desc: 'Reach the Cosmic Skyway', stat: 'stage', target: 5, gems: 5 },
  { id: 'crew', name: 'Full Crew', desc: 'Recruit all six couriers', stat: 'crew', target: 6, gems: 10 },
];

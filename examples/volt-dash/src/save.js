// One versioned save object in localStorage. Everything read back is validated, so a
// corrupt or hand-edited save degrades to defaults instead of breaking the game.
// v1 kept separate keys (voltdash.best / voltdash.cells / voltdash.muted); v2 kept one
// object under voltdash.save.v2 with robot character ids. Both migrate once into v3 and
// are left in place (an older APK reinstalled still finds its own save).
import {
  ACHIEVEMENTS, CHARACTERS, CHAR_MAP, ITEMS, MAX_CHAR_LEVEL, MAX_TIER, MAX_UPGRADE, OUTFIT_PRICE, STARTER, STAT_KEYS, UPGRADES,
} from './catalog.js';

export const SAVE_KEY = 'voltdash.save.v3';
export const V2_KEY = 'voltdash.save.v2';
export const SAVE_VERSION = 3;
const V1 = { best: 'voltdash.best', cells: 'voltdash.cells', muted: 'voltdash.muted' };

/** @typedef {ReturnType<typeof defaults>} Save */
export function defaults() {
  return {
    v: SAVE_VERSION,
    best: 0,
    cells: 0, // shown as "Sparks"; the key stays for save compatibility
    gems: 0,
    level: 1,
    xp: 0,
    settings: { sound: true, music: true, vibe: true, quality: 'high' },
    upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 1])),
    items: Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])),
    /** character id -> level (owned when present) */
    chars: { [STARTER]: 1 },
    selected: STARTER,
    /** character id -> {own: owned outfit indices, sel: worn index} */
    outfits: Object.fromEntries(CHARACTERS.map((c) => [c.id, { own: [0], sel: 0 }])),
    loadout: { headstart: true, revive: true, booster: true, scooter: true },
    missions: { tier: 1, progress: [0, 0, 0], claimed: [false, false, false] },
    daily: { last: '', streak: 0 },
    /** Daily word hunt: letters found today, and whether today's reward was claimed. */
    word: { day: '', got: [false, false, false, false, false], claimed: false },
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
    /** unlocked achievement ids */
    ach: /** @type {string[]} */ ([]),
    tutorialDone: false,
    runs: 0,
  };
}

const int = (v, min, max, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const BIG = 1e9;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** v2 robot ids become courier ids; v3 ids pass through. */
const mapId = (id) => (typeof id === 'string' ? CHAR_MAP[id] || id : '');

/** Coerce anything (a v2 or v3 object) into a valid v3 Save. */
export function sanitize(raw) {
  const r = obj(raw);
  const d = defaults();
  const st = obj(r.settings);
  const s = {
    ...d,
    best: int(r.best, 0, BIG, 0),
    cells: int(r.cells, 0, BIG, 0),
    gems: int(r.gems, 0, BIG, 0),
    level: int(r.level, 1, 99, 1),
    xp: int(r.xp, 0, BIG, 0),
    settings: {
      sound: bool(st.sound, true),
      music: bool(st.music, true),
      vibe: bool(st.vibe, true),
      quality: st.quality === 'low' ? 'low' : 'high',
    },
    tutorialDone: bool(r.tutorialDone, false),
    runs: int(r.runs, 0, BIG, 0),
  };
  const up = obj(r.upgrades);
  for (const k in s.upgrades) s.upgrades[k] = int(up[k], 1, MAX_UPGRADE, 1);
  const it = obj(r.items);
  for (const k in s.items) s.items[k] = int(it[k], 0, 999, 0);

  const ch = obj(r.chars);
  s.chars = {};
  for (const [k, v] of Object.entries(ch)) {
    const id = mapId(k);
    if (!CHARACTERS.some((c) => c.id === id)) continue;
    const l = int(v, 0, MAX_CHAR_LEVEL, 0);
    if (l > 0) s.chars[id] = Math.max(s.chars[id] || 0, l);
  }
  s.chars[STARTER] = s.chars[STARTER] || 1; // the starter can never be lost
  const sel = mapId(r.selected);
  s.selected = s.chars[sel] ? sel : STARTER;

  const of = obj(r.outfits);
  for (const c of CHARACTERS) {
    const o = obj(of[c.id]);
    const own = Array.isArray(o.own) ? [...new Set(o.own.filter((i) => Number.isInteger(i) && i >= 0 && i < OUTFIT_PRICE.length))] : [];
    if (!own.includes(0)) own.unshift(0);
    own.sort((a, b) => a - b);
    const worn = Number.isInteger(o.sel) ? o.sel : 0;
    s.outfits[c.id] = { own, sel: own.includes(worn) ? worn : 0 };
  }

  const lo = obj(r.loadout);
  for (const k in s.loadout) s.loadout[k] = bool(lo[k], true);
  const m = obj(r.missions);
  const arr = (a, n, f) => Array.from({ length: n }, (_, i) => f(Array.isArray(a) ? a[i] : undefined));
  s.missions = {
    tier: int(m.tier, 1, MAX_TIER, 1),
    progress: arr(m.progress, 3, (v) => int(v, 0, BIG, 0)),
    claimed: arr(m.claimed, 3, (v) => bool(v, false)),
  };
  const dl = obj(r.daily);
  s.daily = { last: typeof dl.last === 'string' && DAY.test(dl.last) ? dl.last : '', streak: int(dl.streak, 0, 7, 0) };
  const w = obj(r.word);
  s.word = {
    day: typeof w.day === 'string' && DAY.test(w.day) ? w.day : '',
    got: arr(w.got, 5, (v) => bool(v, false)),
    claimed: bool(w.claimed, false),
  };
  const sx = obj(r.stats);
  for (const k of STAT_KEYS) s.stats[k] = int(sx[k], 0, BIG, 0);
  s.stats.runs = Math.max(s.stats.runs, s.runs); // v2 saves only had the run counter
  s.ach = Array.isArray(r.ach) ? [...new Set(r.ach.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)))] : [];
  return s;
}

/** Build a v3 save from v1's separate keys, or null when there is no v1 data. */
export function migrateV1(getItem) {
  const read = (k) => {
    try {
      const v = getItem(k);
      return v == null ? undefined : JSON.parse(v);
    } catch {
      return undefined;
    }
  };
  const best = read(V1.best);
  const cells = read(V1.cells);
  const muted = read(V1.muted);
  if (best === undefined && cells === undefined && muted === undefined) return null;
  const s = defaults();
  s.best = int(Number(best), 0, BIG, 0);
  s.cells = int(Number(cells), 0, BIG, 0);
  s.settings.sound = muted !== true;
  s.tutorialDone = s.best > 0; // they already know the controls
  return sanitize(s);
}

/**
 * @param {Pick<Storage, 'getItem'|'setItem'>|null} storage
 * @returns {{data: Save, migrated: ''|'v1'|'v2', persist: () => boolean, reset: () => void}}
 */
export function openSave(storage) {
  const get = (k) => {
    try {
      return storage ? storage.getItem(k) : null;
    } catch {
      return null;
    }
  };
  const parse = (raw) => {
    try {
      return sanitize(JSON.parse(raw));
    } catch {
      return null; // corrupt JSON: fall through rather than crash
    }
  };
  /** @type {Save|null} */
  let data = null;
  /** @type {''|'v1'|'v2'} */
  let migrated = '';
  const raw3 = get(SAVE_KEY);
  if (raw3 != null) data = parse(raw3) || defaults();
  else {
    const raw2 = get(V2_KEY);
    const v2 = raw2 != null ? parse(raw2) : null;
    if (v2) {
      data = v2;
      migrated = 'v2';
    } else {
      const v1 = migrateV1(get);
      if (v1) {
        data = v1;
        migrated = 'v1';
      }
    }
  }
  const api = {
    data: data || defaults(),
    migrated,
    persist() {
      try {
        storage?.setItem(SAVE_KEY, JSON.stringify(api.data));
        return true;
      } catch {
        return false; // storage blocked or full: progress just isn't saved
      }
    },
    reset() {
      api.data = defaults();
      api.data.tutorialDone = true;
      api.persist();
    },
  };
  if (migrated) api.persist();
  return api;
}

// One versioned save object in localStorage. Everything read back is validated, so a
// corrupt or hand-edited save degrades to defaults instead of breaking the game.
// v1 kept separate keys (voltdash.best / voltdash.cells / voltdash.muted); they are
// migrated once and left in place.
import { CHARACTERS, ITEMS, MAX_CHAR_LEVEL, MAX_TIER, MAX_UPGRADE, UPGRADES } from './catalog.js';

export const SAVE_KEY = 'voltdash.save.v2';
export const SAVE_VERSION = 2;
const V1 = { best: 'voltdash.best', cells: 'voltdash.cells', muted: 'voltdash.muted' };

/** @typedef {ReturnType<typeof defaults>} Save */
export function defaults() {
  return {
    v: SAVE_VERSION,
    best: 0,
    cells: 0,
    gems: 0,
    level: 1,
    xp: 0,
    settings: { sound: true, music: true, vibe: true, quality: 'high' },
    upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 1])),
    items: Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])),
    /** character id -> level (owned when present) */
    chars: { volt: 1 },
    selected: 'volt',
    loadout: { headstart: true, revive: true, booster: true },
    missions: { tier: 1, progress: [0, 0, 0], claimed: [false, false, false] },
    daily: { last: '', streak: 0 },
    tutorialDone: false,
    runs: 0,
  };
}

const int = (v, min, max, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const BIG = 1e9;

/** Coerce anything into a valid Save. */
export function sanitize(raw) {
  const r = obj(raw);
  const d = defaults();
  const st = obj(r.settings);
  const s = {
    v: SAVE_VERSION,
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
    upgrades: { ...d.upgrades },
    items: { ...d.items },
    chars: {},
    selected: 'volt',
    loadout: { ...d.loadout },
    missions: { ...d.missions },
    daily: { ...d.daily },
    tutorialDone: bool(r.tutorialDone, false),
    runs: int(r.runs, 0, BIG, 0),
  };
  const up = obj(r.upgrades);
  for (const k in s.upgrades) s.upgrades[k] = int(up[k], 1, MAX_UPGRADE, 1);
  const it = obj(r.items);
  for (const k in s.items) s.items[k] = int(it[k], 0, 999, 0);
  const ch = obj(r.chars);
  for (const c of CHARACTERS) {
    const l = int(ch[c.id], 0, MAX_CHAR_LEVEL, 0);
    if (l > 0) s.chars[c.id] = l;
  }
  s.chars.volt = s.chars.volt || 1; // the starter can never be lost
  s.selected = typeof r.selected === 'string' && s.chars[r.selected] ? r.selected : 'volt';
  const lo = obj(r.loadout);
  for (const k in s.loadout) s.loadout[k] = bool(lo[k], true);
  const m = obj(r.missions);
  const arr = (a, f) => [0, 1, 2].map((i) => f(Array.isArray(a) ? a[i] : undefined));
  s.missions = {
    tier: int(m.tier, 1, MAX_TIER, 1),
    progress: arr(m.progress, (v) => int(v, 0, BIG, 0)),
    claimed: arr(m.claimed, (v) => bool(v, false)),
  };
  const dl = obj(r.daily);
  s.daily = { last: typeof dl.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dl.last) ? dl.last : '', streak: int(dl.streak, 0, 7, 0) };
  return s;
}

/** Build a v2 save from v1's separate keys, or null when there is no v1 data. */
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
 * @returns {{data: Save, migrated: boolean, persist: () => boolean, reset: () => void}}
 */
export function openSave(storage) {
  const get = (k) => {
    try {
      return storage ? storage.getItem(k) : null;
    } catch {
      return null;
    }
  };
  let data;
  let migrated = false;
  const raw = get(SAVE_KEY);
  if (raw != null) {
    try {
      data = sanitize(JSON.parse(raw));
    } catch {
      data = defaults(); // corrupt JSON: start fresh rather than crash
    }
  } else {
    const v1 = migrateV1(get);
    data = v1 || defaults();
    migrated = !!v1;
  }
  const api = {
    data,
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

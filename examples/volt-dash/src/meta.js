// Meta-game actions on the save data: purchases, characters, missions, daily reward,
// mystery box and banking a finished run. Pure (no DOM); every action validates and
// returns {ok, ...} instead of throwing, so the UI can show an error shake.
import {
  CHARACTERS, DAILY, ITEMS, MAX_TIER, UPGRADES, addXp, charById, charUpgradeCost, dailyStatus, missionSet,
  rollMystery, runXp, upgradeCost,
} from './catalog.js';

/** @typedef {import('./save.js').Save} Save */
/** @typedef {{cells?: number, gems?: number, item?: string}} Prize */

export const canAfford = (S, price) => (price.cells || 0) <= S.cells && (price.gems || 0) <= S.gems;
function pay(S, price) {
  if (!canAfford(S, price)) return false;
  S.cells -= price.cells || 0;
  S.gems -= price.gems || 0;
  return true;
}
/** @param {Save} S @param {Prize} prize */
export function grant(S, prize) {
  S.cells += prize.cells || 0;
  S.gems += prize.gems || 0;
  if (prize.item && prize.item in S.items) S.items[prize.item]++;
}

export function buyUpgrade(S, key) {
  if (!(key in UPGRADES)) return { ok: false, reason: 'unknown' };
  const cost = upgradeCost(S.upgrades[key]);
  if (cost == null) return { ok: false, reason: 'max' };
  if (!pay(S, { cells: cost })) return { ok: false, reason: 'funds' };
  S.upgrades[key]++;
  return { ok: true };
}

export function buyItem(S, key) {
  const it = ITEMS[key];
  if (!it) return { ok: false, reason: 'unknown' };
  if (S.items[key] >= 999) return { ok: false, reason: 'max' };
  if (!pay(S, it.price)) return { ok: false, reason: 'funds' };
  S.items[key]++;
  return { ok: true };
}

/** Open one owned Mystery Box. `r` is a 0..1 random. */
export function openMystery(S, r) {
  if (S.items.mystery <= 0) return { ok: false, reason: 'none' };
  S.items.mystery--;
  const prize = rollMystery(r);
  grant(S, prize);
  return { ok: true, prize };
}

export function unlockChar(S, id) {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c || !c.unlock || S.chars[id]) return { ok: false, reason: 'unknown' };
  if (c.unlock.level && S.level < c.unlock.level) return { ok: false, reason: 'level' };
  if (!pay(S, { cells: c.unlock.cells, gems: c.unlock.gems })) return { ok: false, reason: 'funds' };
  S.chars[id] = 1;
  S.selected = id;
  return { ok: true };
}

export function upgradeChar(S, id) {
  const l = S.chars[id];
  if (!l) return { ok: false, reason: 'locked' };
  const cost = charUpgradeCost(l);
  if (cost == null) return { ok: false, reason: 'max' };
  if (!pay(S, { cells: cost })) return { ok: false, reason: 'funds' };
  S.chars[id] = l + 1;
  return { ok: true };
}

export function selectChar(S, id) {
  if (!S.chars[id]) return { ok: false, reason: 'locked' };
  S.selected = id;
  return { ok: true };
}

/** Selected character's perk value at its level. */
export function perk(S) {
  const c = charById(S.selected);
  return { id: c.id, value: c.perk(S.chars[c.id] || 1), level: S.chars[c.id] || 1 };
}

/** Power-up duration in seconds: shop level, stretched by a matching character perk. */
export function powerDuration(S, kind) {
  const base = UPGRADES[kind].dur[S.upgrades[kind] - 1];
  const p = perk(S);
  const match = { bit: 'magnet', moss: 'shield', ember: 'x2' }[p.id];
  return match === kind ? base * (1 + p.value / 100) : base;
}

/**
 * Missions with progress, optionally including an in-progress run.
 * @param {Save} S @param {Record<string, number>} [run] per-type values of the current run
 */
export function missions(S, run = null) {
  return missionSet(S.missions.tier).map((m, i) => {
    let p = S.missions.progress[i];
    if (run) p = m.per === 'run' ? Math.max(p, run[m.type] || 0) : p + (run[m.type] || 0);
    p = Math.min(p, m.target);
    return { ...m, progress: p, done: p >= m.target, claimed: S.missions.claimed[i] };
  });
}

export function claimMission(S, i) {
  const m = missions(S)[i];
  if (!m || !m.done || m.claimed) return { ok: false, reason: 'not-ready' };
  S.missions.claimed[i] = true;
  grant(S, m.reward);
  const lv = addXp(S.level, S.xp, m.xp);
  S.level = lv.level;
  S.xp = lv.xp;
  let tierUp = false;
  if (S.missions.claimed.every(Boolean)) {
    S.missions.tier = Math.min(MAX_TIER, S.missions.tier + 1);
    S.missions.progress = [0, 0, 0];
    S.missions.claimed = [false, false, false];
    tierUp = true;
  }
  return { ok: true, reward: m.reward, xp: m.xp, levelUps: lv.ups, tierUp };
}

export function claimDaily(S, today) {
  const st = dailyStatus(S.daily, today);
  if (!st.claimable) return { ok: false, reason: 'claimed' };
  const prize = DAILY[st.slot];
  grant(S, prize);
  S.daily = { last: today, streak: st.slot + 1 };
  return { ok: true, prize, slot: st.slot };
}

/**
 * Bank a finished run into the save.
 * @param {Save} S
 * @param {{score: number, meters: number, cells: number, gems: number, stats: Record<string, number>}} run
 */
export function applyRun(S, run) {
  const before = missions(S).map((m) => m.done);
  const sets = missionSet(S.missions.tier);
  sets.forEach((m, i) => {
    const v = run.stats[m.type] || 0;
    S.missions.progress[i] = m.per === 'run' ? Math.max(S.missions.progress[i], v) : S.missions.progress[i] + v;
  });
  const newlyDone = missions(S).filter((m, i) => m.done && !before[i]).length;
  const isBest = run.score > S.best;
  if (isBest) S.best = run.score;
  S.cells += run.cells;
  S.gems += run.gems;
  S.runs++;
  const xp = runXp(run.meters, run.cells);
  const lv = addXp(S.level, S.xp, xp);
  S.level = lv.level;
  S.xp = lv.xp;
  if (lv.ups) S.gems += 2 * lv.ups; // small level-up gift
  return { xp, levelUps: lv.ups, isBest, newlyDone };
}

/** Red-dot state for the bottom navigation. */
export function badges(S, today) {
  const shop =
    Object.keys(UPGRADES).some((k) => {
      const c = upgradeCost(S.upgrades[k]);
      return c != null && c <= S.cells;
    }) || S.items.mystery > 0;
  const chars = CHARACTERS.some((c) => {
    if (!S.chars[c.id]) return c.unlock && (!c.unlock.level || S.level >= c.unlock.level) && canAfford(S, c.unlock);
    const cost = charUpgradeCost(S.chars[c.id]);
    return cost != null && cost <= S.cells;
  });
  const daily = dailyStatus(S.daily, today).claimable;
  const missionsReady = missions(S).some((m) => m.done && !m.claimed);
  return { shop, chars, missions: missionsReady || daily, daily };
}

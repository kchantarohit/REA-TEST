// Meta-game actions on the save data: purchases, characters and outfits, missions, daily
// reward, daily word, achievements, mystery parcel and banking a finished run. Pure (no DOM); every action validates and
// returns {ok, ...} instead of throwing, so the UI can show an error shake.
import {
  ACHIEVEMENTS, CHARACTERS, DAILY, ITEMS, MAX_TIER, OUTFIT_PRICE, UPGRADES, WORD_GEMS, addXp, charById, charUpgradeCost,
  dailyStatus, missionSet, rollMystery, runXp, upgradeCost, wordOfDay,
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
  return { ok: true, unlocked: checkAchievements(S) };
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

/** Selected character's perk at its level. */
export function perk(S) {
  const c = charById(S.selected);
  return { id: c.id, kind: c.perkKind, value: c.perk(S.chars[c.id] || 1), level: S.chars[c.id] || 1 };
}

/** Buy (if needed) and wear outfit `idx` for character `id`. Locked characters can't shop. */
export function wearOutfit(S, id, idx) {
  const o = S.outfits[id];
  if (!o || !S.chars[id] || !(idx in OUTFIT_PRICE)) return { ok: false, reason: 'locked' };
  if (!o.own.includes(idx)) {
    if (!pay(S, { gems: OUTFIT_PRICE[idx] })) return { ok: false, reason: 'funds' };
    o.own.push(idx);
    o.own.sort((a, b) => a - b);
    o.sel = idx;
    return { ok: true, bought: true };
  }
  o.sel = idx;
  return { ok: true, bought: false };
}

// ---------- daily word ----------
/** Today's word state; a new day starts with no letters. */
export function wordStatus(S, today) {
  if (S.word.day !== today) S.word = { day: today, got: [false, false, false, false, false], claimed: false };
  const word = wordOfDay(today);
  const next = S.word.got.indexOf(false);
  return { word, got: S.word.got, next, done: next < 0, claimed: S.word.claimed };
}
/** Collect the next missing letter; returns its index, or -1 when the word is complete. */
export function collectLetter(S, today) {
  const st = wordStatus(S, today);
  if (st.done) return -1;
  S.word.got[st.next] = true;
  return st.next;
}
export function claimWord(S, today) {
  const st = wordStatus(S, today);
  if (!st.done || st.claimed) return { ok: false, reason: 'not-ready' };
  S.word.claimed = true;
  S.gems += WORD_GEMS;
  S.stats.words++;
  return { ok: true, prize: { gems: WORD_GEMS }, unlocked: checkAchievements(S) };
}

// ---------- achievements ----------
const statOf = (S, stat) => (stat === 'crew' ? Object.keys(S.chars).length : S.stats[stat] || 0);
export function achievements(S) {
  return ACHIEVEMENTS.map((a) => {
    const v = Math.min(a.target, statOf(S, a.stat));
    return { ...a, progress: v, done: S.ach.includes(a.id) };
  });
}
/** Unlock (and pay out) every achievement whose target is met; returns the new ones. */
export function checkAchievements(S) {
  const fresh = ACHIEVEMENTS.filter((a) => !S.ach.includes(a.id) && statOf(S, a.stat) >= a.target);
  for (const a of fresh) {
    S.ach.push(a.id);
    S.gems += a.gems;
  }
  return fresh;
}

/** Power-up duration in seconds: shop level, stretched by a matching character perk. */
export function powerDuration(S, kind) {
  const base = UPGRADES[kind].dur[S.upgrades[kind] - 1];
  const p = perk(S);
  return p.kind === kind ? base * (1 + p.value / 100) : base;
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
 *   run.stats also carries the lifetime counters: jumps, rolls, bestCombo, escapes, caught, scooter, stage.
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
  const t = S.stats;
  const r = run.stats;
  t.runs = S.runs;
  t.meters += run.meters;
  t.bestMeters = Math.max(t.bestMeters, run.meters);
  t.sparks += run.cells;
  t.gems += run.gems;
  t.jumps += r.jumps || 0;
  t.rolls += r.rolls || 0;
  t.bestCombo = Math.max(t.bestCombo, r.bestCombo || 0);
  t.escapes += r.escapes || 0;
  t.caught += r.caught || 0;
  t.scooters += r.scooter || 0;
  t.stage = Math.max(t.stage, r.stage || 1);
  const unlocked = checkAchievements(S);
  return { xp, levelUps: lv.ups, isBest, newlyDone, unlocked };
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
  const w = wordStatus(S, today);
  return { shop, chars, missions: missionsReady || daily, daily, word: w.done && !w.claimed };
}

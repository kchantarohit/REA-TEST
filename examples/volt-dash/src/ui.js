// DOM screens, sheets and HUD. Static markup lives in index.html; lists and sheets are
// rendered here from catalog data. Every interactive element carries data-act (+ data-arg)
// and one delegated click handler forwards it to main.js as h.act(act, arg, element).
import {
  CHARACTERS, DAILY, ITEMS, MAX_CHAR_LEVEL, MAX_UPGRADE, OUTFIT_PRICE, UPGRADES, WORD_GEMS, charUpgradeCost, upgradeCost, xpForLevel,
} from './catalog.js';
import { STAGE_COLORS } from './track.js';
import { ICONS, icon } from './icons.js';

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : String(Math.floor(n)));
const comma = (n) => Math.floor(n).toLocaleString('en-US');
const priceHtml = (p) =>
  [p.cells ? `${icon('cell')}${fmt(p.cells)}` : '', p.gems ? `${icon('gem')}${fmt(p.gems)}` : ''].filter(Boolean).map((x) => `<span class="price">${x}</span>`).join(' ');
const prizeHtml = (p) =>
  p.cells ? `${icon('cell')}<b>${fmt(p.cells)}</b>` : p.gems ? `${icon('gem')}<b>${p.gems}</b>` : `${icon(p.item)}<b>${ITEMS[p.item]?.name || ''}</b>`;
/** Sticker colours (tile backgrounds) per upgrade / supply. */
const TILE = {
  magnet: '#ff8aa6', spring: '#7ff0b0', shield: '#7fe3ff', x2: '#ffd36b', hyper: '#c9a8ff',
  headstart: '#c9a8ff', revive: '#ff8aa6', booster: '#ffd36b', scooter: '#7fe3ff', mystery: '#f5b98a',
};
const TONE = { good: '#7ff0b0', bad: '#ff8a8e', gold: '#ffd36b', info: '#7fe3ff' };
const TUTORIAL = [null, ['swipeH', 'Swipe left or right to switch lanes'], ['swipeUp', 'Swipe up to jump'], ['swipeDown', 'Swipe down to slide']];
const STAT_ROWS = [
  ['flag', 'Shifts run', (s) => s.runs],
  ['trophy', 'Best score', (s, S) => S.best],
  ['road', 'Distance, all time', (s) => `${comma(s.meters)} m`],
  ['road', 'Longest run', (s) => `${comma(s.bestMeters)} m`],
  ['cell', 'Sparks collected', (s) => comma(s.sparks)],
  ['gem', 'Gems found on the road', (s) => comma(s.gems)],
  ['combo', 'Best combo', (s) => s.bestCombo],
  ['jump', 'Jumps', (s) => comma(s.jumps)],
  ['roll', 'Slides', (s) => comma(s.rolls)],
  ['escape', 'Times you shook Clank', (s) => s.escapes],
  ['siren', 'Times Clank got you', (s) => s.caught],
  ['scooter', 'Scooter rides', (s) => s.scooters],
  ['word', 'Daily words spelled', (s) => s.words],
];

/** A tiny portrait of a courier for the profile badge (skin, hair style and outfit colours). */
export function avatarSvg(c, outfit) {
  const L = c.look;
  const hair = {
    twists: `<path d="M13 21c0-8 5-12 11-12s11 4 11 12" fill="${L.hair}"/>${[14, 18, 22, 26, 30, 34].map((x) => `<rect x="${x - 1.6}" y="${7 + Math.abs(x - 24) * 0.25}" width="3.2" height="7" rx="1.6" fill="${L.hair}"/>`).join('')}`,
    bob: `<path d="M12 30c-1-12 4-19 12-19s13 7 12 19l-4 1c0-6-2-10-4-12-4 3-10 4-14 4l-1 7z" fill="${L.hair}"/>`,
    puff: `<circle cx="24" cy="9" r="7.5" fill="${L.hair}"/><path d="M13 21c0-7 5-10 11-10s11 3 11 10" fill="${L.hair}"/>`,
    wrap: `<path d="M10 40c-1-6 1-10 3-13-1-10 4-17 11-17s12 7 11 17c2 3 4 7 3 13z" fill="${outfit.acc}"/>`,
    shaved: `<path d="M14 20c1-6 5-8.5 10-8.5s9 2.5 10 8.5" fill="${L.hair}" opacity=".9"/>`,
    short: `<path d="M13.5 21c0-7 4.5-10 10.5-10s10.5 3 10.5 10c-3-2-7-3.5-10.5-3.5S16.5 19 13.5 21z" fill="${L.hair}"/>`,
  }[L.hairStyle] || '';
  const acc = {
    headphones: `<path d="M12.5 24c0-8 5-13 11.5-13s11.5 5 11.5 13" fill="none" stroke="${outfit.acc}" stroke-width="2.4"/><rect x="10" y="22" width="5" height="8" rx="2.5" fill="${outfit.acc}"/><rect x="33" y="22" width="5" height="8" rx="2.5" fill="${outfit.acc}"/>`,
    bigphones: `<path d="M11.5 24c0-9 5.5-14 12.5-14s12.5 5 12.5 14" fill="none" stroke="${outfit.acc}" stroke-width="3"/><rect x="8.5" y="21" width="6.5" height="10" rx="3.2" fill="${outfit.acc}"/><rect x="33" y="21" width="6.5" height="10" rx="3.2" fill="${outfit.acc}"/>`,
    beanie: `<path d="M13.5 20c0-7 4.5-11 10.5-11s10.5 4 10.5 11z" fill="${outfit.acc}"/><rect x="12.5" y="18" width="23" height="4" rx="2" fill="${outfit.acc}" stroke="#26122f" stroke-opacity=".25"/>`,
    flatcap: `<path d="M13 19c1-5 5-8 11-8s10 3 11 8z" fill="${outfit.acc}"/><path d="M12 19h17l-2 3H11z" fill="${outfit.acc}"/>`,
    scarf: '',
  }[L.acc] || '';
  const beard = L.beard ? `<path d="M15.5 27c1 6 4.5 9 8.5 9s7.5-3 8.5-9c-2 2-5 2.5-8.5 2.5S17.5 29 15.5 27z" fill="${L.hair}"/>` : '';
  const glasses = L.glasses ? '<g fill="none" stroke="#26122f" stroke-width="1.3"><circle cx="20" cy="24" r="2.8"/><circle cx="28" cy="24" r="2.8"/><path d="M22.8 24h2.4"/></g>' : '';
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" fill="${c.color}"/>
    <path d="M8 48c1-8 7-12 16-12s15 4 16 12z" fill="${outfit.top}"/><path d="M20 36l4 5 4-5" fill="none" stroke="${outfit.top2}" stroke-width="2"/>
    <rect x="21" y="30" width="6" height="7" fill="${L.skin}"/><ellipse cx="24" cy="23.5" rx="10" ry="11.5" fill="${L.skin}"/>
    ${hair}<circle cx="20" cy="24" r="1.3" fill="#26122f"/><circle cx="28" cy="24" r="1.3" fill="#26122f"/>
    <path d="M21 29.5c1.8 1.3 4.2 1.3 6 0" fill="none" stroke="#26122f" stroke-width="1.3" stroke-linecap="round"/>${beard}${glasses}${acc}</svg>`;
}

/**
 * @param {{act: (act: string, arg: string|undefined, el: HTMLElement) => void}} h
 */
export function createUI(h) {
  const el = {
    menu: $('menu'), hud: $('hud'), pause: $('pause'), revive: $('revive'), over: $('over'), fatal: $('fatal'),
    score: $('score'), cells: $('cells'), gems: $('gems'), mult: $('hud-mult'), powers: $('powers'),
    stageBadge: $('stage-badge'), stageFill: $('stage-fill'), layer: $('layer-slot'), toasts: $('toasts'),
    combo: $('combo'), comboN: $('combo-n'), comboFill: $('combo-fill'), comboX: $('combo-x'), pops: $('pops'),
    letters: $('letters'), vignette: $('vignette'), warn: $('warn-slot'),
  };
  const fillIcons = (root) => root.querySelectorAll('[data-icon]').forEach((n) => (n.innerHTML = ICONS[n.dataset.icon] || ''));
  fillIcons(document);

  // Static buttons -> actions.
  const wire = (sel, act, arg) => document.querySelectorAll(sel).forEach((n) => {
    n.dataset.act = act;
    if (arg !== undefined) n.dataset.arg = arg;
  });
  wire('#btn-play', 'play');
  wire('#btn-settings', 'settings');
  wire('#btn-wallet', 'shop', 'upgrades');
  wire('#btn-profile', 'tab', 'trophies');
  wire('#btn-daily', 'daily');
  wire('#btn-word', 'word');
  wire('[data-go="missions"]', 'tab', 'missions');
  document.querySelectorAll('.nav-btn').forEach((n) => wire(`.nav-btn[data-tab="${n.dataset.tab}"]`, 'tab', n.dataset.tab));
  document.querySelectorAll('[data-shop-tab]').forEach((n) => wire(`[data-shop-tab="${n.dataset.shopTab}"]`, 'shop-tab', n.dataset.shopTab));
  document.querySelectorAll('[data-trophy-tab]').forEach((n) => wire(`[data-trophy-tab="${n.dataset.trophyTab}"]`, 'trophy-tab', n.dataset.trophyTab));
  wire('#btn-pause', 'pause');
  wire('#btn-resume', 'resume');
  wire('[data-open="settings"]', 'settings');
  wire('#btn-quit', 'quit');
  wire('#btn-revive-token', 'rv-token');
  wire('#btn-revive-gems', 'rv-gems');
  wire('#btn-revive-skip', 'rv-skip');
  wire('[data-home]', 'home');
  wire('#btn-again', 'again');
  wire('#char-prev', 'char', '-1');
  wire('#char-next', 'char', '1');

  document.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target).closest('[data-act]');
    if (!t || t.hasAttribute('disabled')) return;
    e.stopPropagation();
    h.act(t.dataset.act, t.dataset.arg, /** @type {HTMLElement} */ (t));
  });

  // Swipe on the character preview area browses the crew.
  const stage = $('char-stage');
  let sx = null;
  stage.addEventListener('touchstart', (e) => (sx = e.changedTouches[0].clientX), { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 40) h.act('char', dx < 0 ? '1' : '-1', stage);
  });

  const ORDER = ['home', 'shop', 'chars', 'missions', 'trophies'];
  let tab = 'home';
  let sheet = null;
  let reviveTimer = 0;
  const shown = { score: -1, cells: -1, gems: -1, mult: '', stage: 0, combo: -1, danger: -1 };
  const pw = {};

  function setTab(name) {
    const from = ORDER.indexOf(tab);
    const to = ORDER.indexOf(name);
    tab = name;
    for (const id of ORDER) {
      const p = $(`page-${id}`);
      p.classList.toggle('active', id === name);
      p.classList.toggle('left', ORDER.indexOf(id) < to || (id !== name && ORDER.indexOf(id) === from && from < to));
    }
    document.querySelectorAll('.nav-btn').forEach((n) => n.classList.toggle('active', n.dataset.tab === name));
  }

  // ---------- menu rendering ----------
  const charOf = (S) => CHARACTERS.find((x) => x.id === S.selected) || CHARACTERS[0];
  const wornOf = (S, c) => c.outfits[S.outfits[c.id].sel];

  function renderTop(S) {
    $('lvl').textContent = String(S.level);
    $('xp-fill').style.width = `${Math.min(100, (100 * S.xp) / xpForLevel(S.level)).toFixed(1)}%`;
    $('cur-cells').textContent = fmt(S.cells);
    $('cur-gems').textContent = fmt(S.gems);
    const c = charOf(S);
    $('avatar').innerHTML = avatarSvg(c, wornOf(S, c));
  }

  function renderHome(S, v) {
    $('home-best').textContent = comma(S.best);
    $('home-mult').textContent = v.mult;
    const c = charOf(S);
    $('home-char').innerHTML = `<b>${esc(c.name)}</b><span>${esc(c.role)} &middot; Level ${S.chars[c.id]}</span><q>${esc(c.bio)}</q>`;
    $('mini-word').innerHTML = v.word.got.map((g, i) => `<i class="${g ? 'on' : ''}">${g ? v.word.word[i] : ''}</i>`).join('');
    $('word-dot').hidden = !v.badges.word;
    $('daily-dot').hidden = !v.badges.daily;
    $('daily-sub').textContent = v.daily.claimable ? `Day ${v.daily.slot + 1} is ready` : 'Back tomorrow';
    $('jobs-sub').textContent = `${v.missions.filter((m) => m.claimed).length} of 3 done`;
    for (const k of ['shop', 'chars', 'missions']) /** @type {HTMLElement} */ (document.querySelector(`[data-badge="${k}"]`)).hidden = !v.badges[k];
  }

  function renderShop(S, v) {
    document.querySelectorAll('[data-shop-tab]').forEach((n) => n.classList.toggle('active', n.dataset.shopTab === v.shopTab));
    const list = $('shop-list');
    if (v.shopTab === 'upgrades') {
      list.innerHTML = Object.entries(UPGRADES).map(([k, u]) => {
        const lvl = S.upgrades[k];
        const cost = upgradeCost(lvl);
        const ticks = Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        const stat = cost == null ? `${u.dur[lvl - 1]}s` : `${u.dur[lvl - 1]}s ${icon('go', 'ic to')}<span class="to">${u.dur[lvl]}s</span>`;
        const btn = cost == null
          ? '<span class="maxed">Maxed</span>'
          : `<button class="btn sm ${cost > S.cells ? 'poor' : 'buy'}" data-act="up" data-arg="${k}" aria-label="Upgrade ${u.name} for ${cost} Sparks">${priceHtml({ cells: cost })}</button>`;
        return `<div class="label row-card"><div class="tile" style="--c:${TILE[k]}">${icon(k)}</div>
          <div class="rc-body"><h3>${u.name}</h3><p>${u.desc}</p><div class="ticks" aria-label="Level ${lvl} of ${MAX_UPGRADE}">${ticks}</div><div class="stat-line">${icon('timer')}${stat}</div></div>
          <div class="rc-act">${btn}</div></div>`;
      }).join('');
    } else {
      list.innerHTML = Object.entries(ITEMS).map(([k, it]) => {
        const poor = (it.price.cells || 0) > S.cells || (it.price.gems || 0) > S.gems;
        const open = k === 'mystery' && S.items.mystery > 0 ? `<button class="btn sm ok" data-act="open-box">Open</button>` : '';
        return `<div class="label row-card"><div class="tile" style="--c:${TILE[k]}">${icon(k)}${S.items[k] ? `<span class="count">x${S.items[k]}</span>` : ''}</div>
          <div class="rc-body"><h3>${it.name}</h3><p>${it.desc}</p></div>
          <div class="rc-act"><button class="btn sm ${poor ? 'poor' : 'buy'}" data-act="item" data-arg="${k}" aria-label="Buy ${it.name}">${priceHtml(it.price)}</button>${open}</div></div>`;
      }).join('');
    }
  }

  function renderChars(S, v) {
    const c = CHARACTERS[v.charIndex];
    const lvl = S.chars[c.id] || 0;
    const owned = lvl > 0;
    $('char-count').textContent = `${Object.keys(S.chars).length} of ${CHARACTERS.length} hired`;
    $('char-dots').innerHTML = CHARACTERS.map((_, i) => `<i class="${i === v.charIndex ? 'on' : ''}"></i>`).join('');
    const shownLvl = Math.max(1, lvl);
    const stars = Array.from({ length: MAX_CHAR_LEVEL }, (_, i) => icon('star', `ic ${i < lvl ? 'on' : ''}`)).join('');
    const cost = owned ? charUpgradeCost(lvl) : null;
    const next = owned && cost != null ? `<small>Next level: ${esc(c.perkText(lvl + 1))}</small>` : owned ? '<small>Max level. Legend status.</small>' : '<small>Hire them to use this perk.</small>';
    const o = S.outfits[c.id];
    const pick = v.outfitPick;
    const swatches = c.outfits.map((f, i) => {
      const own = o.own.includes(i);
      const cls = `${pick === i ? 'pick' : !own || pick >= 0 ? '' : o.sel === i ? 'on' : ''}`;
      const tag = own ? (o.sel === i && pick < 0 ? `<span class="tag">${icon('check')}</span>` : '') : `<span class="tag">${icon('gem')}${OUTFIT_PRICE[i]}</span>`;
      return `<button class="swatch ${cls}" style="--a:${f.top};--b:${f.top2};--d:${f.legs}" data-act="outfit" data-arg="${i}" aria-label="${esc(f.name)} outfit${own ? '' : `, ${OUTFIT_PRICE[i]} Gems`}">${tag}</button>`;
    }).join('');
    const shownFit = c.outfits[pick >= 0 ? pick : o.sel];
    let actions;
    if (!owned) {
      const gate = c.unlock.level && S.level < c.unlock.level;
      const poor = (c.unlock.cells || 0) > S.cells || (c.unlock.gems || 0) > S.gems;
      actions = gate
        ? `<button class="btn" disabled>${icon('lock')}Reach level ${c.unlock.level}</button>`
        : `<button class="btn ${poor ? 'poor' : 'buy'}" data-act="char-unlock" data-arg="${c.id}">Hire ${priceHtml(c.unlock)}</button>`;
    } else if (pick >= 0) {
      actions = `<button class="btn ghost on-paper" data-act="outfit" data-arg="${o.sel}">Keep current</button>
        <button class="btn ${OUTFIT_PRICE[pick] > S.gems ? 'poor' : 'buy'}" data-act="outfit-buy">Buy ${priceHtml({ gems: OUTFIT_PRICE[pick] })}</button>`;
    } else {
      const sel = S.selected === c.id
        ? `<button class="btn ghost on-paper" disabled>${icon('check')}On shift</button>`
        : `<button class="btn ok" data-act="char-select" data-arg="${c.id}">Pick ${esc(c.name.split(' ')[0])}</button>`;
      const up = cost == null
        ? '<button class="btn ghost on-paper" disabled>Maxed</button>'
        : `<button class="btn ${cost > S.cells ? 'poor' : 'buy'}" data-act="char-upgrade" data-arg="${c.id}" aria-label="Train for ${cost} Sparks">${icon('booster')}${priceHtml({ cells: cost })}</button>`;
      actions = sel + up;
    }
    $('char-card').innerHTML = `<div class="char-head"><h3>${esc(c.name)}</h3><span class="stars" aria-label="Level ${owned ? lvl : 0} of ${MAX_CHAR_LEVEL}">${stars}</span></div>
      <p class="char-role">${esc(c.role)}</p>
      <p class="char-bio">&ldquo;${esc(c.bio)}&rdquo;</p>
      <div class="char-perk">${icon('combo')}<div>${esc(c.perkText(shownLvl))}${next}</div></div>
      <div class="outfits"><span>Fits</span>${swatches}<span class="outfit-name">${esc(shownFit.name)}</span></div>
      <div class="char-actions">${actions}</div>`;
  }

  function renderMissions(S, v) {
    const tier = S.missions.tier;
    const claimed = S.missions.claimed.filter(Boolean).length;
    $('tier-card').innerHTML = `<div class="tier-num">x${tier}</div><div class="tier-txt"><h3>Score multiplier x${tier}</h3>
      <p>${tier >= 30 ? 'Top of the board. Nothing left to prove.' : `Finish all three jobs to reach x${tier + 1}.`}</p>
      <div class="ticks">${[0, 1, 2].map((i) => `<i class="${i < claimed ? 'on' : ''}"></i>`).join('')}</div></div>`;
    $('mission-list').innerHTML = v.missions.map((m, i) => {
      const pct = Math.min(100, (100 * m.progress) / m.target);
      const reward = m.reward.cells ? `${icon('cell')}${m.reward.cells}` : `${icon('gem')}${m.reward.gems}`;
      const act = m.claimed
        ? `<span class="m-claimed got" aria-label="Claimed">${icon('check')}</span>`
        : m.done
          ? `<button class="btn sm ok pop-in" data-act="claim" data-arg="${i}">Claim</button>`
          : `<span class="m-claimed" aria-label="In progress">${icon('missions')}</span>`;
      return `<div class="label m-card ${m.done ? 'done' : ''}"><h4>${esc(m.text)}</h4><div class="m-act">${act}</div>
        <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="m-meta"><span class="num">${fmt(m.progress)} / ${fmt(m.target)}</span><span class="reward">${reward} &middot; ${m.xp} XP</span></div></div>`;
    }).join('');
    const w = v.word;
    $('word-card').innerHTML = `<div class="tile" style="--c:#ff8aa6">${icon('word')}</div><div class="rc-body"><h3>Word hunt</h3>
      <p>${w.claimed ? 'Spelled and paid. New word tomorrow.' : w.done ? `You spelled ${w.word}. Claim ${WORD_GEMS} Gems!` : `${w.got.filter(Boolean).length} of 5 letters found today.`}</p></div>
      <button class="btn sm ${w.done && !w.claimed ? 'ok' : 'ghost on-paper'}" data-act="word">${w.done && !w.claimed ? 'Claim' : 'Look'}</button>`;
    const d = v.daily;
    $('daily-card').innerHTML = `<div class="tile" style="--c:#ffd36b">${icon('calendar')}</div><div class="rc-body"><h3>Daily drop</h3>
      <p>${d.claimable ? `Day ${d.slot + 1} is waiting for you.` : 'Picked up. Come back tomorrow.'}</p></div>
      <button class="btn sm ${d.claimable ? 'buy' : 'ghost on-paper'}" data-act="daily">${d.claimable ? 'Open' : 'Look'}</button>`;
  }

  function renderTrophies(S, v) {
    document.querySelectorAll('[data-trophy-tab]').forEach((n) => n.classList.toggle('active', n.dataset.trophyTab === v.trophyTab));
    const list = v.achievements;
    $('ach-count').textContent = `${list.filter((a) => a.done).length} of ${list.length}`;
    const body = $('trophy-body');
    const top = body.scrollTop;
    if (v.trophyTab === 'stats') {
      body.innerHTML = `<div class="label logbook">${STAT_ROWS.map(([ic, label, f]) => `<div class="log-row">${icon(ic)}${label}<b>${f(S.stats, S)}</b></div>`).join('')}</div>`;
    } else {
      const ic = { runs: 'flag', meters: 'road', bestMeters: 'road', sparks: 'cell', jumps: 'jump', rolls: 'roll', bestCombo: 'combo', escapes: 'escape', caught: 'siren', scooters: 'scooter', words: 'word', stage: 'star', crew: 'chars' };
      body.innerHTML = `<div class="ach-grid">${list.map((a) => `<div class="badge ${a.done ? 'done' : ''}"><span class="medal">${icon(ic[a.stat] || 'trophy')}</span>
        <h4>${esc(a.name)}</h4><p>${esc(a.desc)}</p><div class="bar"><i style="width:${((100 * a.progress) / a.target).toFixed(1)}%"></i></div>
        <div class="meta"><span class="num">${fmt(a.progress)}/${fmt(a.target)}</span><span class="reward">${icon('gem')}${a.gems}</span></div></div>`).join('')}</div>`;
    }
    body.scrollTop = top;
  }

  // ---------- sheets ----------
  function openLayer(html, center = false, name = '') {
    el.layer.innerHTML = `<div class="layer ${center ? 'center' : ''}" data-sheet="${name}"><div class="backdrop" data-act="close"></div>${html}</div>`;
    fillIcons(el.layer);
    sheet = name;
    const primary = /** @type {HTMLElement|null} */ (el.layer.querySelector('.btn.go, .btn.ok, .btn.buy, .road-btn'));
    primary?.focus({ preventScroll: true });
  }
  const sheetHead = (title, sub = '') => `<div class="sheet-head"><h2>${title}${sub ? `<small>${sub}</small>` : ''}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close')}</button></div>`;
  const sw = (on, act, arg, label, disabled = false) =>
    `<button class="switch" role="switch" aria-checked="${on}" aria-label="${label}" data-act="${act}" data-arg="${arg}" ${disabled ? 'disabled' : ''}></button>`;

  const SHEETS = {
    settings(S) {
      const st = S.settings;
      const row = (ic, label, key) => `<div class="set-row">${icon(ic)}<span class="lbl">${label}</span>${sw(st[key], 'set', key, label)}</div>`;
      return `<div class="sheet">${sheetHead('Settings')}
        ${row('sound', 'Sound effects', 'sound')}${row('music', 'Music', 'music')}${row('vibe', 'Vibration', 'vibe')}
        <div class="set-row">${icon('quality')}<span class="lbl">Graphics<br><small style="font-size:12px;color:var(--text-3);font-weight:600">Low trims weather and particles</small></span><div class="seg">
          <button class="${st.quality === 'low' ? 'on' : ''}" data-act="quality" data-arg="low">Low</button>
          <button class="${st.quality === 'high' ? 'on' : ''}" data-act="quality" data-arg="high">High</button></div></div>
        <div class="set-row" style="border:0">${icon('reset')}<span class="lbl">Progress</span><button class="btn sm danger" data-act="reset">Reset</button></div>
        <div class="version">Volt Dash 3.0 &middot; plays offline</div></div>`;
    },
    loadout(S) {
      const rows = Object.entries(ITEMS).filter(([, it]) => it.loadout).map(([k, it]) => {
        const n = S.items[k];
        const on = n > 0 && S.loadout[k];
        return `<div class="label lo-row ${n ? '' : 'off'}"><div class="tile" style="--c:${TILE[k]}">${icon(k)}<span class="count">x${n}</span></div>
          <div class="rc-body"><h3>${it.name}</h3><p>${it.desc}</p></div>${sw(on, 'lo', k, `Use ${it.name}`, !n)}</div>`;
      }).join('');
      return `<div class="sheet">${sheetHead('Kit up', 'Switched-on supplies get used this run.')}<div class="scroll" style="flex:none;max-height:50vh;padding-top:4px">${rows}</div>
        <p class="lo-hint">Running low? <button data-act="shop" data-arg="items">Pop into the shop</button></p>
        <button class="road-btn" data-act="go">Go go go${icon('go', 'ic arrow')}</button></div>`;
    },
    daily(S, v) {
      const d = v.daily;
      const streak = S.daily.streak;
      const tiles = DAILY.map((p, i) => {
        const got = d.claimable ? i < d.slot : i <= d.slot && streak > 0;
        const today = d.claimable && i === d.slot;
        return `<div class="day ${i === 6 ? 'big' : ''} ${got ? 'got' : ''} ${today ? 'today' : ''}">${got ? icon('check', 'ic done-mark') : ''}Day ${i + 1}${prizeHtml(p)}</div>`;
      }).join('');
      return `<div class="sheet">${sheetHead('Daily drop', 'Come back every day. Miss one and the week restarts.')}<div class="daily-grid">${tiles}</div>
        <button class="btn ${d.claimable ? 'buy' : 'ghost'}" style="width:100%;min-height:58px" data-act="claim-daily" ${d.claimable ? '' : 'disabled'}>
        ${d.claimable ? 'Grab today\'s drop' : 'Back tomorrow'}</button></div>`;
    },
    word(S, v) {
      const w = v.word;
      const tiles = w.word.split('').map((ch, i) => `<i class="${w.got[i] ? 'on' : i === w.next ? 'next' : ''}">${w.got[i] || i === w.next ? ch : ''}</i>`).join('');
      const note = w.claimed
        ? 'Paid out. A fresh word lands tomorrow.'
        : w.done
          ? `Every letter found. ${WORD_GEMS} Gems are yours.`
          : `Letter stickers float on the road. Grab <b style="color:var(--amber)">${w.word[w.next]}</b> next. Letters stay found all day, even if a run goes wrong.`;
      return `<div class="sheet">${sheetHead('Word hunt', 'One five-letter word a day.')}<div class="word-tiles">${tiles}</div>
        <p class="word-note">${note}</p>
        <button class="btn ${w.done && !w.claimed ? 'ok' : 'ghost'}" style="width:100%;min-height:58px" data-act="claim-word" ${w.done && !w.claimed ? '' : 'disabled'}>
        ${w.done && !w.claimed ? `Claim ${icon('gem')} ${WORD_GEMS} Gems` : w.claimed ? 'Claimed' : 'Keep hunting'}</button></div>`;
    },
    confirm() {
      return `<div class="modal"><h2>Start over?</h2><p>All Sparks, Gems, upgrades, crew, outfits, jobs and trophies will be wiped. There is no undo.</p>
        <div class="stack"><button class="btn danger" data-act="reset-yes">Wipe everything</button><button class="btn ghost on-paper" data-act="close">Keep my progress</button></div></div>`;
    },
  };

  function parcelSvg() {
    return `<svg viewBox="0 0 150 140"><g stroke="#26122f" stroke-width="4" stroke-linejoin="round">
      <path d="M24 60 L126 58 L122 130 L28 132 Z" fill="#d99a5e"/><path d="M68 59 L82 59 L81 131 L69 131 Z" fill="#fff1dc"/>
      <path d="M40 86 l20 -1 M40 98 l14 0" stroke-width="3" fill="none" opacity=".55"/>
      <g class="lid"><path d="M16 42 L134 40 L132 64 L18 66 Z" fill="#eab074"/><path d="M66 41 L84 41 L84 65 L66 65 Z" fill="#fff1dc"/></g></g>
      <path d="M100 82 l10 -2 -3 10z" fill="#ff4f7b"/></svg>`;
  }

  // ---------- toasts / currency fly ----------
  function toast({ ic = 'star', tone = 'info', title, sub = '' }) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="tile" style="--c:${TONE[tone] || TONE.info}">${icon(ic)}</span><div>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 2) el.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 2950);
  }

  function fly(kind, from, n = 8, reverse = false) {
    const target = $('btn-wallet');
    if (!from || el.menu.hidden || !target.offsetParent) return;
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    let [x0, y0, x1, y1] = [a.left + a.width / 2, a.top + a.height / 2, b.left + (kind === 'gems' ? b.width * 0.75 : b.width * 0.25), b.top + b.height / 2];
    if (reverse) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (let i = 0; i < (still ? 1 : n); i++) {
      const f = document.createElement('div');
      f.className = 'fly';
      f.innerHTML = ICONS[kind === 'gems' ? 'gem' : 'cell'];
      document.body.appendChild(f);
      const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 140;
      const my = Math.min(y0, y1) - 40 - Math.random() * 80;
      const anim = f.animate(
        still
          ? [{ transform: `translate(${x1}px,${y1}px)`, opacity: 0 }, { transform: `translate(${x1}px,${y1}px)`, opacity: 1 }, { transform: `translate(${x1}px,${y1}px)`, opacity: 0 }]
          : [
            { transform: `translate(${x0}px,${y0}px) scale(.6)`, opacity: 0 },
            { transform: `translate(${mx}px,${my}px) scale(1.15) rotate(20deg)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${x1}px,${y1}px) scale(.7)`, opacity: 1 },
          ],
        { duration: 620 + i * 45, delay: i * 35, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'backwards' },
      );
      anim.onfinish = () => {
        f.remove();
        if (i === n - 1 || still) bump(target);
      };
    }
  }
  function bump(node) {
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }
  function shake(node) {
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
  }

  function countUp(node, to, ms, delay = 0, suffix = '') {
    const t0 = performance.now() + delay;
    const tick = (now) => {
      const k = Math.min(1, Math.max(0, (now - t0) / ms));
      node.textContent = comma(Math.round(to * (1 - (1 - k) ** 3))) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    node.textContent = '0' + suffix;
    requestAnimationFrame(tick);
  }

  function warn(text, calm = false, ic = 'siren') {
    el.warn.innerHTML = `<div class="warn ${calm ? 'calm' : ''}">${icon(ic)}${esc(text)}</div>`;
  }

  return {
    get tab() {
      return tab;
    },
    get sheet() {
      return sheet;
    },
    setTab,
    /** @param {'menu'|'hud'|'pause'|'revive'|'over'} mode */
    show(mode) {
      el.menu.hidden = mode !== 'menu';
      el.hud.hidden = !['hud', 'pause', 'revive'].includes(mode);
      el.pause.hidden = mode !== 'pause';
      el.revive.hidden = mode !== 'revive';
      el.over.hidden = mode !== 'over';
      if (mode !== 'revive') clearInterval(reviveTimer);
      if (mode !== 'hud') el.pops.innerHTML = '';
      const focus = { menu: 'btn-play', pause: 'btn-resume', over: 'btn-again' }[mode];
      if (focus && !(mode === 'menu' && tab !== 'home')) $(focus).focus({ preventScroll: true });
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    },
    /** Re-render every menu page from the save + derived view state. */
    render(S, v) {
      renderTop(S);
      renderHome(S, v);
      renderShop(S, v);
      renderChars(S, v);
      renderMissions(S, v);
      renderTrophies(S, v);
      if (sheet && SHEETS[sheet] && sheet !== 'confirm') {
        const scroll = el.layer.querySelector('.scroll');
        const top = scroll ? scroll.scrollTop : 0;
        el.layer.querySelector('.sheet, .modal').outerHTML = SHEETS[sheet](S, v);
        fillIcons(el.layer);
        const s2 = el.layer.querySelector('.scroll');
        if (s2) s2.scrollTop = top;
        el.layer.querySelector('.sheet')?.style.setProperty('animation', 'none');
      }
    },
    openSheet(name, S, v) {
      openLayer(SHEETS[name](S, v), name === 'confirm', name);
    },
    /** @returns {boolean} whether a sheet was open */
    closeSheet() {
      const was = !!sheet;
      el.layer.innerHTML = '';
      sheet = null;
      return was;
    },
    /** Animated mystery-parcel opening; reveals the prize after the shake. */
    mystery(prize) {
      openLayer(`<div class="modal"><h2>Mystery Parcel</h2><div class="parcel shaking" id="box-art">${parcelSvg()}</div>
        <div class="prize" id="box-prize" style="visibility:hidden">${prizeHtml(prize)}</div>
        <button class="btn buy" style="width:100%" data-act="close" id="box-ok" disabled>Sweet, take it</button></div>`, true, 'mystery');
      setTimeout(() => {
        const art = $('box-art');
        if (!art) return;
        art.classList.remove('shaking');
        art.classList.add('open');
        const p = $('box-prize');
        p.style.visibility = 'visible';
        p.classList.add('pop-in');
        $('box-ok').removeAttribute('disabled');
        $('box-ok').focus({ preventScroll: true });
      }, 900);
    },
    toast,
    fly,
    shake,
    bump,
    // ---------- HUD ----------
    hud(score, cells, gems, mult) {
      const s = Math.floor(score);
      if (s !== shown.score) el.score.textContent = String((shown.score = s));
      if (cells !== shown.cells) el.cells.textContent = String((shown.cells = cells));
      if (gems !== shown.gems) el.gems.textContent = String((shown.gems = gems));
      if (mult !== shown.mult) el.mult.textContent = shown.mult = mult;
    },
    /** @param {Record<string, number>} fracs power kind -> remaining 0..1 (0 = off) */
    powers(fracs, colors) {
      for (const k in fracs) {
        const f = fracs[k];
        if (f > 0 && !pw[k]) {
          const n = document.createElement('div');
          n.className = 'pw';
          n.style.setProperty('--c', colors[k] || '#ff4f7b');
          n.innerHTML = icon(k);
          el.powers.appendChild(n);
          pw[k] = n;
        } else if (f <= 0 && pw[k]) {
          pw[k].remove();
          delete pw[k];
        }
        if (pw[k]) pw[k].style.setProperty('--p', f.toFixed(3));
      }
    },
    /** Combo chip: chain length, how much of the 3 s window is left, current multiplier. */
    combo(n, frac, mult) {
      if (n !== shown.combo) {
        shown.combo = n;
        el.combo.classList.toggle('off', n < 1);
        el.comboN.textContent = n === 1 ? '1 trick' : `${n} tricks`;
        el.comboX.textContent = `x${mult}`;
        if (n > 1) bump(el.combo);
      }
      el.comboFill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac)).toFixed(3)})`;
    },
    comboPop(word, n, mult) {
      const colors = { NICE: '#ff4f7b', GREAT: '#ff8a4c', INSANE: '#8a4dff' };
      const p = document.createElement('div');
      p.className = 'combo-pop';
      p.style.setProperty('--pc', colors[word] || '#ff4f7b');
      p.style.setProperty('--rot', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
      p.innerHTML = `<b>${word}!</b><small>${n} trick combo &middot; score x${mult}</small>`;
      el.pops.replaceChildren(p);
      setTimeout(() => p.remove(), 1100);
    },
    /** Daily-word strip in the HUD; `pop` animates a freshly found letter. */
    letters(w, pop = -1) {
      el.letters.hidden = w.claimed || (w.done && pop < 0);
      el.letters.innerHTML = w.word.split('').map((ch, i) => `<i class="${w.got[i] ? 'on' : ''} ${i === pop ? 'pop' : ''}">${w.got[i] ? ch : ''}</i>`).join('');
    },
    /** 0..1: how close Clank is (red vignette). */
    chase(danger) {
      const d = Math.round(danger * 20) / 20;
      if (d === shown.danger) return;
      shown.danger = d;
      el.vignette.style.opacity = String(d);
      el.vignette.classList.toggle('hot', d > 0.6);
    },
    chaseWarn() {
      warn("Clank's right behind you!");
    },
    chaseEscaped() {
      warn('Lost him. Phew.', true, 'escape');
    },
    caught() {
      $('banner-slot').innerHTML = '';
      el.warn.innerHTML = '';
      el.pops.innerHTML = '<div class="caught-stamp">Swept up!</div>';
    },
    stage(n, frac, name) {
      if (shown.stage !== n) {
        shown.stage = n;
        el.stageBadge.textContent = `Stage ${n} · ${name}`;
        $('pause-stage').textContent = `Stage ${n}, ${name}. Clank is waiting.`;
      }
      el.stageFill.style.width = `${(Math.min(1, frac) * 100).toFixed(1)}%`;
    },
    banner(n, name, themeIndex) {
      const slot = $('banner-slot');
      slot.innerHTML = `<div class="banner" style="--bc:${STAGE_COLORS[themeIndex]}"><small>Stage ${n}</small><b>${esc(name)}</b></div>`;
      setTimeout(() => {
        if (slot.firstElementChild && slot.textContent.includes(name)) slot.innerHTML = '';
      }, 2700);
    },
    clearBanner() {
      $('banner-slot').innerHTML = '';
      el.warn.innerHTML = '';
      el.pops.innerHTML = '';
    },
    tutorial(step) {
      const t = TUTORIAL[step || 0];
      $('tutorial').hidden = !t;
      if (!t) return;
      $('tut-ic').innerHTML = ICONS[t[0]];
      $('tut-txt').textContent = t[1];
    },
    revive({ tokens, tokenOk, cost, gemsOk }, onExpire) {
      $('revive-tokens').textContent = `x${tokens}`;
      $('btn-revive-token').hidden = !tokenOk;
      $('btn-revive-gems').hidden = !gemsOk;
      $('revive-cost').textContent = String(cost);
      const ring = $('revive-ring');
      ring.classList.remove('go');
      void ring.offsetWidth;
      ring.classList.add('go');
      let n = 5;
      $('revive-n').textContent = String(n);
      clearInterval(reviveTimer);
      reviveTimer = window.setInterval(() => {
        n--;
        $('revive-n').textContent = String(Math.max(0, n));
        if (n <= 0) {
          clearInterval(reviveTimer);
          onExpire();
        } else h.act('tick', undefined, ring);
      }, 1000);
      this.show('revive');
      $(tokenOk ? 'btn-revive-token' : 'btn-revive-gems').focus({ preventScroll: true });
    },
    /**
     * @param {{score: number, isBest: boolean, cause: string, stage: number, caught?: boolean, tally: {ic: string, label: string, value: number, suffix?: string}[],
     *   missions: {text: string, progress: number, target: number, done: boolean}[]}} r
     */
    results(r) {
      $('over-title').textContent = r.caught ? 'Swept up!' : r.isBest ? 'What a shift!' : 'Shift over';
      $('over-cause').textContent = r.cause;
      $('over-badge').hidden = !r.isBest;
      countUp($('over-score'), r.score, 900);
      $('over-tally').innerHTML = r.tally
        .map((t, i) => `<div style="animation-delay:${0.15 + i * 0.12}s">${icon(t.ic)}<div><span>${t.label}</span><b data-v="${t.value}" data-s="${t.suffix || ''}">0</b></div></div>`)
        .join('');
      $('over-tally').querySelectorAll('b').forEach((b, i) => countUp(b, Number(b.dataset.v), 700, 150 + i * 120, b.dataset.s));
      $('over-missions').innerHTML = r.missions
        .map((m) => `<div class="res-m ${m.done ? 'done' : ''}"><span>${esc(m.text)}</span><span class="num">${m.done ? 'Done' : `${fmt(m.progress)}/${fmt(m.target)}`}</span>
          <div class="bar"><i style="width:0" data-w="${Math.min(100, (100 * m.progress) / m.target).toFixed(1)}%"></i></div></div>`)
        .join('');
      setTimeout(() => $('over-missions').querySelectorAll('i').forEach((i) => (i.style.width = i.dataset.w)), 400);
    },
    fatal(msg) {
      $('fatal-msg').textContent = msg;
      el.menu.hidden = true;
      el.fatal.hidden = false;
    },
  };
}

// DOM screens, sheets and HUD. Static markup lives in index.html; lists and sheets are
// rendered here from catalog data. Every interactive element carries data-act (+ data-arg)
// and one delegated click handler forwards it to main.js as h.act(act, arg, element).
import {
  CHARACTERS, DAILY, ITEMS, MAX_CHAR_LEVEL, MAX_UPGRADE, UPGRADES, charUpgradeCost, upgradeCost, xpForLevel,
} from './catalog.js';
import { STAGE_COLORS } from './track.js';
import { ICONS, icon } from './icons.js';

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : String(Math.floor(n)));
const priceHtml = (p) =>
  [p.cells ? `${icon('cell')}${fmt(p.cells)}` : '', p.gems ? `${icon('gem')}${fmt(p.gems)}` : ''].filter(Boolean).map((x) => `<span class="price">${x}</span>`).join(' ');
const prizeHtml = (p) =>
  p.cells ? `${icon('cell')}<b>${fmt(p.cells)}</b>` : p.gems ? `${icon('gem')}<b>${p.gems}</b>` : `${icon(p.item)}<b>${ITEMS[p.item]?.name || ''}</b>`;
const ITEM_COLORS = { headstart: '#b36bff', revive: '#ff4a6e', booster: '#ffb02e', mystery: '#3ab0ff' };
const TUTORIAL = [null, ['swipeH', 'Swipe left or right to switch lanes'], ['swipeUp', 'Swipe up to jump'], ['swipeDown', 'Swipe down to roll']];

/**
 * @param {{act: (act: string, arg: string|undefined, el: HTMLElement) => void}} h
 */
export function createUI(h) {
  const el = {
    menu: $('menu'), hud: $('hud'), pause: $('pause'), revive: $('revive'), over: $('over'), fatal: $('fatal'),
    score: $('score'), cells: $('cells'), gems: $('gems'), mult: $('hud-mult'), powers: $('powers'),
    stageBadge: $('stage-badge'), stageFill: $('stage-fill'), layer: $('layer-slot'), toasts: $('toasts'),
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
  wire('#pill-cells', 'shop', 'upgrades');
  wire('#pill-gems', 'shop', 'items');
  wire('#btn-profile', 'tab', 'missions');
  wire('#btn-daily', 'daily');
  wire('[data-go="missions"]', 'tab', 'missions');
  document.querySelectorAll('.nav-btn').forEach((n) => wire(`.nav-btn[data-tab="${n.dataset.tab}"]`, 'tab', n.dataset.tab));
  document.querySelectorAll('[data-shop-tab]').forEach((n) => wire(`[data-shop-tab="${n.dataset.shopTab}"]`, 'shop-tab', n.dataset.shopTab));
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

  // Swipe on the character preview area browses characters.
  const stage = $('char-stage');
  let sx = null;
  stage.addEventListener('touchstart', (e) => (sx = e.changedTouches[0].clientX), { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 40) h.act('char', dx < 0 ? '1' : '-1', stage);
  });

  let tab = 'home';
  let sheet = null;
  let reviveTimer = 0;
  const shown = { score: -1, cells: -1, gems: -1, mult: '', stage: 0 };
  const pw = {};

  function setTab(name) {
    const order = ['home', 'shop', 'chars', 'missions'];
    const from = order.indexOf(tab);
    const to = order.indexOf(name);
    tab = name;
    for (const id of order) {
      const p = $(`page-${id}`);
      p.classList.toggle('active', id === name);
      p.classList.toggle('left', order.indexOf(id) < to || (id !== name && order.indexOf(id) === from && from < to));
    }
    document.querySelectorAll('.nav-btn').forEach((n) => n.classList.toggle('active', n.dataset.tab === name));
  }

  // ---------- menu rendering ----------
  function renderTop(S) {
    $('lvl').textContent = String(S.level);
    $('xp-fill').style.width = `${Math.min(100, (100 * S.xp) / xpForLevel(S.level)).toFixed(1)}%`;
    $('cur-cells').textContent = fmt(S.cells);
    $('cur-gems').textContent = fmt(S.gems);
    const c = CHARACTERS.find((x) => x.id === S.selected) || CHARACTERS[0];
    $('avatar').style.setProperty('--av', c.color);
  }

  function renderHome(S, v) {
    $('home-best').textContent = fmt(S.best);
    $('home-mult').textContent = v.mult;
    const c = CHARACTERS.find((x) => x.id === S.selected) || CHARACTERS[0];
    $('home-char').innerHTML = `${esc(c.name)} <span>${esc(c.role)} &middot; Lv ${S.chars[c.id]}</span>`;
    $('daily-dot').hidden = !v.badges.daily;
    for (const k of ['shop', 'chars', 'missions']) /** @type {HTMLElement} */ (document.querySelector(`[data-badge="${k}"]`)).hidden = !v.badges[k];
  }

  function renderShop(S, v) {
    document.querySelectorAll('[data-shop-tab]').forEach((n) => n.classList.toggle('active', n.dataset.shopTab === v.shopTab));
    const list = $('shop-list');
    if (v.shopTab === 'upgrades') {
      list.innerHTML = Object.entries(UPGRADES).map(([k, u]) => {
        const lvl = S.upgrades[k];
        const cost = upgradeCost(lvl);
        const pips = Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        const stat = cost == null ? `${u.dur[lvl - 1]}s` : `${u.dur[lvl - 1]}s <span class="arrow">&#9654;</span> ${u.dur[lvl]}s`;
        const btn = cost == null
          ? '<span class="maxed">Max</span>'
          : `<button class="btn sm gold ${cost > S.cells ? 'poor' : ''}" data-act="up" data-arg="${k}" aria-label="Upgrade ${u.name} for ${cost} cells">${priceHtml({ cells: cost })}</button>`;
        return `<div class="card row-card"><div class="tile" style="--c:${u.color}">${icon(k)}</div>
          <div class="rc-body"><h3>${u.name}</h3><p>${u.desc}</p><div class="pips">${pips}</div><div class="stat-line">${icon('timer')}${stat}</div></div>
          <div class="rc-act">${btn}</div></div>`;
      }).join('');
    } else {
      list.innerHTML = Object.entries(ITEMS).map(([k, it]) => {
        const poor = (it.price.cells || 0) > S.cells || (it.price.gems || 0) > S.gems;
        const open = k === 'mystery' && S.items.mystery > 0 ? `<button class="btn sm green" data-act="open-box">Open</button>` : '';
        return `<div class="card row-card"><div class="tile" style="--c:${ITEM_COLORS[k]}">${icon(k)}${S.items[k] ? `<span class="count">x${S.items[k]}</span>` : ''}</div>
          <div class="rc-body"><h3>${it.name}</h3><p>${it.desc}</p></div>
          <div class="rc-act"><button class="btn sm gold ${poor ? 'poor' : ''}" data-act="item" data-arg="${k}" aria-label="Buy ${it.name}">${priceHtml(it.price)}</button>${open}</div></div>`;
      }).join('');
    }
  }

  function renderChars(S, v) {
    const c = CHARACTERS[v.charIndex];
    const lvl = S.chars[c.id] || 0;
    const owned = lvl > 0;
    $('char-count').textContent = `${Object.keys(S.chars).length}/${CHARACTERS.length} unlocked`;
    $('char-dots').innerHTML = CHARACTERS.map((_, i) => `<i class="${i === v.charIndex ? 'on' : ''}"></i>`).join('');
    const shownLvl = Math.max(1, lvl);
    const stars = Array.from({ length: MAX_CHAR_LEVEL }, (_, i) => icon('star', `ic ${i < lvl ? 'on' : ''}`)).join('');
    const cost = owned ? charUpgradeCost(lvl) : null;
    const next = owned && cost != null ? `<small>Next level: ${esc(c.perkText(lvl + 1))}</small>` : owned ? '<small>Max level reached</small>' : '<small>Unlock to use this perk</small>';
    let actions;
    if (!owned) {
      const gate = c.unlock.level && S.level < c.unlock.level;
      const poor = (c.unlock.cells || 0) > S.cells || (c.unlock.gems || 0) > S.gems;
      actions = gate
        ? `<button class="btn" disabled>${icon('lock')}Reach level ${c.unlock.level}</button>`
        : `<button class="btn gold ${poor ? 'poor' : ''}" data-act="char-unlock" data-arg="${c.id}">${icon('lock')}Unlock ${priceHtml(c.unlock)}</button>`;
    } else {
      const sel = S.selected === c.id
        ? `<button class="btn ghost" disabled>${icon('check')}Selected</button>`
        : `<button class="btn green" data-act="char-select" data-arg="${c.id}">Select</button>`;
      const up = cost == null
        ? '<button class="btn ghost" disabled>Max</button>'
        : `<button class="btn gold ${cost > S.cells ? 'poor' : ''}" data-act="char-upgrade" data-arg="${c.id}" aria-label="Upgrade for ${cost} cells">${icon('booster')}${priceHtml({ cells: cost })}</button>`;
      actions = sel + up;
    }
    $('char-card').innerHTML = `<div class="char-head"><h3 style="color:${c.color}">${esc(c.name)}</h3><span>${esc(c.role)}</span></div>
      <div class="char-lvl"><span>Level ${owned ? lvl : '-'}</span><span class="stars">${stars}</span></div>
      <div class="char-perk">${icon('star')}<div>${esc(c.perkText(shownLvl))}${next}</div></div>
      <div class="char-actions">${actions}</div>`;
  }

  function renderMissions(S, v) {
    const tier = S.missions.tier;
    const claimed = S.missions.claimed.filter(Boolean).length;
    $('tier-card').innerHTML = `<div class="tier-num">x${tier}</div><div class="tier-txt"><h3>Score multiplier x${tier}</h3>
      <p>${tier >= 30 ? 'Maximum multiplier reached!' : `Claim all 3 missions to reach x${tier + 1}.`}</p>
      <div class="pips">${[0, 1, 2].map((i) => `<i class="${i < claimed ? 'on' : ''}" style="width:32px"></i>`).join('')}</div></div>`;
    $('mission-list').innerHTML = v.missions.map((m, i) => {
      const pct = Math.min(100, (100 * m.progress) / m.target);
      const reward = m.reward.cells ? `${icon('cell')}${m.reward.cells}` : `${icon('gem')}${m.reward.gems}`;
      const act = m.claimed
        ? `<span class="m-claimed">${icon('check')}</span>`
        : m.done
          ? `<button class="btn sm green pop-in" data-act="claim" data-arg="${i}">Claim</button>`
          : `<span class="m-claimed" style="background:rgba(255,255,255,.06);color:var(--dim)">${icon('missions')}</span>`;
      return `<div class="card m-card ${m.done ? 'done' : ''}"><h4>${esc(m.text)}</h4><div class="m-act">${act}</div>
        <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="m-meta"><span class="num">${fmt(m.progress)} / ${fmt(m.target)}</span><span class="reward">${reward} &middot; ${m.xp} XP</span></div></div>`;
    }).join('');
    const d = v.daily;
    $('daily-card').innerHTML = `<div class="tile">${icon('calendar')}</div><div class="rc-body"><h3>Daily reward</h3>
      <p>${d.claimable ? `Day ${d.slot + 1} reward is ready!` : 'Come back tomorrow for the next one.'}</p></div>
      <button class="btn sm ${d.claimable ? 'gold' : 'ghost'}" data-act="daily">${d.claimable ? 'Open' : 'View'}</button>`;
  }

  // ---------- sheets ----------
  function openLayer(html, center = false, name = '') {
    el.layer.innerHTML = `<div class="layer ${center ? 'center' : ''}" data-sheet="${name}"><div class="backdrop" data-act="close"></div>${html}</div>`;
    fillIcons(el.layer);
    sheet = name;
    const primary = /** @type {HTMLElement|null} */ (el.layer.querySelector('.btn.gold, .btn.green'));
    primary?.focus({ preventScroll: true });
  }
  const sheetHead = (title) => `<div class="sheet-head"><h2>${title}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close')}</button></div>`;
  const sw = (on, act, arg, label, disabled = false) =>
    `<button class="switch" role="switch" aria-checked="${on}" aria-label="${label}" data-act="${act}" data-arg="${arg}" ${disabled ? 'disabled' : ''}></button>`;

  const SHEETS = {
    settings(S) {
      const st = S.settings;
      const row = (ic, label, key) => `<div class="set-row">${icon(ic)}<span class="lbl">${label}</span>${sw(st[key], 'set', key, label)}</div>`;
      return `<div class="sheet">${sheetHead('Settings')}
        ${row('sound', 'Sound effects', 'sound')}${row('music', 'Music', 'music')}${row('vibe', 'Vibration', 'vibe')}
        <div class="set-row">${icon('quality')}<span class="lbl">Graphics</span><div class="seg">
          <button class="${st.quality === 'low' ? 'on' : ''}" data-act="quality" data-arg="low">Low</button>
          <button class="${st.quality === 'high' ? 'on' : ''}" data-act="quality" data-arg="high">High</button></div></div>
        <div class="set-row" style="border:0">${icon('reset')}<span class="lbl">Progress</span><button class="btn sm danger" data-act="reset">Reset</button></div>
        <div class="version">Volt Dash 2.0 &middot; offline edition</div></div>`;
    },
    loadout(S) {
      const rows = Object.entries(ITEMS).filter(([, it]) => it.loadout).map(([k, it]) => {
        const n = S.items[k];
        const on = n > 0 && S.loadout[k];
        return `<div class="card lo-row ${n ? '' : 'off'}"><div class="tile" style="--c:${ITEM_COLORS[k]}">${icon(k)}<span class="count">x${n}</span></div>
          <div class="rc-body"><h3>${it.name}</h3><p>${it.desc}</p></div>${sw(on, 'lo', k, `Use ${it.name}`, !n)}</div>`;
      }).join('');
      return `<div class="sheet">${sheetHead('Loadout')}<div class="scroll" style="flex:none;max-height:52vh">${rows}</div>
        <p class="lo-hint">Need more boosts? <button data-act="shop" data-arg="items">Visit the shop</button></p>
        <button class="play-btn" data-act="go" style="width:100%;height:66px;font-size:28px;animation:none">${icon('play')}GO!</button></div>`;
    },
    daily(S, v) {
      const d = v.daily;
      const streak = S.daily.streak;
      const tiles = DAILY.map((p, i) => {
        const got = d.claimable ? i < d.slot : i <= d.slot && streak > 0;
        const today = d.claimable && i === d.slot;
        return `<div class="day ${i === 6 ? 'big' : ''} ${got ? 'got' : ''} ${today ? 'today' : ''}">Day ${i + 1}${prizeHtml(p)}</div>`;
      }).join('');
      return `<div class="sheet">${sheetHead('Daily reward')}<div class="daily-grid">${tiles}</div>
        <button class="btn ${d.claimable ? 'gold' : 'ghost'}" style="width:100%;min-height:58px" data-act="claim-daily" ${d.claimable ? '' : 'disabled'}>
        ${d.claimable ? 'Claim reward' : 'Come back tomorrow'}</button></div>`;
    },
    confirm() {
      return `<div class="modal"><h2>Reset progress?</h2><p>All Cells, Gems, upgrades, characters and missions will be erased. This cannot be undone.</p>
        <div class="stack"><button class="btn danger" data-act="reset-yes">Reset everything</button><button class="btn ghost" data-act="close">Cancel</button></div></div>`;
    },
  };

  function boxSvg() {
    return `<svg viewBox="0 0 140 140"><defs><linearGradient id="bx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5ac8ff"/><stop offset="1" stop-color="#2a5ad8"/></linearGradient></defs>
      <rect x="22" y="58" width="96" height="70" rx="10" fill="url(#bx)" stroke="#0f2a78" stroke-width="4"/>
      <rect x="62" y="58" width="16" height="70" fill="#ffd23f"/><text x="70" y="106" text-anchor="middle" font-size="34" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">?</text>
      <g class="lid"><rect x="14" y="40" width="112" height="24" rx="8" fill="#6fd6ff" stroke="#0f2a78" stroke-width="4"/><rect x="62" y="40" width="16" height="24" fill="#ffd23f"/></g></svg>`;
  }

  // ---------- toasts / coin fly ----------
  function toast({ ic = 'star', color = '#6b58ff', title, sub = '' }) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="tile" style="--c:${color}">${icon(ic)}</span><div>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2300);
    setTimeout(() => t.remove(), 2650);
  }

  function fly(kind, from, n = 8, reverse = false) {
    const target = $(kind === 'gems' ? 'pill-gems' : 'pill-cells');
    if (!from || el.menu.hidden || !target.offsetParent) return;
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    let [x0, y0, x1, y1] = [a.left + a.width / 2, a.top + a.height / 2, b.left + 18, b.top + b.height / 2];
    if (reverse) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    for (let i = 0; i < n; i++) {
      const f = document.createElement('div');
      f.className = 'fly';
      f.innerHTML = ICONS[kind === 'gems' ? 'gem' : 'cell'];
      document.body.appendChild(f);
      const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 140;
      const my = Math.min(y0, y1) - 40 - Math.random() * 80;
      const anim = f.animate(
        [
          { transform: `translate(${x0}px,${y0}px) scale(.6)`, opacity: 0 },
          { transform: `translate(${mx}px,${my}px) scale(1.15)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${x1}px,${y1}px) scale(.7)`, opacity: 1 },
        ],
        { duration: 620 + i * 45, delay: i * 35, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'backwards' },
      );
      anim.onfinish = () => {
        f.remove();
        if (i === n - 1) bump(target);
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
      node.textContent = fmt(Math.round(to * (1 - (1 - k) ** 3))) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    node.textContent = '0' + suffix;
    requestAnimationFrame(tick);
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
    /** Animated mystery-box opening; resolves the prize reveal after the shake. */
    mystery(prize) {
      openLayer(`<div class="modal"><h2>Mystery Box</h2><div class="box-art shaking" id="box-art"><div class="burst"></div>${boxSvg()}</div>
        <div class="prize" id="box-prize" style="visibility:hidden">${prizeHtml(prize)}</div>
        <button class="btn gold" style="width:100%" data-act="close" id="box-ok" disabled>Collect</button></div>`, true, 'mystery');
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
          n.style.setProperty('--c', colors[k]);
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
    stage(n, frac, name) {
      if (shown.stage !== n) {
        shown.stage = n;
        el.stageBadge.textContent = `Stage ${n}`;
        $('pause-stage').textContent = `Stage ${n} · ${name}`;
      }
      el.stageFill.style.width = `${(Math.min(1, frac) * 100).toFixed(1)}%`;
    },
    banner(n, name, themeIndex) {
      const slot = $('banner-slot');
      slot.innerHTML = `<div class="banner" style="--bc:${STAGE_COLORS[themeIndex]}"><small>Stage ${n}</small><b>${esc(name.toUpperCase())}</b></div>`;
      setTimeout(() => {
        if (slot.firstElementChild && slot.textContent.includes(name.toUpperCase())) slot.innerHTML = '';
      }, 2700);
    },
    clearBanner() {
      $('banner-slot').innerHTML = '';
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
     * @param {{score: number, isBest: boolean, cause: string, stage: number, tally: {ic: string, label: string, value: number, suffix?: string}[],
     *   missions: {text: string, progress: number, target: number, done: boolean}[]}} r
     */
    results(r) {
      $('over-cause').textContent = r.cause;
      $('over-badge').hidden = !r.isBest;
      countUp($('over-score'), r.score, 900);
      $('over-tally').innerHTML = r.tally
        .map((t, i) => `<div style="animation-delay:${0.15 + i * 0.12}s">${icon(t.ic)}<div><span>${t.label}</span><b data-v="${t.value}" data-s="${t.suffix || ''}">0</b></div></div>`)
        .join('');
      $('over-tally').querySelectorAll('b').forEach((b, i) => countUp(b, Number(b.dataset.v), 700, 150 + i * 120, b.dataset.s));
      $('over-missions').innerHTML = r.missions
        .map((m) => `<div class="res-m ${m.done ? 'done' : ''}"><span>${esc(m.text)}</span><span class="num">${m.done ? 'Done!' : `${fmt(m.progress)}/${fmt(m.target)}`}</span>
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

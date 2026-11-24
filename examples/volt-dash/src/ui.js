// DOM screens and HUD. All markup lives in index.html; this only wires and updates it.
import { POWER_TIME } from './track.js';
import { POWER_COLORS } from './entities.js';

const POWER_LABELS = { magnet: 'Magnet', spring: 'Spring', shield: 'Shield', x2: '2x score' };

/**
 * @param {{onPlay: () => void, onPause: () => void, onResume: () => void, onHome: () => void, onMute: () => void}} h
 */
export function createUI(h) {
  const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const el = {
    title: $('title'),
    hud: $('hud'),
    pause: $('pause'),
    over: $('over'),
    fatal: $('fatal'),
    score: $('score'),
    cells: $('cells'),
    powers: $('powers'),
  };
  const tap = (node, fn) =>
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
  el.title.addEventListener('click', () => h.onPlay()); // tap anywhere on the title to start
  tap($('btn-play'), h.onPlay);
  tap($('btn-again'), h.onPlay);
  tap($('btn-pause'), h.onPause);
  tap($('btn-resume'), h.onResume);
  document.querySelectorAll('[data-home]').forEach((b) => tap(b, h.onHome));
  document.querySelectorAll('[data-mute]').forEach((b) => tap(b, h.onMute));

  const bars = Object.keys(POWER_LABELS).map((key) => {
    const row = document.createElement('div');
    row.className = 'pw';
    row.style.color = POWER_COLORS[key];
    row.hidden = true;
    row.innerHTML = `<span>${POWER_LABELS[key]}</span><i><b></b></i>`;
    el.powers.appendChild(row);
    return { key, row, fill: /** @type {HTMLElement} */ (row.querySelector('b')), on: false };
  });
  let shownScore = -1;
  let shownCells = -1;

  return {
    /** @param {'title'|'hud'|'pause'|'over'} mode */
    show(mode) {
      el.title.hidden = mode !== 'title';
      el.hud.hidden = mode !== 'hud' && mode !== 'pause';
      el.pause.hidden = mode !== 'pause';
      el.over.hidden = mode !== 'over';
      const focus = { title: 'btn-play', pause: 'btn-resume', over: 'btn-again' }[mode];
      if (focus) $(focus).focus({ preventScroll: true });
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    },
    hud(score, cells, power) {
      const s = Math.floor(score);
      if (s !== shownScore) el.score.textContent = String((shownScore = s));
      if (cells !== shownCells) el.cells.textContent = String((shownCells = cells));
      for (const b of bars) {
        const t = power[b.key];
        const on = t > 0;
        if (on !== b.on) b.row.hidden = !(b.on = on);
        if (on) b.fill.style.transform = `scaleX(${(t / POWER_TIME).toFixed(3)})`;
      }
    },
    titleStats(best, total) {
      $('title-best').textContent = String(best);
      $('title-cells').textContent = String(total);
    },
    gameOver({ score, cells, best, isBest, cause }) {
      $('over-score').textContent = String(score);
      $('over-cells').textContent = String(cells);
      $('over-best').textContent = String(best);
      $('over-cause').textContent = cause;
      $('over-badge').hidden = !isBest;
    },
    muted(m) {
      document.querySelectorAll('[data-mute]').forEach((b) => {
        b.classList.toggle('off', m);
        b.setAttribute('aria-pressed', String(m));
        const label = b.querySelector('.label');
        if (label) label.textContent = m ? 'Sound: off' : 'Sound: on';
      });
    },
    fatal(msg) {
      $('fatal-msg').textContent = msg;
      el.title.hidden = true;
      el.fatal.hidden = false;
    },
  };
}

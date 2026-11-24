// Swipe + keyboard input. Swipes are decided on touchmove once the finger passes
// SWIPE_PX, so the action fires mid-gesture instead of on release.

/** @typedef {'left'|'right'|'up'|'down'|'pause'|'confirm'} Action */

const SWIPE_PX = 30;
/** @type {Record<string, Action>} */
const KEYS = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  Space: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Escape: 'pause',
  KeyP: 'pause',
  Enter: 'confirm',
};

/**
 * @param {HTMLElement} surface element that receives swipes (the game canvas)
 * @param {(a: Action) => void} onAction
 */
export function createInput(surface, onAction) {
  let id = null;
  let sx = 0;
  let sy = 0;
  let fired = false;
  const find = (list) => {
    for (const t of list) if (t.identifier === id) return t;
    return null;
  };

  surface.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      const t = e.changedTouches[0]; // newest finger wins, so alternating thumbs work
      id = t.identifier;
      sx = t.clientX;
      sy = t.clientY;
      fired = false;
    },
    { passive: false },
  );
  surface.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      const t = find(e.changedTouches);
      if (!t || fired) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX) return;
      fired = true; // one action per touch
      onAction(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    },
    { passive: false },
  );
  const end = (e) => {
    if (find(e.changedTouches)) id = null;
  };
  surface.addEventListener('touchend', end);
  surface.addEventListener('touchcancel', end);

  window.addEventListener('keydown', (e) => {
    const a = KEYS[e.code];
    if (!a || e.repeat) return;
    const onButton = e.target instanceof Element && e.target.closest('button');
    if (onButton && (e.code === 'Enter' || e.code === 'Space')) return; // let focused buttons activate
    e.preventDefault();
    onAction(a);
  });
}

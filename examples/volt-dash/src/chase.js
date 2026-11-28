// Clank's chase rules (pure, no three.js, so node can self-check them).
// Clank is a runaway street-sweeper mech that rumbles behind the runner:
//   intro  -> right behind at the start of a run, then drops back
//   away   -> off-screen behind the camera
//   close  -> after a stumble it closes in for CLOSE_TIME seconds; another stumble = caught
//   caught -> lunges onto the runner (also used for the game-over lunge)
// `gap` is Clank's distance behind the runner in metres (render z = +gap).

export const CHASE = {
  INTRO_TIME: 2.4,
  CLOSE_TIME: 6,
  NEAR: 2.3, // brushes right at the runner's heels; the chase camera sees Clank's roof and beacon
  FAR: 16, // well behind the camera
  LUNGE: 0.9,
  CLOSE_SPEED: 14, // m/s while closing in
  DROP_SPEED: 3.2, // m/s while falling back
};

/** @typedef {'intro'|'away'|'close'|'caught'} ChaseMode */

export function createChase() {
  const st = { mode: /** @type {ChaseMode} */ ('away'), t: 0, gap: CHASE.FAR };
  const target = () => (st.mode === 'caught' ? CHASE.LUNGE : st.mode === 'away' ? CHASE.FAR : CHASE.NEAR);
  return {
    get mode() {
      return st.mode;
    },
    get gap() {
      return st.gap;
    },
    get t() {
      return st.t;
    },
    /** Run start: Clank is already right behind. */
    start() {
      Object.assign(st, { mode: 'intro', t: 0, gap: CHASE.NEAR });
    },
    /** Menus / revive: gone, no animation. */
    hide() {
      Object.assign(st, { mode: 'away', t: 0, gap: CHASE.FAR });
    },
    /** After a revive or a shield save: Clank lets go and falls back. */
    release() {
      st.mode = 'away';
      st.t = 0;
    },
    /**
     * A side bump. First one brings Clank close (warning); a second while close catches you.
     * @returns {'close'|'caught'}
     */
    stumble() {
      if (st.mode === 'close') {
        st.mode = 'caught';
        st.t = 0;
        return 'caught';
      }
      st.mode = 'close';
      st.t = 0;
      return 'close';
    },
    /** Game over by any cause: Clank lunges into view. */
    lunge() {
      st.mode = 'caught';
      st.t = 0;
    },
    /**
     * Advance time. Returns 'escaped' on the frame Clank gives up after closing in.
     * @param {number} dt
     * @returns {'escaped'|null}
     */
    update(dt) {
      st.t += dt;
      let ev = null;
      if (st.mode === 'intro' && st.t >= CHASE.INTRO_TIME) {
        st.mode = 'away';
        st.t = 0;
      } else if (st.mode === 'close' && st.t >= CHASE.CLOSE_TIME) {
        st.mode = 'away';
        st.t = 0;
        ev = 'escaped';
      }
      const to = target();
      const rate = to < st.gap ? (st.mode === 'caught' ? CHASE.CLOSE_SPEED * 1.6 : CHASE.CLOSE_SPEED) : CHASE.DROP_SPEED;
      st.gap = to < st.gap ? Math.max(to, st.gap - rate * dt) : Math.min(to, st.gap + rate * dt);
      return ev;
    },
    /** 0..1 danger level for the red vignette / rumble (1 = right behind, closing). */
    danger() {
      if (st.mode !== 'close' && st.mode !== 'caught') return 0;
      return Math.max(0, Math.min(1, (CHASE.FAR - st.gap) / (CHASE.FAR - CHASE.NEAR)));
    },
  };
}

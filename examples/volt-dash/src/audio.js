// Tiny WebAudio synth: every sound is a few oscillator/noise blips, no audio files.

/** @typedef {'cell'|'jump'|'roll'|'power'|'bump'|'shield'|'crash'|'start'|'click'} SoundName */

export function createAudio(initialMuted = false) {
  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null} */
  let master = null;
  /** @type {AudioBuffer|null} */
  let noiseBuf = null;
  let muted = initialMuted;
  const VOLUME = 0.4;

  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : VOLUME;
        master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch {
      ctx = null; // audio is optional; the game runs silently
    }
  }

  function blip(type, f0, f1, dur, vol, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, f0, f1) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noiseBuf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  /** @type {Record<SoundName, (arg?: number) => void>} */
  const SOUNDS = {
    cell: (streak = 0) => {
      const p = 1 + Math.min(streak, 12) * 0.045;
      blip('triangle', 900 * p, 1700 * p, 0.09, 0.3);
    },
    jump: () => blip('square', 260, 640, 0.14, 0.12),
    roll: () => {
      blip('sawtooth', 380, 120, 0.16, 0.1);
      noise(0.16, 0.18, 2200, 300);
    },
    power: () => [523, 659, 784, 1047].forEach((f, i) => blip('triangle', f, f * 1.02, 0.13, 0.25, i * 0.06)),
    bump: () => {
      blip('sine', 190, 55, 0.2, 0.5);
      noise(0.12, 0.25, 900, 200);
    },
    shield: () => blip('sine', 1300, 260, 0.35, 0.3),
    crash: () => {
      noise(0.55, 0.55, 3000, 120);
      blip('sawtooth', 170, 38, 0.55, 0.3);
    },
    start: () => {
      blip('triangle', 440, 880, 0.15, 0.25);
      blip('triangle', 660, 1320, 0.15, 0.2, 0.09);
    },
    click: () => blip('sine', 620, 940, 0.06, 0.18),
  };

  return {
    unlock,
    /** @param {SoundName} name */
    play(name, arg) {
      if (!ctx || muted || ctx.state !== 'running') return;
      try {
        SOUNDS[name](arg);
      } catch {
        /* a dropped blip is harmless */
      }
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : VOLUME;
    },
    get muted() {
      return muted;
    },
    /** Let the audio hardware sleep while paused/backgrounded. */
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
  };
}

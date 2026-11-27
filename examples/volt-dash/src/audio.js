// Tiny WebAudio synth: every sound is a few oscillator/noise blips, no audio files.
// Music is an original procedural step-sequencer loop (bass + arpeggio + light drums)
// with one progression/tempo/timbre per stage theme; menus play a calmer version.

/** @typedef {'cell'|'gem'|'jump'|'roll'|'power'|'hyper'|'bump'|'shield'|'crash'|'start'|'click'|'buy'|'error'|'claim'|'levelup'|'open'|'stage'|'tick'|'toggle'} SoundName */

const SONGS = [
  // [tempo, lead wave, chords (MIDI), bass octave shift, lead octave shift]
  { tempo: 112, wave: 'square', chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], lead: 12 }, // Neon City
  { tempo: 118, wave: 'triangle', chords: [[50, 53, 57, 60], [55, 59, 62], [57, 60, 64, 67], [55, 59, 62]], lead: 12 }, // Sunset Canyon
  { tempo: 104, wave: 'sine', chords: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]], lead: 24 }, // Frost Line
  { tempo: 128, wave: 'sawtooth', chords: [[48, 51, 55], [44, 48, 51], [46, 50, 53], [43, 47, 50]], lead: 12 }, // Storm Foundry
  { tempo: 122, wave: 'triangle', chords: [[53, 57, 60, 64], [55, 59, 62, 66], [52, 55, 59, 62], [57, 60, 64, 67]], lead: 24 }, // Cosmic Skyway
];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export function createAudio({ sound = true, music = true } = {}) {
  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null} */
  let sfx = null;
  /** @type {GainNode|null} */
  let mus = null;
  /** @type {AudioBuffer|null} */
  let noiseBuf = null;
  let soundOn = sound;
  let musicOn = music;
  const SFX_VOL = 0.4;
  const MUSIC_VOL = 0.11;
  const seq = { theme: 0, mode: 'menu', step: 0, next: 0, timer: 0 };

  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        sfx = ctx.createGain();
        sfx.gain.value = soundOn ? SFX_VOL : 0;
        sfx.connect(ctx.destination);
        mus = ctx.createGain();
        mus.gain.value = musicOn ? MUSIC_VOL : 0;
        mus.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        seq.next = ctx.currentTime + 0.1;
        seq.timer = window.setInterval(schedule, 40);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch {
      ctx = null; // audio is optional; the game runs silently
    }
  }

  function blip(type, f0, f1, dur, vol, delay = 0, out = sfx, at = null) {
    const t = (at ?? ctx.currentTime) + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, f0, f1, out = sfx, at = null, type = 'lowpass') {
    const t = at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noiseBuf;
    filter.type = type;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur);
  }

  /** Lookahead scheduler: queue the 16th notes that fall in the next 150 ms. */
  function schedule() {
    if (!ctx || ctx.state !== 'running' || !musicOn) {
      if (ctx) seq.next = ctx.currentTime + 0.05;
      return;
    }
    const song = SONGS[seq.theme];
    const run = seq.mode === 'run';
    const sixteenth = 60 / (run ? song.tempo : song.tempo * 0.75) / 4;
    while (seq.next < ctx.currentTime + 0.15) {
      const t = seq.next;
      const step = seq.step % 16;
      const chord = song.chords[Math.floor(seq.step / 16) % song.chords.length];
      try {
        if (step === 0 || step === 6 || step === 8 || (run && step === 14)) {
          blip('triangle', hz(chord[0] - 12), hz(chord[0] - 12) * 0.995, sixteenth * 2.6, 0.5, 0, mus, t);
        }
        if (run || step % 2 === 0) {
          const n = chord[(step >> (run ? 0 : 1)) % chord.length] + song.lead;
          blip(song.wave, hz(n), hz(n), sixteenth * 0.9, song.wave === 'sawtooth' || song.wave === 'square' ? 0.07 : 0.14, 0, mus, t);
        }
        if (run) {
          if (step % 4 === 0) blip('sine', 140, 45, 0.16, 0.55, 0, mus, t);
          if (step % 4 === 2) noise(0.04, 0.12, 9000, 6000, mus, t, 'highpass');
        }
      } catch {
        /* a dropped note is harmless */
      }
      seq.next += sixteenth;
      seq.step = (seq.step + 1) % (16 * 4);
    }
  }

  /** @type {Record<SoundName, (arg?: number) => void>} */
  const SOUNDS = {
    cell: (streak = 0) => {
      const p = 1 + Math.min(streak, 12) * 0.045;
      blip('triangle', 900 * p, 1700 * p, 0.09, 0.3);
    },
    gem: () => [1320, 1760, 2637].forEach((f, i) => blip('sine', f, f * 1.01, 0.12, 0.25, i * 0.05)),
    jump: () => blip('square', 260, 640, 0.14, 0.12),
    roll: () => {
      blip('sawtooth', 380, 120, 0.16, 0.1);
      noise(0.16, 0.18, 2200, 300);
    },
    power: () => [523, 659, 784, 1047].forEach((f, i) => blip('triangle', f, f * 1.02, 0.13, 0.25, i * 0.06)),
    hyper: () => {
      blip('sawtooth', 200, 1600, 0.45, 0.18);
      noise(0.5, 0.25, 600, 6000, sfx, null, 'bandpass');
    },
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
    toggle: () => blip('square', 520, 780, 0.05, 0.08),
    tick: () => blip('sine', 1000, 1000, 0.05, 0.15),
    buy: () => {
      blip('triangle', 988, 988, 0.08, 0.25);
      blip('triangle', 1319, 1319, 0.22, 0.25, 0.08);
    },
    error: () => {
      blip('square', 160, 120, 0.12, 0.15);
      blip('square', 160, 110, 0.14, 0.15, 0.13);
    },
    claim: () => [659, 784, 988, 1319].forEach((f, i) => blip('triangle', f, f, 0.12, 0.22, i * 0.07)),
    levelup: () => [523, 659, 784, 1047, 1319].forEach((f, i) => blip('square', f, f, 0.16, 0.12, i * 0.09)),
    open: () => {
      noise(0.25, 0.3, 400, 4000, sfx, null, 'bandpass');
      [784, 1047, 1568].forEach((f, i) => blip('sine', f, f, 0.2, 0.2, 0.15 + i * 0.06));
    },
    stage: () => {
      noise(0.6, 0.2, 300, 5000, sfx, null, 'bandpass');
      [392, 494, 587, 784].forEach((f) => blip('triangle', f, f, 0.6, 0.12, 0.2));
    },
  };

  return {
    unlock,
    /** @param {SoundName} name */
    play(name, arg) {
      if (!ctx || !soundOn || ctx.state !== 'running') return;
      try {
        SOUNDS[name](arg);
      } catch {
        /* a dropped blip is harmless */
      }
    },
    setSound(on) {
      soundOn = on;
      if (sfx) sfx.gain.value = on ? SFX_VOL : 0;
    },
    setMusic(on) {
      musicOn = on;
      if (mus) mus.gain.value = on ? MUSIC_VOL : 0;
    },
    /** @param {number} theme 0..4 @param {'menu'|'run'} mode */
    song(theme, mode) {
      if (theme !== seq.theme || mode !== seq.mode) seq.step = 0;
      seq.theme = theme % SONGS.length;
      seq.mode = mode;
    },
    /** Let the audio hardware sleep while paused/backgrounded. */
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
  };
}

// Kaimana Air Mail — sound: everything synthesised with WebAudio, no files.
// Engine drone follows the throttle, wind rush follows airspeed, and the
// ring chime, touchdown thump and crash are short envelopes.

export function createSoundBank() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function ensureContext() {
    if (ctx) return ctx;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    ctx = new AudioContextClass();
    // Engine: two detuned saws through a low-pass, gain tied to throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 62;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 93;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise through a band-pass that opens with airspeed.
    const noiseLength = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) data[i] = Math.random() * 2 - 1;
    windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSource.start();
    return ctx;
  }

  /** Call from the first user gesture; browsers block audio before it. */
  function unlock() {
    const audio = ensureContext();
    if (audio && audio.state === 'suspended') audio.resume();
  }

  /** Per-frame engine and wind levels from throttle and speed. */
  function updateEngine(throttle, speedNorm, airborne) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const base = 52 + throttle * 68;
    engineOsc.frequency.setTargetAtTime(base, now, 0.08);
    engineOsc2.frequency.setTargetAtTime(base * 1.5 + 2, now, 0.08);
    const level = airborne ? 0.05 + throttle * 0.075 : 0.03 + throttle * 0.05;
    engineGain.gain.setTargetAtTime(level, now, 0.1);
    windFilter.frequency.setTargetAtTime(320 + speedNorm * 900, now, 0.15);
    windGain.gain.setTargetAtTime(speedNorm * speedNorm * 0.06, now, 0.15);
  }

  function tone(freq, startAt, duration, type, level) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
    gain.gain.linearRampToValueAtTime(level, ctx.currentTime + startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + startAt);
    osc.stop(ctx.currentTime + startAt + duration + 0.05);
  }

  /** Two-note golden chime when a mail ring is threaded. */
  function ringChime() {
    tone(880, 0, 0.5, 'sine', 0.22);
    tone(1318, 0.09, 0.6, 'sine', 0.18);
  }

  /** Soft thump for a gentle touchdown. */
  function touchdown() {
    tone(70, 0, 0.25, 'sine', 0.4);
    tone(140, 0.02, 0.18, 'triangle', 0.2);
  }

  /** Harsh noise burst for a crash. */
  function crash() {
    if (!ctx || muted) return;
    const length = ctx.sampleRate * 0.7;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    tone(55, 0, 0.6, 'sawtooth', 0.3);
  }

  /** Short rising arpeggio when a sortie is completed. */
  function fanfare() {
    tone(523, 0, 0.35, 'triangle', 0.22);
    tone(659, 0.12, 0.35, 'triangle', 0.22);
    tone(784, 0.24, 0.5, 'triangle', 0.24);
    tone(1046, 0.36, 0.7, 'triangle', 0.22);
  }

  function setMuted(value) {
    muted = value;
    if (ctx) {
      const now = ctx.currentTime;
      if (engineGain) engineGain.gain.setTargetAtTime(muted ? 0 : 0.06, now, 0.05);
      if (windGain) windGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  function isMuted() {
    return muted;
  }

  return { unlock, updateEngine, ringChime, touchdown, crash, fanfare, setMuted, isMuted };
}

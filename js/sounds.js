// Ship horns, foghorn, waves and gulls, synthesized in the browser with the
// Web Audio API (no recordings needed).

let ctx;
function audio() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// One horn blast: a few detuned sawtooth waves through a low-pass filter.
function blast(start, dur, { freqs = [98, 147, 196], cutoff = 900, gain = 0.22 } = {}) {
  const a = audio();
  const out = a.createGain();
  const lp = a.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = cutoff; lp.Q.value = 3;
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(gain, start + 0.12);
  out.gain.setValueAtTime(gain, start + dur - 0.2);
  out.gain.linearRampToValueAtTime(0, start + dur);
  lp.connect(out).connect(a.destination);
  for (const f of freqs) {
    for (const detune of [-6, 6]) {
      const o = a.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f; o.detune.value = detune;
      o.frequency.setValueAtTime(f * 0.97, start);
      o.frequency.linearRampToValueAtTime(f, start + 0.15);
      o.connect(lp); o.start(start); o.stop(start + dur + 0.05);
    }
  }
  return start + dur;
}

function pattern(steps, voice) {
  const a = audio();
  let t = a.currentTime + 0.05;
  for (const s of steps) t = blast(t, s === "L" ? 2.6 : 0.8, voice) + 0.45;
  return (t - a.currentTime) * 1000;
}

const SHIP = { freqs: [82, 123, 165], cutoff: 700, gain: 0.24 };
const BRIDGE = { freqs: [147, 220, 294], cutoff: 1400, gain: 0.18 };

function foghorn() {
  // A deep diaphone-style "BEEE-oh" with a drop in pitch at the end.
  const a = audio();
  const t = a.currentTime + 0.05;
  const out = a.createGain();
  const lp = a.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 500;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.3, t + 0.3);
  out.gain.setValueAtTime(0.3, t + 2.3);
  out.gain.linearRampToValueAtTime(0, t + 3.4);
  lp.connect(out).connect(a.destination);
  for (const f of [55, 110, 165]) {
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t);
    o.frequency.setValueAtTime(f, t + 2.2);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 3.3);
    o.connect(lp); o.start(t); o.stop(t + 3.5);
  }
  return 3500;
}

// Waves: filtered noise with a slow swell.
let waves = null;
function toggleWaves() {
  const a = audio();
  if (waves) { waves.gain.gain.linearRampToValueAtTime(0, a.currentTime + 1); const w = waves; setTimeout(() => w.src.stop(), 1200); waves = null; return false; }
  const len = a.sampleRate * 4;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
  const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
  const gain = a.createGain(); gain.gain.value = 0;
  const lfo = a.createOscillator(); lfo.frequency.value = 0.12;
  const lfoGain = a.createGain(); lfoGain.gain.value = 0.25;
  lfo.connect(lfoGain).connect(gain.gain);
  src.connect(lp).connect(gain).connect(a.destination);
  gain.gain.linearRampToValueAtTime(0.35, a.currentTime + 1.5);
  src.start(); lfo.start();
  waves = { src, gain };
  return true;
}

function gulls() {
  const a = audio();
  let t = a.currentTime + 0.05;
  for (let i = 0; i < 4; i++) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "triangle";
    const f = 1500 + Math.random() * 500;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.28);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.32);
    t += 0.22 + Math.random() * 0.25;
  }
  return (t - a.currentTime) * 1000;
}

export function play(name) {
  switch (name) {
    case "salute": return pattern(["L", "S", "S"], SHIP);
    case "bridge": return pattern(["L", "S", "S"], BRIDGE);
    case "long": return pattern(["L"], SHIP);
    case "fog": return foghorn();
    case "gulls": return gulls();
    case "waves": return toggleWaves();
    case "alert": return pattern(["S"], SHIP);
  }
}

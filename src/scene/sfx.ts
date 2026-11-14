/** Efek suara sintetis (WebAudio) — tanpa file aset, ceria ala game kartun. */
let ctx: AudioContext | null = null;
export const Sound = { muted: false };

function ac(): AudioContext | null {
  if (Sound.muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.08, slideTo?: number, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Nada dengan vibrato (untuk kentut & trombon sedih). */
function wobble(freq: number, dur: number, type: OscillatorType, vol: number, lfoHz: number, depth: number, slideTo?: number, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  const gain = a.createGain();
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  lfo.frequency.value = lfoHz;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(osc.frequency);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.setValueAtTime(vol, t0 + dur * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filter).connect(gain).connect(a.destination);
  osc.start(t0);
  lfo.start(t0);
  osc.stop(t0 + dur + 0.02);
  lfo.stop(t0 + dur + 0.02);
}

export const sfx = {
  fart: () => {
    wobble(95, 0.7, "sawtooth", 0.14, 28, 30, 60);
    wobble(70, 0.35, "square", 0.06, 40, 20, 50, 0.55);
  },
  sadTrombone: () => [392, 370, 349].forEach((f, i) => wobble(f / 2, i === 2 ? 0.9 : 0.35, "sawtooth", 0.06, i === 2 ? 6 : 0.1, i === 2 ? 8 : 0, undefined, i * 0.38)),
  ufo: () => wobble(600, 1.4, "sine", 0.06, 8, 200, 900),
  zap: () => {
    for (let i = 0; i < 5; i++) tone(1200 - i * 180, 0.06, "sawtooth", 0.05, 200, i * 0.05);
  },
  boing: () => wobble(220, 0.5, "sine", 0.1, 14, 60, 520),
  honk: () => {
    wobble(330, 0.25, "square", 0.07, 30, 15);
    wobble(330, 0.35, "square", 0.07, 30, 15, undefined, 0.32);
  },
  dangdut: () => {
    // Tak-dung-tak-dung ala gendang
    [0, 0.18, 0.3, 0.48, 0.6, 0.78].forEach((d, i) => tone(i % 2 ? 260 : 110, 0.12, "triangle", 0.1, i % 2 ? 180 : 70, d));
    [659, 698, 659, 587].forEach((f, i) => tone(f, 0.16, "square", 0.035, undefined, 0.1 + i * 0.2));
  },
  scream: () => wobble(700, 0.6, "sawtooth", 0.05, 12, 80, 1100),
  hop: () => tone(420, 0.12, "square", 0.05, 820),
  land: () => tone(160, 0.08, "triangle", 0.08),
  coin: () => {
    tone(988, 0.08, "square", 0.05);
    tone(1319, 0.25, "square", 0.05, undefined, 0.08);
  },
  pay: () => tone(330, 0.3, "sawtooth", 0.04, 140),
  dice: () => {
    for (let i = 0; i < 6; i++) tone(200 + Math.random() * 300, 0.04, "square", 0.03, undefined, i * 0.07);
  },
  build: () => [523, 659, 784].forEach((f, i) => tone(f, 0.12, "square", 0.05, undefined, i * 0.07)),
  card: () => tone(660, 0.3, "triangle", 0.07, 1320),
  fly: () => tone(300, 0.9, "sine", 0.06, 1200),
  bad: () => [392, 330, 262].forEach((f, i) => tone(f, 0.2, "triangle", 0.07, undefined, i * 0.15)),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.18, "square", 0.06, undefined, i * 0.12)),
  click: () => tone(700, 0.05, "square", 0.04),
};

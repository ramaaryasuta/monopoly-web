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

export const sfx = {
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

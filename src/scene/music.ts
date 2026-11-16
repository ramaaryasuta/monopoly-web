import { audioCtx, musicBus, onSoundChange, Sound } from "./sfx";

/**
 * Musik latar sintetis (WebAudio, tanpa file aset) bergaya lounge santai:
 * akor jazzy di piano elektrik, bas berjalan, drum sapu (brush) yang lembut,
 * dan melodi vibrafon / suling bergantian tiap putaran.
 * Dijadwalkan dengan "lookahead scheduler" supaya ritmenya presisi.
 */

const BPM = 84;
const STEP = 60 / BPM / 2; // satu langkah = seperdelapan ketukan
const STEPS_PER_BAR = 8;
const SWING = 0.17; // geser langkah ganjil (rasa swing)
const LOOKAHEAD = 0.3; // detik dijadwalkan di depan
/** Tab di latar: timer dibatasi browser ±1×/detik, jadi jadwalkan lebih jauh agar musik tidak putus. */
const LOOKAHEAD_HIDDEN = 2.5;
const TICK_MS = 50;
const STORE_KEY = "pk-music";

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Akor: nada dasar (MIDI, oktaf bas) + interval voicing di atas nada dasar. */
type Chord = { root: number; iv: number[]; third: number };
const maj7 = (root: number): Chord => ({ root, iv: [4, 7, 11, 14], third: 4 });
const m7 = (root: number): Chord => ({ root, iv: [3, 7, 10, 14], third: 3 });
const dom7 = (root: number): Chord => ({ root, iv: [4, 10, 14, 21], third: 4 });
const sus = (root: number): Chord => ({ root, iv: [5, 10, 14, 19], third: 5 });

const F = 41, E = 40, A = 45, D = 38, C = 36, Bb = 46, Eb = 39, G = 43;

/** 16 birama; tiap birama 1 akor atau 2 akor (ganti di tengah birama). */
const BARS_CHORDS: Chord[][] = [
  [maj7(F)],
  [m7(E), dom7(A)],
  [m7(D)],
  [m7(C), dom7(F)],
  [maj7(Bb)],
  [m7(Bb), dom7(Eb)],
  [m7(A)],
  [dom7(D)],
  [m7(G)],
  [dom7(C)],
  [m7(A), dom7(D)],
  [m7(G), dom7(C)],
  [maj7(F)],
  [m7(D)],
  [m7(G)],
  [sus(C), dom7(C)],
];
const BARS = BARS_CHORDS.length;

/** Melodi: per birama daftar [langkah, MIDI, panjang dalam langkah]. */
type Note = [number, number, number];
const MELODY: Note[][] = [
  [[0, 81, 3], [3, 79, 1], [4, 76, 4]],
  [[0, 79, 2], [2, 76, 2], [4, 73, 3], [7, 74, 1]],
  [[0, 77, 4], [5, 74, 1], [6, 72, 2]],
  [[0, 70, 2], [2, 74, 2], [4, 75, 3], [7, 74, 1]],
  [[0, 74, 3], [3, 72, 1], [4, 69, 4]],
  [[0, 68, 2], [2, 70, 2], [4, 73, 2], [6, 72, 2]],
  [[0, 72, 3], [3, 76, 1], [4, 79, 4]],
  [[0, 78, 2], [2, 76, 2], [4, 74, 4]],
  [[1, 74, 2], [3, 77, 1], [4, 79, 3], [7, 81, 1]],
  [[0, 82, 2], [2, 81, 2], [4, 79, 4]],
  [[0, 76, 2], [2, 72, 2], [4, 78, 2], [6, 81, 2]],
  [[0, 79, 3], [3, 77, 1], [4, 76, 4]],
  [[0, 77, 2], [2, 81, 2], [4, 84, 4]],
  [[0, 81, 3], [3, 77, 1], [4, 74, 4]],
  [[0, 77, 2], [2, 74, 2], [4, 70, 4]],
  [[0, 72, 6], [6, 67, 2]],
];

let noiseBuf: AudioBuffer | null = null;
function getNoise(a: AudioContext) {
  if (!noiseBuf || noiseBuf.sampleRate !== a.sampleRate) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** Selubung: naik cepat lalu meluruh eksponensial sampai `dur`. */
function env(a: AudioContext, out: AudioNode, t: number, vol: number, attack: number, dur: number) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  return g;
}

function osc(a: AudioContext, dest: AudioNode, type: OscillatorType, freq: number, t: number, dur: number, slideTo?: number) {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function noiseHit(a: AudioContext, out: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1, attack = 0.002) {
  const src = a.createBufferSource();
  src.buffer = getNoise(a);
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(env(a, out, t, vol, attack, dur));
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

/** Tremolo halus (gain bergoyang) untuk piano elektrik & vibrafon. */
function tremolo(a: AudioContext, out: AudioNode, t: number, dur: number, hz: number, depth: number) {
  const g = a.createGain();
  g.gain.value = 1 - depth;
  const lfo = a.createOscillator();
  const d = a.createGain();
  lfo.frequency.value = hz;
  d.gain.value = depth;
  lfo.connect(d).connect(g.gain);
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
  g.connect(out);
  return g;
}

/** Piano elektrik: nada lembut + sedikit "denting" di awal, dengan tremolo. */
function epiano(a: AudioContext, out: AudioNode, notes: number[], t: number, dur: number, vol: number) {
  const trem = tremolo(a, out, t, dur + 0.6, 4.2, 0.22);
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  lp.connect(trem);
  for (const m of notes) {
    const f = mtof(m);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * 0.45, t + 0.35);
    g.gain.setValueAtTime(vol * 0.45, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
    g.connect(lp);
    osc(a, g, "sine", f, t, dur + 0.5);
    osc(a, env(a, lp, t, vol * 0.35, 0.003, 0.25), "sine", f * 4.01, t, 0.25);
    osc(a, env(a, lp, t, vol * 0.25, 0.005, dur * 0.8 + 0.2), "triangle", f * 2, t, dur * 0.8 + 0.2);
  }
}

/** Vibrafon: nada bening bertremolo dengan ekor panjang. */
function vibes(a: AudioContext, out: AudioNode, m: number, t: number, dur: number) {
  const f = mtof(m);
  const trem = tremolo(a, out, t, dur + 1, 5.5, 0.35);
  osc(a, env(a, trem, t, 0.05, 0.004, dur + 1), "sine", f, t, dur + 1);
  osc(a, env(a, trem, t, 0.012, 0.003, 0.4), "sine", f * 4, t, 0.4);
}

/** Suling: tiupan lembut dengan vibrato yang muncul pelan. */
function suling(a: AudioContext, out: AudioNode, m: number, t: number, dur: number) {
  const f = mtof(m);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.038, t + 0.08);
  g.gain.setValueAtTime(0.038, t + dur * 0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2600;
  g.connect(lp).connect(out);
  const o = osc(a, g, "triangle", f, t, dur + 0.15);
  osc(a, g, "sine", f, t, dur + 0.15);
  const lfo = a.createOscillator();
  const depth = a.createGain();
  lfo.frequency.value = 5;
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(f * 0.01, t + Math.min(0.5, dur));
  lfo.connect(depth).connect(o.frequency);
  lfo.start(t);
  lfo.stop(t + dur + 0.2);
  noiseHit(a, out, t, 0.12, 0.005, "bandpass", f * 2, 2, 0.02);
}

/** Bas kontra (upright): petikan bulat dan hangat. */
function upright(a: AudioContext, out: AudioNode, m: number, t: number) {
  const dur = STEP * 1.9;
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(300, t + 0.2);
  lp.connect(env(a, out, t, 0.14, 0.006, dur));
  osc(a, lp, "triangle", mtof(m), t, dur);
  osc(a, lp, "sine", mtof(m), t, dur);
}

/** Ubah interval voicing ke rentang tengah piano supaya akor tidak melompat-lompat. */
function voicing(ch: Chord): number[] {
  return ch.iv
    .map((iv) => {
      let n = ch.root + iv;
      while (n < 55) n += 12;
      while (n > 74) n -= 12;
      return n;
    })
    .sort((x, y) => x - y);
}

/** Jaga nada bas di rentang 33..50. */
function bassRange(n: number) {
  while (n < 33) n += 12;
  while (n > 50) n -= 12;
  return n;
}

class MusicPlayer {
  enabled = true;
  private unlocked = false;
  private master: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private loop = 0;

  constructor() {
    try {
      this.enabled = localStorage.getItem(STORE_KEY) !== "off";
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }

  /** Browser hanya mengizinkan audio setelah interaksi pertama pengguna. */
  init() {
    const unlock = () => {
      this.unlocked = true;
      this.sync();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    onSoundChange(() => this.sync());
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(STORE_KEY, this.enabled ? "on" : "off");
    } catch {
      /* abaikan */
    }
    this.sync();
  }

  /** Nyalakan / matikan sesuai pengaturan musik dan mute global (tetap jalan saat tab di latar). */
  sync() {
    const want = this.enabled && this.unlocked && !Sound.muted;
    if (want) this.start();
    else this.stop();
  }

  get playing() {
    return this.timer !== null;
  }

  private start() {
    if (this.timer) return;
    const a = audioCtx();
    const bus = musicBus();
    if (!a || !bus) return;
    const master = a.createGain();
    master.gain.setValueAtTime(0.0001, a.currentTime);
    master.gain.linearRampToValueAtTime(0.45, a.currentTime + 2);
    master.connect(bus);
    // Gema lembut ("ruang lounge") untuk piano & melodi.
    const fx = a.createGain();
    const delay = a.createDelay(1);
    const fb = a.createGain();
    const wet = a.createGain();
    const damp = a.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1800;
    delay.delayTime.value = STEP * 3;
    fb.gain.value = 0.3;
    wet.gain.value = 0.25;
    fx.connect(master);
    fx.connect(delay);
    delay.connect(damp).connect(fb).connect(delay);
    damp.connect(wet).connect(master);
    this.master = master;
    this.fxBus = fx;
    this.nextTime = a.currentTime + 0.15;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const m = this.master;
    this.master = null;
    this.fxBus = null;
    if (!m) return;
    const t = m.context.currentTime;
    m.gain.cancelScheduledValues(t);
    m.gain.setValueAtTime(m.gain.value, t);
    m.gain.linearRampToValueAtTime(0.0001, t + 0.5);
    setTimeout(() => m.disconnect(), 700);
  }

  private tick() {
    const a = audioCtx();
    if (!a || !this.master || !this.fxBus) return;
    // Tab sempat tertidur: jangan "mengejar" ratusan nada sekaligus.
    if (this.nextTime < a.currentTime - 0.2) this.nextTime = a.currentTime + 0.05;
    const ahead = document.hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD;
    while (this.nextTime < a.currentTime + ahead) {
      this.schedule(a, this.nextTime);
      this.nextTime += STEP;
      this.step++;
      if (this.step >= BARS * STEPS_PER_BAR) {
        this.step = 0;
        this.loop++;
      }
    }
  }

  private schedule(a: AudioContext, t: number) {
    const out = this.master!;
    const fx = this.fxBus!;
    const bar = Math.floor(this.step / STEPS_PER_BAR);
    const s = this.step % STEPS_PER_BAR;
    const chords = BARS_CHORDS[bar]!;
    const split = chords.length > 1;
    const ch = (split && s >= 4 ? chords[1] : chords[0])!;
    const tt = s % 2 ? t + STEP * SWING : t;

    // --- Drum sapu: ride "ding, ding-da-ding", rim di ketukan 2 & 4, kick pelan.
    if (s !== 1 && s !== 5) noiseHit(a, out, tt, s % 2 ? 0.08 : 0.16, s % 2 ? 0.009 : 0.014, "highpass", 7000);
    if (s % 2 === 0) noiseHit(a, out, tt, 0.22, 0.012, "bandpass", 3200, 0.7, 0.04); // sapuan brush
    if (s === 2 || s === 6) {
      noiseHit(a, out, tt, 0.05, 0.03, "bandpass", 1800, 4);
      osc(a, env(a, out, tt, 0.015, 0.002, 0.04), "triangle", 820, tt, 0.04);
    }
    if (s === 0 || s === 5) osc(a, env(a, out, tt, 0.09, 0.004, 0.25), "sine", 95, tt, 0.25, 48);

    // --- Bas berjalan (tiap ketukan), dengan nada pendekat ke akor birama berikutnya.
    if (s % 2 === 0) {
      const q = s / 2;
      const next = BARS_CHORDS[(bar + 1) % BARS]![0]!.root;
      let n: number;
      if (split) n = q === 0 ? chords[0]!.root : q === 1 ? chords[0]!.root + 7 : q === 2 ? chords[1]!.root : next + (next % 2 ? -1 : 1);
      else n = [ch.root, ch.root + ch.third, ch.root + 7, next + (bar % 2 ? 1 : -1)][q]!;
      upright(a, out, bassRange(n), tt);
    }

    // --- Piano elektrik: comping santai (ketukan 1 ditahan, sinkop "&" ketukan 3).
    const hit = split ? s === 0 || s === 4 : s === 0 || s === 5;
    if (hit) {
      const len = split ? STEP * 3.2 : s === 0 ? STEP * 4.5 : STEP * 2.5;
      epiano(a, fx, voicing(ch), tt, len, 0.024);
    }

    // --- Melodi (diam di 2 birama pertama lagu & tiap putaran ke-3 supaya bernapas).
    if ((this.loop === 0 && bar < 2) || this.loop % 3 === 2) return;
    for (const [at, m, len] of MELODY[bar]!) {
      if (at !== s) continue;
      if (this.loop % 2 === 1) suling(a, fx, m, tt, len * STEP * 0.95);
      else vibes(a, fx, m, tt, len * STEP);
    }
  }
}

export const music = new MusicPlayer();

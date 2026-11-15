import type { SeasonId } from "../data/cards";

/** Efek suara sintetis (WebAudio) — tanpa file aset, ceria ala game kartun. */
let ctx: AudioContext | null = null;
export const Sound = { muted: false };

/** AudioContext bersama (efek suara & musik latar), tanpa memeriksa mute. */
export function audioCtx(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function ac(): AudioContext | null {
  if (Sound.muted) return null;
  return audioCtx();
}

let duckGain: GainNode | null = null;

/** Jalur musik latar: lewat gain "duck" supaya musik mengecil saat jingle penting. */
export function musicBus(): GainNode | null {
  const a = audioCtx();
  if (!a) return null;
  if (!duckGain || duckGain.context !== a) {
    duckGain = a.createGain();
    duckGain.connect(a.destination);
  }
  return duckGain;
}

/** Kecilkan musik latar sebentar (detik) lalu kembalikan pelan-pelan. */
export function duckMusic(dur: number, level = 0.25) {
  if (!duckGain) return;
  const t = duckGain.context.currentTime;
  const g = duckGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(level, t + 0.15);
  g.setValueAtTime(level, t + dur);
  g.linearRampToValueAtTime(1, t + dur + 0.8);
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

let noiseBuf: AudioBuffer | null = null;

/** Desis noise terfilter (statik TV, gedebuk, whoosh). `freqTo` = sapuan frekuensi filter. */
function noise(dur: number, vol: number, type: BiquadFilterType, freq: number, freqTo?: number, delay = 0, q = 1) {
  const a = ac();
  if (!a) return;
  if (!noiseBuf || noiseBuf.sampleRate !== a.sampleRate) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t0);
  if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

/** Akor pendek: beberapa nada dimainkan bersamaan. */
function chord(freqs: number[], dur: number, type: OscillatorType, vol: number, delay: number) {
  for (const f of freqs) tone(f, dur, type, vol / freqs.length, undefined, delay);
}

/** Suara-suara TV berita 3D (event heboh & event musiman). */
export const tvSfx = {
  /** Siulan jatuh dari langit (durasi ≈ animasi jatuh). */
  fall: (dur = 0.7) => {
    tone(1500, dur, "sine", 0.05, 260);
    noise(dur, 0.05, "bandpass", 3000, 600, 0, 2);
  },
  /** Gedebuk mendarat + bunyi pegas antena. */
  thud: () => {
    tone(120, 0.25, "sine", 0.22, 40);
    noise(0.18, 0.18, "lowpass", 600, 120);
    wobble(520, 0.45, "triangle", 0.05, 18, 80, 300, 0.05);
  },
  /** TV tabung menyala: klik, desis statik, dengung naik. */
  powerOn: () => {
    tone(1800, 0.03, "square", 0.05);
    noise(0.35, 0.07, "highpass", 2500, undefined, 0.02);
    tone(90, 0.4, "sawtooth", 0.035, 900, 0.03);
  },
  /** Jingle pembuka berita. Berita heboh = dramatis (minor), musiman = ceria (mayor). */
  jingle: (kind: "event" | "season") => {
    duckMusic(1.6);
    if (kind === "event") {
      // da-da-da-DAAAM!
      [0, 0.12, 0.24].forEach((d) => chord([392, 466, 587], 0.1, "square", 0.09, d + 0.1));
      chord([311, 392, 466, 622], 0.7, "sawtooth", 0.1, 0.46);
      tone(78, 0.7, "triangle", 0.12, 70, 0.46);
    } else {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "square", 0.045, undefined, 0.1 + i * 0.1));
      chord([523, 659, 784, 1047], 0.6, "triangle", 0.12, 0.52);
    }
  },
  /** Kedip sirene "wiu-wiu"; dipanggil berulang selama TV tampil. */
  sirenBeep: (high: boolean) => tone(high ? 960 : 720, 0.22, "triangle", 0.025, high ? 900 : 760),
  /** TV tabung dimatikan: "piuuu" turun + klik. */
  powerOff: () => {
    tone(1400, 0.32, "sine", 0.06, 60);
    noise(0.12, 0.05, "highpass", 4000);
    tone(2200, 0.02, "square", 0.04, undefined, 0.3);
  },
  /** Whoosh saat TV melompat pergi. */
  whoosh: () => noise(0.4, 0.08, "bandpass", 400, 2500, 0, 1.5),
};

/** Suara-suara kartu 3D (ambil dari tumpukan, buka, simpan, lempar). */
export const cardSfx = {
  /** Kartu digeser dari tumpukan: "srek" kertas + tik. */
  slide: () => {
    noise(0.14, 0.09, "highpass", 3500, 7000);
    tone(2400, 0.02, "square", 0.025, undefined, 0.01);
  },
  /** Kartu berputar di udara: kepak kertas yang makin melambat. */
  flutter: (dur: number) => {
    let t = 0;
    let gap = 0.035;
    while (t < dur) {
      noise(0.03, 0.05 * (1 - (t / dur) * 0.6), "bandpass", 2600 + Math.random() * 800, undefined, t, 3);
      t += gap;
      gap *= 1.12;
    }
  },
  /** Kartu dibalik: "fwip" + pop. */
  flip: () => {
    noise(0.12, 0.08, "bandpass", 1200, 5000, 0, 2);
    tone(520, 0.08, "sine", 0.1, 1100, 0.06);
  },
  /** Muka kartu terlihat: denting ceria (kartu biasa) atau kilau ajaib (kartu simpanan). */
  reveal: (kind: "card" | "item") => {
    if (kind === "card") {
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, "triangle", 0.06, undefined, 0.05 + i * 0.06));
    } else {
      [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.3, "sine", 0.05, undefined, 0.04 + i * 0.05));
      wobble(1568, 0.6, "sine", 0.03, 9, 40, undefined, 0.3);
    }
  },
  /** Kartu biasa terbang ke atas & menghilang: whoosh naik + poof. */
  vanish: () => {
    noise(0.35, 0.07, "bandpass", 500, 3500, 0, 1.5);
    tone(600, 0.25, "sine", 0.04, 2000);
    noise(0.12, 0.06, "lowpass", 1500, 300, 0.3);
  },
  /** Kartu simpanan mengecil masuk kantong pion: "sluurp" naik + pop. */
  pocket: (dur: number) => {
    wobble(300, dur, "triangle", 0.06, 20, 30, 1300);
    tone(880, 0.07, "square", 0.04, 1760, dur);
  },
  /** Kartu simpanan muncul di atas pion: "bloop". */
  appear: () => tone(300, 0.18, "sine", 0.1, 900),
  /** Kartu dilempar berputar seperti frisbee: dengung "wuung" yang naik-turun. */
  whirl: (dur: number) => {
    wobble(420, dur, "sawtooth", 0.035, 22, 120, 260);
    noise(dur, 0.05, "bandpass", 900, 2400, 0, 2);
  },
  /** Kartu menghantam sasaran: "plak!" */
  hit: () => {
    noise(0.12, 0.2, "lowpass", 2500, 400);
    tone(180, 0.15, "square", 0.08, 60);
    tone(1400, 0.05, "square", 0.03, undefined, 0.02);
  },
};

/** Suara khas tiap event musiman (diputar setelah jingle TV) + suara saat musim berakhir. */
export const seasonSfx: Record<SeasonId, () => void> & { end: () => void } = {
  /** Musim Turis: jepretan kamera beruntun + "pyiing" lampu kilat. */
  turis: () => {
    [0, 0.28, 0.42].forEach((d) => {
      noise(0.03, 0.14, "highpass", 3000, undefined, d);
      noise(0.06, 0.1, "lowpass", 1800, 500, d + 0.05);
      tone(2800, 0.15, "sine", 0.025, 4200, d + 0.02);
    });
    [784, 988].forEach((f, i) => tone(f, 0.18, "triangle", 0.05, undefined, 0.75 + i * 0.16));
  },
  /** Banjir: cipratan air, gelembung, lalu rintik hujan. */
  banjir: () => {
    noise(0.7, 0.16, "lowpass", 2200, 200);
    for (let i = 0; i < 8; i++) tone(300 + Math.random() * 400, 0.07, "sine", 0.06, 900 + Math.random() * 600, 0.15 + i * 0.09);
    for (let i = 0; i < 18; i++) noise(0.02, 0.05, "highpass", 5000, undefined, 0.6 + Math.random() * 1.1);
  },
  /** Harbolnas: "ka-ching" mesin kasir + fanfare diskon. */
  diskon: () => {
    noise(0.05, 0.12, "bandpass", 1500, undefined, 0, 4);
    noise(0.05, 0.12, "bandpass", 1100, undefined, 0.08, 4);
    tone(2637, 0.6, "sine", 0.06, undefined, 0.16);
    tone(3520, 0.5, "sine", 0.04, undefined, 0.16);
    noise(0.25, 0.06, "bandpass", 600, 1500, 0.2, 2);
    [659, 784, 1047].forEach((f, i) => tone(f, 0.14, "square", 0.04, undefined, 0.55 + i * 0.1));
  },
  /** Musim THR: hujan koin bergemerincing. */
  thr: () => {
    for (let i = 0; i < 12; i++) {
      const d = i * 0.08 + Math.random() * 0.04;
      tone(988 + Math.random() * 200, 0.07, "square", 0.03, undefined, d);
      tone(1319 + Math.random() * 300, 0.18, "square", 0.03, undefined, d + 0.06);
    }
  },
  /** Musim selesai: denting turun pelan "tulalit" + whoosh lembut. */
  end: () => {
    [1047, 784, 659, 523].forEach((f, i) => tone(f, 0.3, "sine", 0.06, undefined, i * 0.13));
    noise(0.5, 0.04, "bandpass", 2000, 400, 0.1, 1.2);
  },
};

export const sfx = {
  fart: () => {
    wobble(95, 0.7, "sawtooth", 0.14, 28, 30, 60);
    wobble(70, 0.35, "square", 0.06, 40, 20, 50, 0.55);
  },
  sadTrombone: () => [392, 370, 349].forEach((f, i) => wobble(f / 2, i === 2 ? 0.9 : 0.35, "sawtooth", 0.06, i === 2 ? 6 : 0.1, i === 2 ? 8 : 0, undefined, i * 0.38)),
  /** Baling-baling helikopter: "dug-dug-dug" naik lalu menjauh. */
  heli: () => {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const env = Math.sin((i / (n - 1)) * Math.PI); // pelan → keras → pelan
      const vol = 0.03 + env * 0.11;
      noise(0.07, vol, "lowpass", 380, 140, i * 0.075);
      tone(58, 0.06, "sine", vol * 0.8, 45, i * 0.075);
    }
  },
  zap: () => {
    for (let i = 0; i < 5; i++) tone(1200 - i * 180, 0.06, "sawtooth", 0.05, 200, i * 0.05);
  },
  boing: () => wobble(220, 0.5, "sine", 0.1, 14, 60, 520),
  honk: () => {
    wobble(330, 0.25, "square", 0.07, 30, 15);
    wobble(330, 0.35, "square", 0.07, 30, 15, undefined, 0.32);
  },
  /** Pesta pejabat: denting gelas "ting-ting" lalu fanfare kecil yang mewah. */
  pejabat: () => {
    // Dua kali bersulang: nada tinggi bening dengan sedikit "shimmer"
    for (const d of [0, 0.22]) {
      tone(2093, 0.5, "sine", 0.07, undefined, d);
      tone(2637, 0.4, "sine", 0.045, undefined, d + 0.005);
      tone(3136, 0.25, "sine", 0.025, undefined, d + 0.01);
    }
    // Fanfare: arpeggio naik lalu akor tahan
    [523, 659, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.07, undefined, 0.5 + i * 0.11));
    chord([523, 659, 784, 1047], 0.7, "triangle", 0.18, 0.85);
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
  fly: () => tone(300, 0.9, "sine", 0.06, 1200),
  bad: () => [392, 330, 262].forEach((f, i) => tone(f, 0.2, "triangle", 0.07, undefined, i * 0.15)),
  win: () => {
    duckMusic(2);
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.18, "square", 0.06, undefined, i * 0.12));
  },
  click: () => tone(700, 0.05, "square", 0.04),
};

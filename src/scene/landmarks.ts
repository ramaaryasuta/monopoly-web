import { Mesh, MeshBuilder, Vector3, type Scene } from "@babylonjs/core";

/**
 * Model landmark (level 5) per petak — dibangun dari primitif 3D bergaya kartun.
 * Tempat ikonik punya model sendiri; sisanya memakai model tema (warung, kantor, mal, tambang, rumah).
 *
 * Konvensi: lantai di y = 0, muka bangunan menghadap -z (ke arah petak / luar papan),
 * jejak kira-kira ±0.8 (x) × ±0.7 (z), tinggi maksimum ±3.2 supaya tidak menutupi petak lain.
 * Warna pemilik (`color`) selalu tampak di bagian utama + bendera kecil.
 */

type Add = (m: Mesh, hex: string, shadow?: boolean) => Mesh;
type XYZ = [number, number, number];

const STONE = "#a8977f";
const DARK_STONE = "#8a7a66";
const WHITE = "#fffaf0";
const CREAM = "#fff1d6";
const INK = "#2b1d3a";
const GOLD = "#ffd23f";
const GLASS = "#9fd8ff";
const WOOD = "#a8673a";
const WIN = "#3a3550";

class Kit {
  constructor(
    private s: Scene,
    private add: Add,
    readonly color: string,
  ) {}

  private place(m: Mesh, hex: string, at: XYZ, rot?: XYZ, shadow = true) {
    this.add(m, hex, shadow);
    m.position.set(at[0], at[1], at[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    return m;
  }

  /** Kotak; `at` = titik tengah. */
  box(w: number, h: number, d: number, at: XYZ, hex: string, rot?: XYZ, shadow = true) {
    return this.place(MeshBuilder.CreateBox("lm", { width: w, height: h, depth: d }, this.s), hex, at, rot, shadow);
  }

  cyl(top: number, bottom: number, h: number, at: XYZ, hex: string, tess = 12, rot?: XYZ, shadow = true) {
    return this.place(
      MeshBuilder.CreateCylinder("lm", { diameterTop: top, diameterBottom: bottom, height: h, tessellation: tess }, this.s),
      hex,
      at,
      rot,
      shadow,
    );
  }

  ball(d: number, at: XYZ, hex: string, scale?: XYZ, shadow = true) {
    const m = this.place(MeshBuilder.CreateSphere("lm", { diameter: d, segments: 12 }, this.s), hex, at, undefined, shadow);
    if (scale) m.scaling.set(scale[0], scale[1], scale[2]);
    return m;
  }

  ring(d: number, thick: number, at: XYZ, hex: string, rot?: XYZ) {
    return this.place(MeshBuilder.CreateTorus("lm", { diameter: d, thickness: thick, tessellation: 24 }, this.s), hex, at, rot, false);
  }

  tube(path: Vector3[], r: number, hex: string) {
    return this.place(MeshBuilder.CreateTube("lm", { path, radius: r, tessellation: 8, cap: Mesh.CAP_ALL }, this.s), hex, [0, 0, 0]);
  }

  capsule(r: number, h: number, at: XYZ, hex: string, rot?: XYZ) {
    return this.place(MeshBuilder.CreateCapsule("lm", { radius: r, height: h }, this.s), hex, at, rot);
  }

  /** Bendera kecil warna pemilik di ujung tiang. */
  pennant(x: number, baseY: number, z: number, h = 0.5) {
    this.cyl(0.04, 0.04, h, [x, baseY + h / 2, z], WHITE, 6, undefined, false);
    this.box(0.32, 0.2, 0.03, [x + 0.17, baseY + h - 0.1, z], this.color, undefined, false);
  }

  /** Wajah "sultan": kacamata hitam + kumis, ciri khas landmark. */
  sultan(y: number, z: number, k = 1) {
    for (const sx of [-0.13, 0.13]) this.box(0.2 * k, 0.12 * k, 0.04, [sx * k, y, z], "#111122", undefined, false);
    this.box(0.1 * k, 0.03 * k, 0.04, [0, y + 0.02 * k, z], "#111122", undefined, false);
    for (const sx of [-1, 1]) this.capsule(0.045 * k, 0.3 * k, [sx * 0.11 * k, y - 0.16 * k, z - 0.01], INK, [0, 0, sx * (Math.PI / 2 - 0.4)]);
  }

  /** Mata googly. */
  eyes(y: number, z: number, gap = 0.14, d = 0.16) {
    for (const sx of [-gap, gap]) {
      const w = this.ball(d, [sx, y, z], "#ffffff", [1, 1, 0.45], false);
      w.renderOutline = true;
      const p = this.ball(d * 0.45, [sx + (Math.random() - 0.5) * 0.03, y - d * 0.1, z - d * 0.2], INK, undefined, false);
      p.renderOutline = false;
    }
  }

  /** Deretan jendela gelap di muka bangunan (sisi -z). */
  windows(cols: number, rows: number, w: number, y0: number, dy: number, z: number, ww = 0.1, wh = 0.14, hex = WIN, x0 = 0) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = x0 + (cols === 1 ? 0 : -w / 2 + (w * c) / (cols - 1));
        this.box(ww, wh, 0.02, [x, y0 + r * dy, z], hex, undefined, false);
      }
  }
}

// ------------------------------------------------------------------ landmark ikonik

const ICONIC: Record<string, (k: Kit) => void> = {
  "Candi Borobudur": (k) => {
    // Teras persegi bertingkat + teras bundar berstupa + stupa induk
    const terr = [1.6, 1.36, 1.12, 0.9];
    terr.forEach((w, i) => k.box(w, 0.22, w, [0, 0.11 + i * 0.22, 0], i % 2 ? STONE : DARK_STONE));
    k.box(1.66, 0.07, 1.66, [0, 0.2, 0], k.color);
    const ringY = 0.88;
    [0.78, 0.56].forEach((d, i) => {
      k.cyl(d, d, 0.14, [0, ringY + 0.07 + i * 0.14, 0], STONE, 24);
      const n = i === 0 ? 8 : 6;
      const r = d / 2 - 0.07;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        const y = ringY + 0.14 + i * 0.14;
        k.ball(0.13, [Math.cos(a) * r, y + 0.06, Math.sin(a) * r], DARK_STONE, [1, 1.1, 1]);
        k.cyl(0, 0.04, 0.08, [Math.cos(a) * r, y + 0.15, Math.sin(a) * r], DARK_STONE, 6);
      }
    });
    k.ball(0.42, [0, 1.36, 0], STONE, [1, 1.05, 1]);
    k.cyl(0.02, 0.1, 0.4, [0, 1.72, 0], DARK_STONE, 8);
    k.pennant(0, 1.88, 0, 0.45);
  },

  "Candi Prambanan": (k) => {
    k.box(1.6, 0.25, 1.1, [0, 0.125, 0], DARK_STONE);
    k.box(1.66, 0.07, 1.16, [0, 0.22, 0], k.color);
    const tower = (x: number, s: number) => {
      const tiers = 6;
      let y = 0.25;
      for (let i = 0; i < tiers; i++) {
        const w = (0.62 - i * 0.07) * s;
        const h = (0.42 - i * 0.04) * s;
        k.cyl(w * 0.92, w, h, [x, y + h / 2, 0], i % 2 ? STONE : DARK_STONE, 4, [0, Math.PI / 4, 0]);
        y += h;
      }
      k.cyl(0, 0.16 * s, 0.4 * s, [x, y + 0.2 * s, 0], DARK_STONE, 8);
      return y + 0.4 * s;
    };
    const top = tower(0, 1.15);
    tower(-0.58, 0.62);
    tower(0.58, 0.62);
    k.box(0.22, 0.3, 0.05, [0, 0.55, -0.37], INK, undefined, false); // pintu candi
    k.pennant(0, top, 0, 0.35);
  },

  "Gedung Sate": (k) => {
    k.box(1.7, 0.12, 0.85, [0, 0.06, 0], "#d9d2c3");
    k.box(1.6, 0.6, 0.7, [0, 0.42, 0], WHITE);
    k.box(1.64, 0.08, 0.74, [0, 0.76, 0], k.color);
    k.windows(7, 1, 1.35, 0.42, 0, -0.36, 0.1, 0.22);
    // Menara tengah beratap tumpang + tusuk sate
    k.box(0.5, 0.45, 0.5, [0, 1.02, 0], WHITE);
    k.cyl(0.25, 0.85, 0.35, [0, 1.42, 0], k.color, 4, [0, Math.PI / 4, 0]);
    k.cyl(0.05, 0.45, 0.3, [0, 1.74, 0], k.color, 4, [0, Math.PI / 4, 0]);
    k.cyl(0.03, 0.03, 1.0, [0, 2.3, 0], WOOD, 6);
    for (let i = 0; i < 6; i++) k.ball(0.11 - i * 0.008, [0, 1.95 + i * 0.13, 0], "#7a4a24");
    k.box(0.22, 0.32, 0.04, [0, 0.28, -0.36], WOOD, undefined, false);
  },

  "Jam Gadang": (k) => {
    k.box(0.95, 0.3, 0.95, [0, 0.15, 0], "#d9d2c3");
    k.box(0.62, 1.8, 0.62, [0, 1.2, 0], WHITE);
    for (let i = 0; i < 3; i++) k.box(0.66, 0.05, 0.66, [0, 0.55 + i * 0.5, 0], "#d9d2c3");
    // Muka jam di keempat sisi
    const faces: [XYZ, XYZ][] = [
      [[0, 1.75, -0.32], [Math.PI / 2, 0, 0]],
      [[0, 1.75, 0.32], [-Math.PI / 2, 0, 0]],
      [[-0.32, 1.75, 0], [0, 0, -Math.PI / 2]],
      [[0.32, 1.75, 0], [0, 0, Math.PI / 2]],
    ];
    for (const [at, rot] of faces) {
      k.cyl(0.42, 0.42, 0.03, at, "#ffffff", 24, rot, false);
      k.ring(0.42, 0.04, at, INK, rot);
    }
    k.box(0.03, 0.15, 0.02, [0, 1.81, -0.345], INK, undefined, false);
    k.box(0.11, 0.03, 0.02, [0.05, 1.75, -0.345], INK, undefined, false);
    // Atap gonjong Minang: limas + empat tanduk melengkung ke atas
    k.cyl(0.1, 0.95, 0.4, [0, 2.3, 0], k.color, 4, [0, Math.PI / 4, 0]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      k.cyl(0, 0.15, 0.6, [sx * 0.32, 2.5, sz * 0.32], k.color, 8, [sz * 0.3, 0, -sx * 0.3]);
    }
    k.cyl(0, 0.12, 0.55, [0, 2.75, 0], k.color, 8);
    k.ball(0.1, [0, 3.05, 0], GOLD);
  },

  "Masjid Istiqlal": (k) => {
    k.box(1.3, 0.12, 1.0, [0, 0.06, 0], "#d9d2c3");
    k.box(1.15, 0.55, 0.85, [0, 0.4, 0], WHITE);
    k.windows(5, 1, 0.85, 0.38, 0, -0.43, 0.1, 0.22);
    k.box(1.19, 0.06, 0.89, [0, 0.7, 0], k.color);
    k.ball(0.95, [0, 0.78, 0], "#e6edf5", [1, 0.85, 1]);
    k.ring(0.9, 0.06, [0, 0.82, 0], k.color);
    k.cyl(0.02, 0.05, 0.3, [0, 1.32, 0], GOLD, 6);
    k.ball(0.1, [0, 1.5, 0], GOLD);
    // Menara
    const mx = 0.75;
    k.cyl(0.16, 0.2, 2.3, [mx, 1.15, -0.25], WHITE, 12);
    k.ring(0.28, 0.05, [mx, 1.5, -0.25], k.color);
    k.ring(0.28, 0.05, [mx, 2.1, -0.25], k.color);
    k.cyl(0, 0.2, 0.35, [mx, 2.47, -0.25], "#e6edf5", 12);
    k.ball(0.08, [mx, 2.7, -0.25], GOLD);
  },

  "Gedung DPR": (k) => {
    k.box(1.7, 0.12, 0.95, [0, 0.06, 0], "#d9d2c3");
    k.box(1.55, 0.4, 0.8, [0, 0.32, 0], WHITE);
    k.windows(8, 1, 1.3, 0.3, 0, -0.41, 0.08, 0.2);
    k.box(1.59, 0.06, 0.84, [0, 0.55, 0], k.color);
    // Kubah "kura-kura" terbelah dua, hijau
    for (const sx of [-1, 1]) {
      const d = k.ball(1.25, [sx * 0.2, 0.58, 0], "#3fae6a", [0.55, 0.55, 0.62]);
      d.rotation.z = sx * 0.12;
    }
    k.box(0.06, 0.5, 0.7, [0, 0.82, 0], WHITE);
    k.pennant(0.7, 0.58, 0.3, 0.6);
    k.sultan(0.95, -0.4, 0.9);
  },

  "Istana Presiden": (k) => {
    k.box(1.7, 0.1, 1.0, [0, 0.05, 0], "#d9d2c3");
    k.box(1.6, 0.08, 0.9, [0, 0.14, 0.03], "#e9e2d3");
    k.box(1.5, 0.6, 0.65, [0, 0.48, 0.1], WHITE);
    k.windows(6, 1, 1.25, 0.5, 0, -0.23, 0.08, 0.24);
    // Serambi bertiang + pediment
    for (let i = 0; i < 6; i++) k.cyl(0.08, 0.09, 0.6, [-0.5 + i * 0.2, 0.48, -0.3], WHITE, 10);
    k.box(1.25, 0.08, 0.3, [0, 0.82, -0.2], WHITE);
    k.box(1.25, 0.22, 0.22, [0, 0.86, -0.2], k.color, [Math.PI / 4, 0, 0]);
    k.box(1.55, 0.06, 0.7, [0, 0.81, 0.1], k.color);
    // Tiang bendera merah putih di halaman depan
    k.cyl(0.04, 0.04, 1.6, [0.75, 0.8, -0.55], WHITE, 6);
    k.box(0.44, 0.13, 0.03, [0.98, 1.47, -0.55], "#e8322b", undefined, false);
    k.box(0.44, 0.13, 0.03, [0.98, 1.34, -0.55], "#ffffff", undefined, false);
  },

  "Tugu Jogja": (k) => {
    k.box(0.9, 0.25, 0.9, [0, 0.125, 0], "#d9d2c3");
    k.box(0.7, 0.35, 0.7, [0, 0.42, 0], WHITE);
    k.box(0.74, 0.06, 0.74, [0, 0.6, 0], k.color);
    k.cyl(0.26, 0.42, 1.5, [0, 1.38, 0], WHITE, 8);
    k.ring(0.42, 0.06, [0, 0.9, 0], k.color);
    k.ring(0.32, 0.06, [0, 1.7, 0], k.color);
    // Puncak spiral emas
    k.cyl(0.08, 0.3, 0.25, [0, 2.25, 0], GOLD, 8);
    for (let i = 0; i < 4; i++) k.ball(0.22 - i * 0.04, [0, 2.45 + i * 0.15, 0], GOLD, [1, 0.7, 1]);
    k.cyl(0, 0.06, 0.35, [0, 3.0, 0], GOLD, 6);
  },

  "Buletan HI": (k) => {
    // Kolam bundar + air mancur + patung Selamat Datang
    k.cyl(1.55, 1.6, 0.18, [0, 0.09, 0], k.color, 32);
    k.cyl(1.35, 1.35, 0.06, [0, 0.17, 0], "#4dc3ff", 32, undefined, false);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.cyl(0.03, 0.06, 0.55, [Math.cos(a) * 0.5, 0.45, Math.sin(a) * 0.5], "#c9f1ff", 6, [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25], false);
    }
    k.cyl(0.22, 0.3, 1.3, [0, 0.82, 0], WHITE, 10);
    for (const sx of [-1, 1]) {
      k.capsule(0.08, 0.42, [sx * 0.09, 1.68, 0], "#c8a46a");
      k.ball(0.12, [sx * 0.09, 1.95, 0], "#c8a46a");
      k.capsule(0.035, 0.32, [sx * 0.2, 1.98, 0], "#c8a46a", [0, 0, sx * -0.5]);
    }
    k.ball(0.12, [0, 2.15, 0], GOLD); // buket bunga
  },

  "Jembatan Mahakam": (k) => {
    // Air sungai + dek + dua lengkung rangka baja (warna pemilik)
    k.box(1.75, 0.08, 0.9, [0, 0.04, 0], "#3fa8e0");
    k.box(1.75, 0.08, 0.5, [0, 0.5, 0], "#7d7d8c");
    for (const sx of [-0.7, 0.7]) k.box(0.18, 0.5, 0.45, [sx, 0.25, 0], "#9a9aa8");
    for (const z of [-0.22, 0.22]) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push(new Vector3(-0.8 + 1.6 * t, 0.55 + Math.sin(t * Math.PI) * 0.85, z));
      }
      k.tube(pts, 0.045, k.color);
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const h = Math.sin(t * Math.PI) * 0.85;
        k.cyl(0.025, 0.025, h, [-0.8 + 1.6 * t, 0.55 + h / 2, z], k.color, 6, undefined, false);
      }
    }
    for (let i = 1; i < 8; i += 2) k.box(0.03, 0.03, 0.44, [-0.8 + (1.6 * i) / 8, 0.55 + Math.sin((i / 8) * Math.PI) * 0.85, 0], k.color, undefined, false);
    k.box(0.28, 0.14, 0.18, [-0.2, 0.62, -0.08], "#ff5b5b"); // mobil kecil
  },

  "Karimun Jawa": (k) => {
    k.ball(1.7, [0, 0, 0], "#ffe2a1", [1, 0.22, 0.85]);
    k.ball(1.2, [0, -0.05, 0], "#6fdc5b", [1, 0.28, 0.7]);
    // Mercusuar belang (putih / warna pemilik)
    for (let i = 0; i < 5; i++) k.cyl(0.34 - i * 0.03, 0.37 - i * 0.03, 0.42, [0.35, 0.3 + i * 0.42, 0.1], i % 2 ? k.color : "#ffffff", 14);
    k.cyl(0.3, 0.3, 0.06, [0.35, 2.36, 0.1], INK, 14);
    k.cyl(0.22, 0.22, 0.25, [0.35, 2.52, 0.1], "#fff3a0", 10);
    k.cyl(0, 0.34, 0.3, [0.35, 2.8, 0.1], k.color, 10);
    // Pohon kelapa
    const trunk: Vector3[] = [];
    for (let i = 0; i <= 6; i++) trunk.push(new Vector3(-0.45 + Math.sin(i / 6) * 0.25, 0.1 + i * 0.22, -0.15));
    k.tube(trunk, 0.06, WOOD);
    const top = trunk[trunk.length - 1];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.box(0.6, 0.04, 0.16, [top.x + Math.cos(a) * 0.28, top.y - 0.08, top.z + Math.sin(a) * 0.28], "#3fbf4a", [0, -a, -0.35]);
    }
    k.ball(0.12, [top.x + 0.05, top.y - 0.1, top.z], "#7a4a24");
  },

  "Sam Poo Kong": (k) => {
    k.box(1.5, 0.15, 1.05, [0, 0.075, 0], "#b7b0a5");
    k.box(1.2, 0.55, 0.75, [0, 0.42, 0], "#d6342c");
    for (const x of [-0.5, -0.17, 0.17, 0.5]) k.cyl(0.08, 0.08, 0.55, [x, 0.42, -0.4], "#b8241d", 8);
    k.box(0.3, 0.38, 0.03, [0, 0.34, -0.38], GOLD, undefined, false);
    // Atap pagoda tiga tingkat (warna pemilik) dengan ujung melengkung emas
    let y = 0.7;
    [1.75, 1.3, 0.85].forEach((w, i) => {
      k.cyl(w * 0.45, w, 0.24, [0, y + 0.12, 0], k.color, 4, [0, Math.PI / 4, 0]).scaling.z = 0.75;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.ball(0.09, [sx * w * 0.36, y + 0.1, sz * w * 0.27], GOLD);
      y += 0.24;
      if (i < 2) {
        k.box(w * 0.42, 0.22, w * 0.32, [0, y + 0.11, 0], "#d6342c");
        y += 0.22;
      }
    });
    k.ball(0.16, [0, y + 0.05, 0], GOLD);
  },

  IKN: (k) => {
    // Istana Garuda: gedung + bilah sayap logam mengipas
    k.box(1.6, 0.12, 0.9, [0, 0.06, 0], "#d9d2c3");
    k.box(1.2, 0.45, 0.6, [0, 0.34, 0.1], WHITE);
    k.windows(6, 1, 0.95, 0.32, 0, -0.21, 0.08, 0.22, GLASS);
    k.box(1.24, 0.06, 0.64, [0, 0.59, 0.1], k.color);
    const blades = 11;
    for (let i = 0; i < blades; i++) {
      const t = i / (blades - 1);
      const a = (t - 0.5) * 2.2;
      const len = 1.3 - Math.abs(t - 0.5) * 0.9;
      const m = k.box(0.09, len, 0.06, [Math.sin(a) * len * 0.5, 0.62 + Math.cos(a) * len * 0.5, 0.2], i % 2 ? "#c9a227" : "#b08a1a");
      m.rotation.z = -a;
    }
    k.ball(0.3, [0, 0.95, 0.12], "#c9a227");
    k.cyl(0, 0.2, 0.28, [0, 0.92, -0.06], "#c9a227", 3, [Math.PI / 2, 0, 0]); // paruh
  },

  "Lembang Park Zoo": (k) => {
    // Gerbang (kiri) + jerapah (kanan) supaya jerapah tidak tertutup gerbang
    const gx = -0.42;
    for (const sx of [-0.33, 0.33]) k.box(0.16, 0.95, 0.16, [gx + sx, 0.475, -0.25], WOOD);
    k.box(0.9, 0.28, 0.12, [gx, 1.05, -0.25], k.color);
    k.box(0.68, 0.1, 0.13, [gx, 1.05, -0.26], "#ffffff", undefined, false);
    for (const sx of [-0.33, 0.33]) k.ball(0.2, [gx + sx, 1.24, -0.25], "#3fbf4a");
    const Y = "#ffc93c";
    const jx = 0.42;
    for (const [x, z] of [[-0.14, 0.05], [0.14, 0.05], [-0.14, 0.4], [0.14, 0.4]]) k.cyl(0.07, 0.07, 0.6, [jx + x, 0.3, z], Y, 8);
    k.capsule(0.2, 0.7, [jx, 0.72, 0.22], Y, [Math.PI / 2, 0, 0]);
    k.cyl(0.1, 0.14, 1.0, [jx, 1.22, -0.02], Y, 10, [-0.45, 0, 0]);
    k.capsule(0.11, 0.38, [jx, 1.72, -0.2], Y, [Math.PI / 2 - 0.3, 0, 0]);
    for (const sx of [-0.06, 0.06]) k.cyl(0.03, 0.03, 0.14, [jx + sx, 1.87, -0.13], WOOD, 6);
    for (const [x, y, z] of [[0.12, 0.8, 0.1], [-0.13, 0.75, 0.3], [0.1, 0.7, 0.42], [0.05, 1.15, 0.02], [-0.05, 1.42, -0.1]])
      k.ball(0.09, [jx + x, y, z], "#a0602a", [1, 1, 0.5], false);
    for (const sx of [-0.07, 0.07]) {
      k.ball(0.09, [jx + sx, 1.78, -0.33], "#ffffff", [1, 1, 0.45], false).renderOutline = true;
      k.ball(0.04, [jx + sx, 1.77, -0.36], INK, undefined, false).renderOutline = false;
    }
  },

  "Lawang Rongewu": (k) => {
    // Gedung kolonial seribu pintu + dua menara kembar berkubah
    k.box(1.75, 0.1, 0.9, [0, 0.05, 0], "#d9d2c3");
    k.box(1.65, 0.85, 0.7, [0, 0.52, 0.05], WHITE);
    k.box(1.69, 0.07, 0.74, [0, 0.98, 0.05], k.color);
    k.windows(9, 2, 1.45, 0.3, 0.38, -0.31, 0.09, 0.26, WOOD);
    for (const sx of [-0.28, 0.28]) {
      k.box(0.36, 1.45, 0.36, [sx, 0.82, -0.25], WHITE);
      k.windows(1, 3, 0, 0.55, 0.35, -0.44, 0.1, 0.2, WOOD, sx);
      k.ball(0.36, [sx, 1.6, -0.25], k.color, [1, 0.9, 1]);
      k.cyl(0, 0.04, 0.25, [sx, 1.85, -0.25], GOLD, 6);
    }
  },
};

// ------------------------------------------------------------------ model tema

type ThemeFn = (k: Kit, variant: string) => void;

/** Warung dengan makanan raksasa di atap. */
const warung: ThemeFn = (k, variant) => {
  k.box(1.3, 0.12, 0.9, [0, 0.06, 0], "#d9c3a0");
  k.box(1.1, 0.6, 0.65, [0, 0.42, 0.08], CREAM);
  k.box(1.15, 0.25, 0.25, [0, 0.25, -0.32], WOOD);
  // Tenda belang warna pemilik
  for (let i = 0; i < 6; i++) k.box(0.2, 0.05, 0.42, [-0.5 + i * 0.2, 0.86, -0.32], i % 2 ? "#ffffff" : k.color, [0.35, 0, 0]);
  k.box(1.14, 0.1, 0.69, [0, 0.77, 0.08], k.color);
  k.eyes(0.55, -0.26, 0.2, 0.18);
  const y = 0.82;
  switch (variant) {
    case "mie": // Burjo: mangkuk mie + telur
      k.cyl(0.85, 0.45, 0.4, [0, y + 0.2, 0.08], "#ffffff", 20);
      k.ring(0.78, 0.07, [0, y + 0.38, 0.08], "#e8322b");
      k.cyl(0.74, 0.74, 0.04, [0, y + 0.38, 0.08], "#ffd36b", 20, undefined, false);
      for (let i = 0; i < 4; i++) k.ring(0.3 + i * 0.1, 0.04, [0, y + 0.41, 0.08], "#ffe9a0");
      k.ball(0.3, [0.15, y + 0.42, 0], "#ffffff", [1, 0.4, 1]);
      k.ball(0.14, [0.15, y + 0.47, 0], "#ffb300", [1, 0.5, 1]);
      k.cyl(0.03, 0.03, 0.8, [-0.2, y + 0.65, 0.1], WOOD, 6, [0, 0, 0.3]);
      k.cyl(0.03, 0.03, 0.8, [-0.13, y + 0.65, 0.1], WOOD, 6, [0, 0, 0.35]);
      break;
    case "ayam": // OTY: paha ayam goreng raksasa
      k.ball(0.75, [-0.12, y + 0.45, 0.08], "#c97a2a", [1, 0.8, 0.8]).rotation.z = 0.5;
      k.cyl(0.12, 0.12, 0.55, [0.32, y + 0.75, 0.08], "#fff6e6", 10, [0, 0, -0.9]);
      for (const dz of [-0.07, 0.07]) k.ball(0.17, [0.56, y + 0.94, 0.08 + dz], "#fff6e6");
      break;
    case "nasi": // RM Pagi Sore: piring nasi + rendang + daun
      k.cyl(0.95, 0.75, 0.08, [0, y + 0.05, 0.08], "#ffffff", 24);
      k.ball(0.55, [-0.1, y + 0.14, 0.08], "#ffffff", [1, 0.9, 1]);
      for (const [x, z] of [[0.28, -0.05], [0.3, 0.2], [0.15, 0.3]]) k.box(0.2, 0.12, 0.16, [x, y + 0.15, z], "#6b3a1e", [0, x * 3, 0]);
      k.box(0.35, 0.02, 0.18, [-0.25, y + 0.12, 0.33], "#3fbf4a", [0, 0.6, 0]);
      break;
    case "sei": // Sei: panggangan + daging asap
      k.box(0.9, 0.2, 0.5, [0, y + 0.12, 0.08], "#3a3a44");
      for (let i = 0; i < 5; i++) k.box(0.13, 0.06, 0.4, [-0.32 + i * 0.16, y + 0.26, 0.08], i % 2 ? "#b8322b" : "#d24a3a");
      for (let i = 0; i < 3; i++) k.ball(0.22 + i * 0.06, [0.1 - i * 0.1, y + 0.55 + i * 0.25, 0.1], "#d8d8e0", undefined, false);
      break;
    case "kopi": // Kopi: gelas kopi susu raksasa + sedotan
      k.cyl(0.62, 0.48, 0.95, [0, y + 0.5, 0.08], "#c79a6b", 20);
      k.cyl(0.64, 0.64, 0.22, [0, y + 0.5, 0.08], k.color, 20);
      k.cyl(0.68, 0.68, 0.08, [0, y + 1.0, 0.08], "#ffffff", 20);
      k.cyl(0.05, 0.05, 0.6, [0.12, y + 1.25, 0.08], "#ff5b8a", 8, [0, 0, -0.2]);
      break;
  }
};

/** Gedung kantor kaca bertingkat dengan wajah sultan dan properti atap. */
const kantor: ThemeFn = (k, variant) => {
  k.box(1.2, 0.12, 0.9, [0, 0.06, 0], "#c9c9d6");
  k.box(0.95, 2.0, 0.7, [0, 1.1, 0.05], GLASS);
  for (let i = 0; i < 6; i++) k.box(0.99, 0.04, 0.74, [0, 0.35 + i * 0.32, 0.05], "#e9f6ff");
  k.box(0.99, 0.18, 0.74, [0, 2.15, 0.05], k.color);
  k.box(0.3, 0.32, 0.03, [0, 0.28, -0.31], INK, undefined, false);
  k.sultan(1.35, -0.32, 1.3);
  const y = 2.24;
  switch (variant) {
    case "polisi": // Lampu sirene biru-merah
      k.box(0.5, 0.1, 0.22, [0, y + 0.05, 0.05], "#ffffff");
      k.ball(0.2, [-0.15, y + 0.18, 0.05], "#2f6bff", [1, 0.8, 1]);
      k.ball(0.2, [0.15, y + 0.18, 0.05], "#ff3b3b", [1, 0.8, 1]);
      break;
    case "bank": // Koin emas raksasa berdiri
      k.cyl(0.7, 0.7, 0.12, [0, y + 0.38, 0.05], GOLD, 24, [Math.PI / 2, 0, 0]);
      k.box(0.08, 0.36, 0.03, [0, y + 0.38, -0.02], "#c99a0a", undefined, false);
      break;
    case "kpk": // Kaca pembesar
      k.ring(0.5, 0.08, [0, y + 0.45, 0.05], "#3a3550", [Math.PI / 2, 0, 0]);
      k.cyl(0.42, 0.42, 0.02, [0, y + 0.45, 0.05], "#cfefff", 20, [Math.PI / 2, 0, 0], false);
      k.cyl(0.07, 0.07, 0.4, [0.28, y + 0.12, 0.05], WOOD, 8, [0, 0, 0.7]);
      break;
    case "telkom": // Menara antena belang merah-putih
      for (let i = 0; i < 4; i++) k.cyl(0.08 - i * 0.012, 0.12 - i * 0.012, 0.24, [0, y + 0.12 + i * 0.24, 0.05], i % 2 ? "#ffffff" : "#e8322b", 8);
      k.ring(0.4, 0.04, [0, y + 0.55, 0.05], "#d9d9e3");
      k.ball(0.1, [0, y + 1.03, 0.05], "#ff3b3b");
      break;
  }
};

/** Mal: gedung lebar berkaca + tas belanja raksasa di atap. */
const mal: ThemeFn = (k) => {
  k.box(1.7, 0.1, 1.0, [0, 0.05, 0], "#c9c9d6");
  k.box(1.6, 0.9, 0.8, [0, 0.55, 0.05], CREAM);
  k.box(1.3, 0.6, 0.03, [0, 0.45, -0.36], GLASS, undefined, false);
  for (let i = 0; i < 5; i++) k.box(0.03, 0.6, 0.04, [-0.52 + i * 0.26, 0.45, -0.37], "#ffffff", undefined, false);
  k.box(1.64, 0.1, 0.84, [0, 1.03, 0.05], k.color);
  k.box(0.75, 0.75, 0.3, [0, 1.46, 0.1], k.color);
  k.ring(0.38, 0.05, [0, 1.88, 0.1], INK, [Math.PI / 2, 0, 0]);
  k.eyes(1.5, -0.06, 0.15, 0.2);
};

/** Tambang: ekskavator kuning + gundukan bijih nikel. */
const tambang: ThemeFn = (k) => {
  k.ball(1.3, [0.25, 0, 0.15], "#7d8a6a", [1, 0.45, 0.9]);
  for (const [x, z] of [[0.3, -0.15], [0.55, 0.2], [0.05, 0.3]]) k.ball(0.22, [x, 0.42, z], "#5c8a5a");
  k.box(0.85, 0.18, 0.55, [-0.35, 0.12, -0.15], INK);
  k.box(0.65, 0.35, 0.45, [-0.35, 0.4, -0.15], "#ffc93c");
  k.box(0.32, 0.35, 0.4, [-0.5, 0.75, -0.15], k.color);
  k.box(0.2, 0.18, 0.02, [-0.5, 0.78, -0.36], GLASS, undefined, false);
  k.box(0.12, 0.9, 0.12, [-0.05, 0.85, -0.15], "#ffc93c", [0, 0, -0.6]);
  k.box(0.1, 0.7, 0.1, [0.4, 1.05, -0.15], "#ffc93c", [0, 0, 0.8]);
  k.box(0.3, 0.25, 0.3, [0.62, 0.72, -0.15], "#8a8a9a", [0, 0, 0.4]);
  k.pennant(-0.5, 0.92, -0.15, 0.5);
};

/** Rumah kayu yang menangis (Rumah Ratapan). */
const rumahRatapan: ThemeFn = (k) => {
  k.box(1.3, 0.12, 0.9, [0, 0.06, 0], "#c9b28a");
  k.box(1.1, 0.8, 0.7, [0, 0.52, 0.05], "#d9a46a");
  for (let i = 0; i < 4; i++) k.box(1.12, 0.03, 0.72, [0, 0.25 + i * 0.18, 0.05], "#b98450");
  k.cyl(0, 1.5, 0.65, [0, 1.25, 0.05], k.color, 4, [0, Math.PI / 4, 0]).scaling.z = 0.65;
  k.box(0.28, 0.42, 0.03, [0, 0.33, -0.31], "#6b3a1e", undefined, false);
  k.eyes(0.75, -0.31, 0.24, 0.24);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) k.ball(0.09, [sx * 0.24, 0.55 - i * 0.14, -0.34], "#5ec8ff", [1, 1.3, 0.6], false);
  k.box(0.3, 0.04, 0.03, [0, 0.5, -0.32], INK, [0, 0, 0], false);
};

const THEMED: Record<string, [ThemeFn, string]> = {
  "Burjo SS Tembalang": [warung, "mie"],
  "OTY Fried Chicken": [warung, "ayam"],
  "RM Pagi Sore": [warung, "nasi"],
  "Sei Indonesia": [warung, "sei"],
  "Kopi Kenangan": [warung, "kopi"],
  "Rumah Ratapan Oslo": [rumahRatapan, ""],
  Polri: [kantor, "polisi"],
  "Bank Living by Sendiri": [kantor, "bank"],
  "Kantor KPK": [kantor, "kpk"],
  Telkom: [kantor, "telkom"],
  "Pakuwon Mall": [mal, ""],
  "Tambang Nikel": [tambang, ""],
};

/** Menara sultan generik (dipakai bila petak belum punya model khusus). */
function generic(k: Kit) {
  k.cyl(1.3, 1.3, 0.5, [0, 0.25, 0], WHITE);
  k.cyl(0.6, 0.9, 1.8, [0, 1.4, 0], k.color);
  k.cyl(0, 1, 0.8, [0, 2.7, 0], GOLD);
  k.ball(0.35, [0, 3.2, 0], "#ffffff");
  k.sultan(1.85, -0.37);
}

/** Nama petak yang punya model landmark khusus (ikonik atau tema). */
export const LANDMARK_NAMES = [...Object.keys(ICONIC), ...Object.keys(THEMED)];

/** Bangun model landmark untuk petak `name` dengan warna pemilik `color`. */
export function buildLandmark(scene: Scene, add: Add, name: string, color: string) {
  const k = new Kit(scene, add, color);
  const iconic = ICONIC[name];
  if (iconic) return iconic(k);
  const themed = THEMED[name];
  if (themed) return themed[0](k, themed[1]);
  generic(k);
}

import { MeshBuilder, TransformNode, Vector3, type Mesh, type Scene, type ShadowGenerator } from "@babylonjs/core";
import { outline, toon } from "./toon";
import { Ease, lerp, tween } from "./tween";

export type CritterKind = "potato" | "cyclops" | "chili" | "cucumber";

export const CRITTERS: { kind: CritterKind; label: string; color: string }[] = [
  { kind: "potato", label: "Bang Kentang Kumis", color: "#ff9f1c" },
  { kind: "cyclops", label: "Om Mata Satu", color: "#a55eea" },
  { kind: "chili", label: "Cabai Ngamuk", color: "#ef3b36" },
  { kind: "cucumber", label: "Timun Kalem", color: "#4cbf3f" },
];

const INK = "#2b1d3a";

interface Googly {
  pupil: Mesh;
  base: Vector3;
  range: number;
}

/** Pion karakter konyol prosedural (original) — mata googly, kumis, otot, dll. */
export class Pawn {
  readonly root: TransformNode;
  /** Node untuk squash/stretch (pivot di kaki). */
  private body: TransformNode;
  /** Kepala/bagian atas yang bisa digoyang sendiri. */
  private head: TransformNode;
  private googlies: Googly[] = [];
  private wiggles: { node: TransformNode; phase: number; amp: number; axis: "x" | "y" | "z" }[] = [];
  private idleTime = Math.random() * 10;
  private jitter = 0;
  private busy = false;
  private faded = false;

  constructor(
    private scene: Scene,
    shadows: ShadowGenerator,
    readonly kind: CritterKind,
    readonly color: string,
    id: number,
  ) {
    this.root = new TransformNode(`pawn${id}`, scene);
    this.body = new TransformNode(`pawnBody${id}`, scene);
    this.body.parent = this.root;
    this.head = new TransformNode(`pawnHead${id}`, scene);
    this.head.parent = this.body;

    const meshes: Mesh[] = [];
    const part = (m: Mesh, hex: string, parent: TransformNode = this.body, outlineW = 0.03) => {
      m.material = toon(scene, hex);
      m.parent = parent;
      if (outlineW > 0) outline(m, outlineW);
      meshes.push(m);
      return m;
    };
    const sphere = (d: number, seg = 12) => MeshBuilder.CreateSphere("s", { diameter: d, segments: seg }, scene);
    const googly = (x: number, y: number, z: number, d: number, parent: TransformNode = this.head) => {
      const eye = part(sphere(d, 14), "#ffffff", parent, 0.02);
      eye.position.set(x, y, z);
      eye.scaling.z = 0.6;
      const pupil = part(sphere(d * 0.45, 8), INK, parent, 0);
      const base = new Vector3(x, y, z + d * 0.27);
      pupil.position.copyFrom(base);
      pupil.scaling.z = 0.4;
      this.googlies.push({ pupil, base, range: d * 0.18 });
    };
    const light = lighten(color, 0.5);
    const dark = lighten(color, -0.35);

    switch (kind) {
      // ------------------------------------------------------------ kentang
      case "potato": {
        const torso = part(sphere(1, 16), color);
        torso.scaling.set(0.85, 1.15, 0.8);
        torso.position.y = 0.68;
        // Benjolan kentang
        for (const [x, y, z, d] of [
          [0.3, 0.95, 0.15, 0.3],
          [-0.33, 0.5, 0.1, 0.28],
          [0.1, 1.18, -0.2, 0.3],
          [-0.2, 0.9, -0.3, 0.26],
        ]) {
          const bump = part(sphere(d, 8), color, this.body, 0);
          bump.position.set(x, y, z);
        }
        // Kaki kecil kurus
        for (const sx of [-0.15, 0.15]) {
          const leg = part(MeshBuilder.CreateCylinder("leg", { diameter: 0.07, height: 0.25 }, scene), INK, this.body, 0);
          leg.position.set(sx, 0.12, 0);
          const shoe = part(sphere(0.2, 8), "#ffffff", this.body, 0.02);
          shoe.scaling.set(0.9, 0.5, 1.4);
          shoe.position.set(sx, 0.04, 0.05);
        }
        this.head.position.y = 0;
        // Kacamata hitam sangar
        for (const sx of [-0.17, 0.17]) {
          const lens = part(MeshBuilder.CreateBox("lens", { width: 0.28, height: 0.16, depth: 0.05 }, scene), "#111122", this.head, 0.015);
          lens.position.set(sx, 1.05, 0.38);
        }
        const bridge = part(MeshBuilder.CreateBox("bridge", { width: 0.12, height: 0.04, depth: 0.04 }, scene), "#111122", this.head, 0);
        bridge.position.set(0, 1.08, 0.39);
        const shine = part(MeshBuilder.CreateBox("shine", { width: 0.06, height: 0.03, depth: 0.01 }, scene), "#ffffff", this.head, 0);
        shine.position.set(-0.22, 1.09, 0.415);
        shine.rotation.z = 0.5;
        // Kumis tebal melengkung
        const stache = new TransformNode("stache", scene);
        stache.parent = this.head;
        stache.position.set(0, 0.86, 0.4);
        for (const sx of [-1, 1]) {
          const half = part(MeshBuilder.CreateCapsule("stache", { radius: 0.07, height: 0.42 }, scene), INK, stache, 0);
          half.rotation.z = sx * (Math.PI / 2 - 0.35);
          half.position.set(sx * 0.15, 0, 0);
          const curl = part(sphere(0.12, 8), INK, stache, 0);
          curl.position.set(sx * 0.33, 0.07, 0);
        }
        this.wiggles.push({ node: stache, phase: 0, amp: 0.12, axis: "z" });
        // Mulut nyengir
        const grin = part(MeshBuilder.CreateBox("grin", { width: 0.2, height: 0.06, depth: 0.03 }, scene), "#ffffff", this.head, 0.01);
        grin.position.set(0, 0.74, 0.37);
        break;
      }

      // ------------------------------------------------------------ cyclops
      case "cyclops": {
        const torso = part(sphere(1, 16), color);
        torso.scaling.set(0.9, 1.25, 0.85);
        torso.position.y = 0.72;
        const belly = part(sphere(0.6, 12), light, this.body, 0);
        belly.position.set(0, 0.5, 0.25);
        belly.scaling.z = 0.4;
        for (const sx of [-0.2, 0.2]) {
          const foot = part(sphere(0.3, 10), dark);
          foot.scaling.set(1, 0.5, 1.4);
          foot.position.set(sx, 0.08, 0.06);
        }
        // Lengan kurus melambai
        for (const sx of [-1, 1]) {
          const arm = new TransformNode("arm", scene);
          arm.parent = this.body;
          arm.position.set(sx * 0.42, 0.8, 0);
          const a = part(MeshBuilder.CreateCapsule("arm", { radius: 0.06, height: 0.5 }, scene), color, arm, 0.02);
          a.position.y = 0.2;
          a.rotation.z = -sx * 0.6;
          this.wiggles.push({ node: arm, phase: sx, amp: 0.35, axis: "z" });
        }
        // SATU mata raksasa
        googly(0, 1.05, 0.33, 0.5);
        // Tanduk + antena
        const horn = part(MeshBuilder.CreateCylinder("horn", { diameterTop: 0, diameterBottom: 0.18, height: 0.35, tessellation: 8 }, scene), "#fff3c4", this.head);
        horn.position.set(0.12, 1.47, 0);
        horn.rotation.z = -0.3;
        const ant = new TransformNode("ant", scene);
        ant.parent = this.head;
        ant.position.set(-0.15, 1.38, 0);
        const stick = part(MeshBuilder.CreateCylinder("antStick", { diameter: 0.04, height: 0.4 }, scene), INK, ant, 0);
        stick.position.y = 0.2;
        const bob = part(sphere(0.14, 8), "#ffe14d", ant, 0.02);
        bob.position.y = 0.42;
        this.wiggles.push({ node: ant, phase: 2, amp: 0.4, axis: "z" });
        // Mulut lebar dengan 2 gigi
        const mouth = part(MeshBuilder.CreateBox("mouth", { width: 0.42, height: 0.12, depth: 0.04 }, scene), INK, this.head, 0);
        mouth.position.set(0, 0.68, 0.4);
        for (const sx of [-0.09, 0.09]) {
          const tooth = part(MeshBuilder.CreateBox("tooth", { width: 0.08, height: 0.09, depth: 0.03 }, scene), "#ffffff", this.head, 0);
          tooth.position.set(sx, 0.71, 0.425);
        }
        break;
      }

      // ------------------------------------------------------------ cabai
      case "chili": {
        const green = "#3aa845";
        // Kaki + sepatu
        for (const sx of [-0.15, 0.15]) {
          const leg = part(MeshBuilder.CreateCylinder("leg", { diameter: 0.07, height: 0.24 }, scene), INK, this.body, 0);
          leg.position.set(sx, 0.12, 0);
          const shoe = part(sphere(0.21, 8), "#ffffff", this.body, 0.02);
          shoe.scaling.set(0.9, 0.5, 1.4);
          shoe.position.set(sx, 0.04, 0.05);
        }
        // Badan cabai: gemuk di atas, meruncing ke bawah, ujungnya melengkung ke samping
        // (satu mesh tabung supaya outline-nya mulus, tidak belang)
        const N = 18;
        const path: Vector3[] = [];
        const radii: number[] = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const k = (1 - t) ** 3;
          path.push(new Vector3(0.42 * k, 0.12 + t * 1.26, -0.22 * k));
          let r = 0.02 + 0.35 * Math.sin(Math.min(t / 0.8, 1) * (Math.PI / 2)) ** 1.3;
          if (t > 0.85) r *= 1 - (t - 0.85) * 1.2;
          radii.push(r);
        }
        part(MeshBuilder.CreateTube("chili", { path, radiusFunction: (i) => radii[i], tessellation: 20, cap: 3 }, scene), color);
        // Kilap
        const gloss = part(sphere(0.16, 8), light, this.body, 0);
        gloss.position.set(-0.2, 1.1, 0.29);
        gloss.scaling.set(0.6, 1.4, 0.4);
        // Kelopak hijau + tangkai melengkung di atas kepala
        const calyx = part(sphere(0.6, 12), green, this.head);
        calyx.position.set(0, 1.42, 0);
        calyx.scaling.set(1, 0.32, 1);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const leaf = part(sphere(0.18, 6), green, this.head, 0);
          leaf.position.set(Math.cos(a) * 0.27, 1.36, Math.sin(a) * 0.27);
          leaf.scaling.set(1.2, 0.4, 1.2);
        }
        const stem = new TransformNode("stem", scene);
        stem.parent = this.head;
        stem.position.set(0, 1.45, 0);
        const s1 = part(MeshBuilder.CreateCylinder("stem", { diameter: 0.09, height: 0.28 }, scene), "#2d8a37", stem, 0.015);
        s1.position.y = 0.13;
        const s2 = part(MeshBuilder.CreateCylinder("stem", { diameter: 0.08, height: 0.2 }, scene), "#2d8a37", stem, 0.015);
        s2.rotation.z = -1.0;
        s2.position.set(0.08, 0.3, 0);
        this.wiggles.push({ node: stem, phase: 0.5, amp: 0.2, axis: "z" });
        // Lengan kecil mengepal
        for (const sx of [-1, 1]) {
          const arm = new TransformNode("arm", scene);
          arm.parent = this.body;
          arm.position.set(sx * 0.33, 0.85, 0);
          const a = part(MeshBuilder.CreateCapsule("arm", { radius: 0.055, height: 0.42 }, scene), color, arm, 0.02);
          a.position.set(sx * 0.12, 0.12, 0);
          a.rotation.z = -sx * 0.9;
          const fist = part(sphere(0.15, 8), "#ffffff", arm, 0.02);
          fist.position.set(sx * 0.26, 0.24, 0);
          this.wiggles.push({ node: arm, phase: sx * 2, amp: 0.3, axis: "x" });
        }
        // Wajah galak kepedasan
        googly(-0.14, 1.08, 0.3, 0.2);
        googly(0.14, 1.08, 0.3, 0.2);
        for (const sx of [-1, 1]) {
          const brow = part(MeshBuilder.CreateBox("brow", { width: 0.2, height: 0.05, depth: 0.04 }, scene), INK, this.head, 0);
          brow.position.set(sx * 0.14, 1.23, 0.33);
          brow.rotation.z = sx * 0.4;
        }
        const mouth = part(MeshBuilder.CreateBox("mouth", { width: 0.3, height: 0.1, depth: 0.04 }, scene), INK, this.head, 0);
        mouth.position.set(0, 0.9, 0.34);
        const teeth = part(MeshBuilder.CreateBox("teeth", { width: 0.26, height: 0.04, depth: 0.02 }, scene), "#ffffff", this.head, 0);
        teeth.position.set(0, 0.93, 0.36);
        // Api kecil di atas kepala (pedas!)
        const flame = new TransformNode("flame", scene);
        flame.parent = this.head;
        flame.position.set(-0.22, 1.45, 0);
        const flames: [number, number, number, number, string][] = [
          [0, 0.13, 0, 0.22, "#ff7b00"],
          [0.1, 0.09, 0.02, 0.14, "#ff9f1c"],
          [0.01, 0.1, 0.07, 0.12, "#ffd23f"],
        ];
        for (const [x, y, z, d, hex] of flames) {
          const f = part(sphere(d, 10), hex, flame, 0.015);
          f.position.set(x, y, z);
          f.scaling.set(0.8, 1.7, 0.8);
        }
        this.wiggles.push({ node: flame, phase: 3, amp: 0.25, axis: "z" });
        break;
      }

      // ------------------------------------------------------------ timun
      case "cucumber": {
        // Kaki + sepatu
        for (const sx of [-0.16, 0.16]) {
          const leg = part(MeshBuilder.CreateCylinder("leg", { diameter: 0.07, height: 0.22 }, scene), INK, this.body, 0);
          leg.position.set(sx, 0.11, 0);
          const shoe = part(sphere(0.22, 8), "#ffffff", this.body, 0.02);
          shoe.scaling.set(0.9, 0.5, 1.4);
          shoe.position.set(sx, 0.04, 0.05);
        }
        // Badan timun panjang
        const torso = part(MeshBuilder.CreateCapsule("torso", { radius: 0.36, height: 1.4, tessellation: 18 }, scene), color);
        torso.position.y = 0.88;
        torso.scaling.z = 0.9;
        // Garis-garis memanjang khas timun (di depan dibuat pendek supaya wajah bersih)
        const streak = lighten(color, 0.3);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + 0.31;
          const front = Math.cos(a) > 0.4;
          const stripe = part(sphere(0.12, 8), i % 2 ? streak : dark, this.body, 0);
          // Harus menonjol melewati outline badan (0.03) supaya kelihatan
          stripe.scaling.set(0.9, front ? 2.6 : 7, 0.8);
          stripe.position.set(Math.sin(a) * 0.37, front ? 0.6 : 0.88, Math.cos(a) * 0.335);
          stripe.rotation.y = a;
        }
        // Bintil-bintil terang
        const bumps: [number, number, number][] = [
          [0.3, 0.5, 0.15],
          [-0.31, 0.65, 0.1],
          [0.26, 1.2, -0.18],
          [-0.22, 1.32, -0.2],
          [0.12, 0.42, 0.3],
          [-0.15, 0.4, 0.29],
        ];
        for (const [x, y, z] of bumps) {
          const bump = part(sphere(0.06, 6), light, this.body, 0);
          bump.position.set(x, y, z);
        }
        // Bunga kuning di ujung atas (ciri khas timun)
        const flower = new TransformNode("flower", scene);
        flower.parent = this.head;
        flower.position.set(0.05, 1.6, 0);
        const fstem = part(MeshBuilder.CreateCylinder("fstem", { diameter: 0.05, height: 0.14 }, scene), dark, flower, 0);
        fstem.position.y = 0.05;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const petal = part(sphere(0.13, 6), "#ffd23f", flower, 0.012);
          petal.position.set(Math.cos(a) * 0.08, 0.14, Math.sin(a) * 0.08);
          petal.scaling.set(1, 0.4, 1);
        }
        const center = part(sphere(0.07, 6), "#ff9f1c", flower, 0);
        center.position.y = 0.16;
        this.wiggles.push({ node: flower, phase: 1.2, amp: 0.3, axis: "z" });
        // Sehelai daun di pucuk
        const leaf = part(sphere(0.3, 10), dark, this.head, 0.015);
        leaf.scaling.set(1, 0.18, 0.6);
        leaf.position.set(-0.17, 1.6, -0.02);
        leaf.rotation.z = -0.5;
        // Lengan melambai
        for (const sx of [-1, 1]) {
          const arm = new TransformNode("arm", scene);
          arm.parent = this.body;
          arm.position.set(sx * 0.36, 0.85, 0);
          const a = part(MeshBuilder.CreateCapsule("arm", { radius: 0.055, height: 0.45 }, scene), color, arm, 0.02);
          a.position.set(sx * 0.1, 0.17, 0);
          a.rotation.z = -sx * 0.5;
          const hand = part(sphere(0.14, 8), "#ffffff", arm, 0.02);
          hand.position.set(sx * 0.2, 0.38, 0);
          this.wiggles.push({ node: arm, phase: sx * 0.8, amp: 0.35, axis: "z" });
        }
        // Wajah santai
        googly(-0.13, 1.15, 0.3, 0.2);
        googly(0.13, 1.15, 0.3, 0.2);
        // Senyum lebar melengkung
        const smilePath: Vector3[] = [];
        for (let i = 0; i <= 10; i++) {
          const x = -0.12 + (0.24 * i) / 10;
          smilePath.push(new Vector3(x, 0.98 + 2 * x * x, 0.34 - 1.6 * x * x));
        }
        part(MeshBuilder.CreateTube("smile", { path: smilePath, radius: 0.022, tessellation: 8, cap: 3 }, scene), INK, this.head, 0);
        // Pipi merona
        for (const sx of [-0.22, 0.22]) {
          const blush = part(sphere(0.09, 6), "#ff8fab", this.head, 0);
          blush.position.set(sx, 1.02, 0.29);
          blush.scaling.z = 0.3;
        }
        break;
      }
    }

    for (const m of meshes) shadows.addShadowCaster(m);

    // Idle: bernapas, goyang anggota badan, mata googly gemetar
    const idleObs = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      this.idleTime += dt;
      const t = this.idleTime;
      for (const w of this.wiggles) w.node.rotation[w.axis] = Math.sin(t * 4 + w.phase) * w.amp;
      this.jitter = Math.max(0, this.jitter - dt * 1.5);
      for (const g of this.googlies) {
        const j = this.jitter;
        const ox = Math.sin(t * 1.3 + g.base.x * 9) * 0.5 + (j ? (Math.random() - 0.5) * 2 * j : 0);
        const oy = Math.cos(t * 1.1 + g.base.y * 7) * 0.5 + (j ? (Math.random() - 0.5) * 2 * j : 0);
        g.pupil.position.set(g.base.x + ox * g.range, g.base.y + oy * g.range, g.base.z);
      }
      if (this.busy) return;
      const s = Math.sin(t * 3) * 0.03;
      this.body.scaling.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);
      this.head.rotation.z = Math.sin(t * 1.7) * 0.05;
    });
    // Lepas loop idle saat pion dibuang (mis. setupPlayers dipanggil ulang)
    this.root.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(idleObs));
  }

  setPosition(p: Vector3) {
    this.root.position.copyFrom(p);
  }

  faceTowards(target: Vector3) {
    const d = target.subtract(this.root.position);
    if (d.lengthSquared() < 1e-4) return;
    this.root.rotation.y = Math.atan2(d.x, d.z);
  }

  /** Bikin mata googly heboh. */
  shake(amount = 1) {
    this.jitter = Math.min(1, this.jitter + amount);
  }

  private async squash(amount: number, dur: number) {
    await tween(this.scene, dur, (t) => {
      const k = Math.sin(t * Math.PI) * amount;
      this.body.scaling.set(1 + k, 1 - k, 1 + k);
    });
  }

  /** Lompat ke satu titik (per petak). */
  async hopTo(target: Vector3, height = 0.9, dur = 0.3) {
    this.busy = true;
    const from = this.root.position.clone();
    this.faceTowards(target);
    await this.squash(0.18, 0.07);
    await tween(this.scene, dur, (t) => {
      this.root.position.x = lerp(from.x, target.x, t);
      this.root.position.z = lerp(from.z, target.z, t);
      this.root.position.y = lerp(from.y, target.y, t) + Math.sin(t * Math.PI) * height;
      const st = Math.sin(t * Math.PI) * 0.15;
      this.body.scaling.set(1 - st, 1 + st, 1 - st);
    });
    this.shake(0.6);
    await this.squash(0.28, 0.1);
    this.busy = false;
  }

  /** Terbang melengkung tinggi sambil jungkir balik. */
  async flyTo(target: Vector3) {
    this.busy = true;
    const from = this.root.position.clone();
    this.faceTowards(target);
    await this.squash(0.35, 0.15);
    const spin = this.root.rotation.y;
    this.shake(1);
    await tween(
      this.scene,
      1.1,
      (t) => {
        this.root.position.x = lerp(from.x, target.x, t);
        this.root.position.z = lerp(from.z, target.z, t);
        this.root.position.y = lerp(from.y, target.y, t) + Math.sin(t * Math.PI) * 7;
        this.root.rotation.y = spin + t * Math.PI * 4;
        this.body.rotation.x = Math.sin(t * Math.PI) * Math.PI * 2 * t;
      },
      Ease.inOutQuad,
    );
    this.root.rotation.y = spin;
    this.body.rotation.x = 0;
    this.shake(1);
    await this.squash(0.4, 0.18);
    this.busy = false;
  }

  /** Lompat senang di tempat. */
  async cheer() {
    const base = this.root.position.y;
    for (let i = 0; i < 2; i++) {
      await tween(this.scene, 0.25, (t) => (this.root.position.y = base + Math.sin(t * Math.PI) * 0.6));
    }
    this.root.position.y = base;
  }

  /** Joget heboh: goyang pinggul + putar. */
  async dance() {
    this.busy = true;
    const yaw = this.root.rotation.y;
    await tween(this.scene, 1.4, (t) => {
      this.body.rotation.z = Math.sin(t * Math.PI * 8) * 0.35;
      this.root.rotation.y = yaw + Math.sin(t * Math.PI * 2) * 1.2;
      const k = Math.abs(Math.sin(t * Math.PI * 8)) * 0.15;
      this.body.scaling.set(1 + k, 1 - k, 1 + k);
    });
    this.body.rotation.z = 0;
    this.root.rotation.y = yaw;
    this.busy = false;
  }

  /** Pusing: kepala muter-muter. */
  async dizzy() {
    this.busy = true;
    this.shake(1);
    await tween(this.scene, 1.2, (t) => {
      const a = t * Math.PI * 6;
      this.body.rotation.x = Math.sin(a) * 0.25 * (1 - t);
      this.body.rotation.z = Math.cos(a) * 0.25 * (1 - t);
    });
    this.body.rotation.set(0, 0, 0);
    this.busy = false;
  }

  /** Sedih: lemas & menciut sebentar. */
  async sulk() {
    this.busy = true;
    await tween(this.scene, 0.9, (t) => {
      const k = Math.sin(t * Math.PI);
      this.body.scaling.set(1 + k * 0.15, 1 - k * 0.3, 1 + k * 0.15);
      this.head.rotation.x = k * 0.4;
    });
    this.head.rotation.x = 0;
    this.busy = false;
  }

  /** Terpental (kena kentut / disamber petir). */
  async blasted() {
    this.busy = true;
    this.shake(1);
    const base = this.root.position.y;
    await tween(this.scene, 0.7, (t) => {
      this.root.position.y = base + Math.sin(t * Math.PI) * 1.5;
      this.body.rotation.z = t * Math.PI * 2;
    });
    this.root.position.y = base;
    this.body.rotation.z = 0;
    this.busy = false;
  }

  /** Bangkrut: pingsan terguling. */
  async faint() {
    this.faded = true;
    await tween(this.scene, 0.8, (t) => {
      this.root.rotation.z = t * (Math.PI / 2);
      this.root.scaling.setAll(1 - t * 0.4);
    }, Ease.outBounce);
  }

  get isOut() {
    return this.faded;
  }

  worldTop() {
    return this.root.position.add(new Vector3(0, 1.9, 0));
  }
}

/** amt > 0 mencerahkan, amt < 0 menggelapkan. */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const f = (c: number) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  const [r, g, b] = ch.map(f);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

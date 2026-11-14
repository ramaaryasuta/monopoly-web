import { Color4, DynamicTexture, MeshBuilder, ParticleSystem, TransformNode, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { outline, toon } from "./toon";
import { Ease, tween, wait } from "./tween";

/** Efek partikel & properti konyol: koin, confetti, kentut, air mata, UFO, bebek raksasa. */
export class Effects {
  private coinTex: DynamicTexture;
  private dotTex: DynamicTexture;
  private puffTex: DynamicTexture;
  private emojiTex = new Map<string, DynamicTexture>();

  constructor(private scene: Scene) {
    this.coinTex = this.circleTexture("coinTex", "#ffd23f", "#c98a00");
    this.dotTex = this.circleTexture("dotTex", "#ffffff", "#ffffff");
    this.puffTex = this.circleTexture("puffTex", "#c8f56b", "#7fbf2a");
  }

  private circleTexture(name: string, fill: string, stroke: string) {
    const t = new DynamicTexture(name, { width: 64, height: 64 }, this.scene, false);
    t.hasAlpha = true;
    const ctx = t.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 64, 64);
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    t.update();
    return t;
  }

  private emoji(ch: string) {
    let t = this.emojiTex.get(ch);
    if (!t) {
      t = new DynamicTexture(`emoji_${ch}`, { width: 96, height: 96 }, this.scene, false);
      t.hasAlpha = true;
      const ctx = t.getContext() as unknown as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, 96, 96);
      ctx.font = "72px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, 48, 52);
      t.update();
      this.emojiTex.set(ch, t);
    }
    return t;
  }

  private burst(opts: {
    at: Vector3;
    texture: DynamicTexture;
    count: number;
    colors: [Color4, Color4];
    size: [number, number];
    power: [number, number];
    gravity: number;
    life: [number, number];
    spread?: number;
    dir?: [Vector3, Vector3];
    emitRate?: number;
  }) {
    const ps = new ParticleSystem("burst", opts.count, this.scene);
    ps.particleTexture = opts.texture;
    ps.emitter = opts.at.clone();
    const sp = opts.spread ?? 0.3;
    ps.minEmitBox = new Vector3(-sp, 0, -sp);
    ps.maxEmitBox = new Vector3(sp, 0, sp);
    ps.color1 = opts.colors[0];
    ps.color2 = opts.colors[1];
    ps.colorDead = new Color4(opts.colors[1].r, opts.colors[1].g, opts.colors[1].b, 0);
    ps.minSize = opts.size[0];
    ps.maxSize = opts.size[1];
    ps.minLifeTime = opts.life[0];
    ps.maxLifeTime = opts.life[1];
    ps.minEmitPower = opts.power[0];
    ps.maxEmitPower = opts.power[1];
    ps.direction1 = opts.dir?.[0] ?? new Vector3(-1, 3, -1);
    ps.direction2 = opts.dir?.[1] ?? new Vector3(1, 4, 1);
    ps.gravity = new Vector3(0, opts.gravity, 0);
    ps.minAngularSpeed = -4;
    ps.maxAngularSpeed = 4;
    if (opts.emitRate) ps.emitRate = opts.emitRate;
    else ps.manualEmitCount = opts.count;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.disposeOnStop = true;
    ps.targetStopDuration = opts.emitRate ? 1.2 : opts.life[1] + 0.2;
    ps.start();
  }

  coins(at: Vector3, count = 24) {
    this.burst({
      at,
      texture: this.coinTex,
      count,
      colors: [new Color4(1, 1, 1, 1), new Color4(1, 0.95, 0.7, 1)],
      size: [0.25, 0.45],
      power: [1.5, 2.5],
      gravity: -14,
      life: [0.6, 1],
    });
  }

  dust(at: Vector3) {
    this.burst({
      at,
      texture: this.dotTex,
      count: 10,
      colors: [new Color4(1, 1, 1, 0.8), new Color4(0.95, 0.9, 0.8, 0.6)],
      size: [0.15, 0.3],
      power: [0.4, 0.8],
      gravity: 0,
      life: [0.3, 0.5],
      spread: 0.4,
    });
  }

  confetti(at: Vector3) {
    const palette = ["#ff6b9a", "#5bb8ff", "#ffd23f", "#5fd35f", "#b57aff"];
    for (const hex of palette) {
      const c = Color4.FromHexString(`${hex}ff`);
      this.burst({
        at,
        texture: this.dotTex,
        count: 40,
        colors: [c, c],
        size: [0.2, 0.35],
        power: [3, 6],
        gravity: -6,
        life: [1.5, 2.5],
        spread: 2,
      });
    }
  }

  /** Awan kentut hijau mengepul dari belakang pion. */
  fart(at: Vector3) {
    this.burst({
      at: at.add(new Vector3(0, 0.4, 0)),
      texture: this.puffTex,
      count: 30,
      colors: [new Color4(0.8, 1, 0.5, 0.9), new Color4(0.6, 0.85, 0.3, 0.7)],
      size: [0.5, 1.2],
      power: [1, 3],
      gravity: 0.6,
      life: [0.9, 1.6],
      spread: 0.3,
      dir: [new Vector3(-2, 0.2, -2), new Vector3(2, 1, 2)],
    });
    this.emojiBurst(at.add(new Vector3(0, 1.6, 0)), "💨", 4);
  }

  /** Air mata muncrat ala kartun. */
  tears(at: Vector3) {
    this.burst({
      at: at.add(new Vector3(0, 1.2, 0)),
      texture: this.emoji("💧"),
      count: 16,
      colors: [new Color4(1, 1, 1, 1), new Color4(1, 1, 1, 1)],
      size: [0.25, 0.4],
      power: [2, 3],
      gravity: -9,
      life: [0.6, 1],
      spread: 0.1,
      dir: [new Vector3(-1.5, 2, -0.5), new Vector3(1.5, 2.5, 0.5)],
    });
  }

  /** Emoji beterbangan (bintang pusing, musik joget, dll). */
  emojiBurst(at: Vector3, ch: string, count = 8) {
    this.burst({
      at,
      texture: this.emoji(ch),
      count,
      colors: [new Color4(1, 1, 1, 1), new Color4(1, 1, 1, 1)],
      size: [0.5, 0.8],
      power: [1, 2],
      gravity: 1,
      life: [0.8, 1.3],
      spread: 0.5,
    });
  }

  /** Hujan uang dari langit di sekitar titik. */
  moneyRain(at: Vector3) {
    for (const ch of ["💵", "🪙"]) {
      this.burst({
        at: at.add(new Vector3(0, 9, 0)),
        texture: this.emoji(ch),
        count: 60,
        colors: [new Color4(1, 1, 1, 1), new Color4(1, 1, 1, 1)],
        size: [0.5, 0.9],
        power: [0.2, 0.5],
        gravity: -5,
        life: [1.6, 2.2],
        spread: 9,
        dir: [new Vector3(-0.3, -1, -0.3), new Vector3(0.3, -1, 0.3)],
        emitRate: 50,
      });
    }
  }

  // ------------------------------------------------------------------ props

  private buildUfo(): TransformNode {
    const s = this.scene;
    const root = new TransformNode("ufoFx", s);
    const add = (m: Mesh, hex: string, w = 0.04) => {
      m.material = toon(s, hex);
      m.parent = root;
      if (w) outline(m, w);
      return m;
    };
    const disc = add(MeshBuilder.CreateSphere("ufoDisc", { diameter: 3.2, segments: 16 }, s), "#b8c4d6");
    disc.scaling.y = 0.28;
    const dome = add(MeshBuilder.CreateSphere("ufoDome", { diameter: 1.4, segments: 14, slice: 0.5 }, s), "#7ef0ff");
    dome.position.y = 0.2;
    const alien = add(MeshBuilder.CreateSphere("ufoAlien", { diameter: 0.6, segments: 10 }, s), "#7ee06b", 0.02);
    alien.position.y = 0.45;
    for (const sx of [-0.12, 0.12]) {
      const eye = add(MeshBuilder.CreateSphere("ufoEye", { diameter: 0.2, segments: 8 }, s), "#111122", 0);
      eye.position.set(sx, 0.5, 0.25);
      eye.scaling.set(0.8, 1.3, 0.5);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const l = add(MeshBuilder.CreateSphere("ufoLight", { diameter: 0.25, segments: 6 }, s), i % 2 ? "#ffe14d" : "#ff6b9a", 0);
      l.position.set(Math.cos(a) * 1.4, -0.05, Math.sin(a) * 1.4);
    }
    const beam = MeshBuilder.CreateCylinder("ufoBeam", { diameterTop: 0.9, diameterBottom: 2.6, height: 6, tessellation: 20 }, s);
    const bm = toon(s, "#fff7a8").clone("ufoBeamMat");
    bm.alpha = 0.45;
    beam.material = bm;
    beam.parent = root;
    beam.position.y = -3;
    beam.setEnabled(false);
    root.metadata = { beam };
    return root;
  }

  /** UFO datang, menyorot target, lalu kabur. `during` dijalankan saat sorotan aktif. */
  async ufoVisit(target: Vector3, during?: () => Promise<void>) {
    const ufo = this.buildUfo();
    const beam = (ufo.metadata as { beam: Mesh }).beam;
    const spin = this.scene.onBeforeRenderObservable.add(() => (ufo.rotation.y += 0.08));
    const hover = target.add(new Vector3(0, 6.5, 0));
    const from = hover.add(new Vector3(-30, 8, 10));
    try {
      await tween(this.scene, 0.9, (t) => ufo.position.copyFrom(Vector3.Lerp(from, hover, t)), Ease.outBack);
      beam.setEnabled(true);
      if (during) await during();
      else await wait(this.scene, 0.8);
      beam.setEnabled(false);
      const away = hover.add(new Vector3(30, 12, -5));
      await tween(this.scene, 0.7, (t) => ufo.position.copyFrom(Vector3.Lerp(hover, away, t)), Ease.inOutQuad);
    } finally {
      this.scene.onBeforeRenderObservable.remove(spin);
      ufo.dispose();
    }
  }

  /** Bebek karet raksasa muncul dari bawah tanah lalu tenggelam lagi. */
  async giantDuck(at: Vector3) {
    const s = this.scene;
    const root = new TransformNode("duckFx", s);
    const add = (m: Mesh, hex: string) => {
      m.material = toon(s, hex);
      m.parent = root;
      outline(m, 0.05);
      return m;
    };
    const body = add(MeshBuilder.CreateSphere("dBody", { diameter: 3, segments: 16 }, s), "#ffd23f");
    body.scaling.set(1.2, 0.85, 1);
    body.position.y = 1.2;
    const head = add(MeshBuilder.CreateSphere("dHead", { diameter: 1.8, segments: 16 }, s), "#ffd23f");
    head.position.set(0, 2.9, 0.7);
    const beak = add(MeshBuilder.CreateSphere("dBeak", { diameter: 1, segments: 10 }, s), "#ff8c3d");
    beak.scaling.set(1.1, 0.4, 1);
    beak.position.set(0, 2.75, 1.55);
    for (const sx of [-0.45, 0.45]) {
      const eye = add(MeshBuilder.CreateSphere("dEye", { diameter: 0.45, segments: 10 }, s), "#ffffff");
      eye.position.set(sx, 3.15, 1.35);
      const p = add(MeshBuilder.CreateSphere("dPupil", { diameter: 0.22, segments: 8 }, s), "#111122");
      p.position.set(sx + (Math.random() - 0.5) * 0.1, 3.12, 1.55);
    }
    root.position.copyFrom(at);
    root.position.y = -4;
    root.rotation.y = Math.PI;
    try {
      await tween(s, 0.6, (t) => (root.position.y = -4 + t * 4), Ease.outBack);
      await tween(s, 0.9, (t) => (root.rotation.z = Math.sin(t * Math.PI * 4) * 0.15));
      await tween(s, 0.5, (t) => (root.position.y = -t * 5), Ease.inOutQuad);
    } finally {
      root.dispose();
    }
  }
}

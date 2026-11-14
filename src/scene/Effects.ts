import { Color4, DynamicTexture, MeshBuilder, ParticleSystem, TransformNode, Vector3, type Mesh, type Scene } from "@babylonjs/core";
import { outline, toon } from "./toon";
import { Ease, tween, wait } from "./tween";

/** Efek partikel & properti konyol: koin, confetti, kentut, air mata, helikopter, bebek raksasa. */
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

  /** Helikopter pejabat kartun: badan, kokpit, ekor, baling-baling, skid & lampu sorot. */
  private buildHeli(): TransformNode {
    const s = this.scene;
    const root = new TransformNode("heliFx", s);
    const add = (m: Mesh, hex: string, w = 0.04, parent: TransformNode = root) => {
      m.material = toon(s, hex);
      m.parent = parent;
      if (w) outline(m, w);
      return m;
    };
    // Badan menghadap +X (arah terbang masuk)
    const body = add(MeshBuilder.CreateSphere("heliBody", { diameter: 2.2, segments: 16 }, s), "#2f3a4a");
    body.scaling.set(1.35, 0.9, 0.95);
    const stripe = add(MeshBuilder.CreateSphere("heliStripe", { diameter: 2.24, segments: 16 }, s), "#e8343a", 0);
    stripe.scaling.set(1.36, 0.25, 0.97);
    stripe.position.y = -0.1;
    const glass = add(MeshBuilder.CreateSphere("heliGlass", { diameter: 1.3, segments: 14 }, s), "#7ef0ff", 0.02);
    glass.position.set(0.85, 0.2, 0);
    glass.scaling.set(0.8, 0.75, 1.15);
    const tail = add(MeshBuilder.CreateCylinder("heliTail", { diameterTop: 0.22, diameterBottom: 0.5, height: 2.6, tessellation: 10 }, s), "#2f3a4a");
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-2.2, 0.25, 0);
    const fin = add(MeshBuilder.CreateBox("heliFin", { width: 0.5, height: 0.8, depth: 0.08 }, s), "#e8343a", 0.02);
    fin.position.set(-3.4, 0.6, 0);
    // Rotor ekor
    const tailRotor = new TransformNode("heliTailRotor", s);
    tailRotor.parent = root;
    tailRotor.position.set(-3.4, 0.5, 0.12);
    add(MeshBuilder.CreateBox("heliTailBlade", { width: 0.1, height: 1.0, depth: 0.04 }, s), "#dfe6ee", 0, tailRotor);
    // Rotor utama
    const mast = add(MeshBuilder.CreateCylinder("heliMast", { diameter: 0.18, height: 0.5, tessellation: 8 }, s), "#555f6d", 0.02);
    mast.position.y = 1.05;
    const rotor = new TransformNode("heliRotor", s);
    rotor.parent = root;
    rotor.position.y = 1.3;
    for (const r of [0, Math.PI / 2]) {
      const blade = add(MeshBuilder.CreateBox("heliBlade", { width: 5.2, height: 0.06, depth: 0.28 }, s), "#dfe6ee", 0.02, rotor);
      blade.rotation.y = r;
    }
    // Skid
    for (const z of [-0.6, 0.6]) {
      const skid = add(MeshBuilder.CreateCylinder("heliSkid", { diameter: 0.12, height: 2.4, tessellation: 8 }, s), "#555f6d", 0.02);
      skid.rotation.z = Math.PI / 2;
      skid.position.set(0.1, -1.0, z);
      for (const x of [-0.5, 0.6]) {
        const leg = add(MeshBuilder.CreateCylinder("heliLeg", { diameter: 0.08, height: 0.45, tessellation: 6 }, s), "#555f6d", 0);
        leg.position.set(x, -0.8, z * 0.85);
      }
    }
    // Lampu sirene di atas
    const siren = add(MeshBuilder.CreateSphere("heliSiren", { diameter: 0.3, segments: 8 }, s), "#ff3b3b", 0.02);
    siren.position.set(0.3, 0.95, 0);
    // Lampu sorot (pengganti sinar UFO)
    const beam = MeshBuilder.CreateCylinder("heliBeam", { diameterTop: 0.5, diameterBottom: 2.6, height: 6, tessellation: 20 }, s);
    const bm = toon(s, "#fff7a8").clone("heliBeamMat");
    bm.alpha = 0.4;
    beam.material = bm;
    beam.parent = root;
    beam.position.y = -3.6;
    beam.setEnabled(false);
    root.metadata = { beam, rotor, tailRotor, siren };
    return root;
  }

  /** Helikopter datang, menyorot target, lalu pergi. `during` dijalankan saat lampu sorot aktif. */
  async heliVisit(target: Vector3, during?: () => Promise<void>) {
    const heli = this.buildHeli();
    const { beam, rotor, tailRotor, siren } = heli.metadata as { beam: Mesh; rotor: TransformNode; tailRotor: TransformNode; siren: Mesh };
    let time = 0;
    const spin = this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      time += dt;
      rotor.rotation.y += dt * 28;
      tailRotor.rotation.z += dt * 40;
      siren.visibility = Math.sin(time * 14) > 0 ? 1 : 0.35;
      // Goyang halus saat melayang
      heli.rotation.x = Math.sin(time * 2.2) * 0.04;
    });
    const hover = target.add(new Vector3(0, 6.5, 0));
    const from = hover.add(new Vector3(-30, 8, 10));
    try {
      heli.rotation.y = -Math.atan2(hover.z - from.z, hover.x - from.x);
      heli.rotation.z = -0.18; // menunduk saat maju
      await tween(this.scene, 1.0, (t) => heli.position.copyFrom(Vector3.Lerp(from, hover, t)), Ease.outBack);
      heli.rotation.z = 0;
      beam.setEnabled(true);
      if (during) await during();
      else await wait(this.scene, 0.8);
      beam.setEnabled(false);
      const away = hover.add(new Vector3(30, 12, -5));
      heli.rotation.y = -Math.atan2(away.z - hover.z, away.x - hover.x);
      heli.rotation.z = -0.22;
      await tween(this.scene, 0.8, (t) => heli.position.copyFrom(Vector3.Lerp(hover, away, t)), Ease.inOutQuad);
    } finally {
      this.scene.onBeforeRenderObservable.remove(spin);
      heli.dispose();
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

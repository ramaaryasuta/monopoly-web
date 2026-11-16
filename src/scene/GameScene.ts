import {
  ArcRotateCamera,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  Engine,
  Matrix,
  HemisphericLight,
  ImageProcessingConfiguration,
  PointerEventTypes,
  Scene,
  ShadowGenerator,
  Vector3,
  type Observer,
  type PointerInfo,
} from "@babylonjs/core";
import type { GameState } from "../core/types";
import type { FunFx } from "../data/cards";
import { BoardView } from "./BoardView";
import { CardView } from "./CardView";
import { Dice } from "./Dice";
import { Effects } from "./Effects";
import { EventView } from "./EventView";
import { pawnSlot, TILE } from "./layout";
import { LOW_GFX } from "./quality";
import { CRITTERS, Pawn } from "./Pawn";
import { sfx } from "./sfx";
import { clearToonCache } from "./toon";
import { Ease, lerp, tween } from "./tween";

const HOME = { alpha: -Math.PI / 2, beta: 0.85, radius: 36, target: new Vector3(0, 0, -1) };

export class GameScene {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  board!: BoardView;
  dice!: Dice;
  effects!: Effects;
  cards!: CardView;
  events!: EventView;
  pawns: Pawn[] = [];
  private shadows: ShadowGenerator;
  private pickObserver: Observer<PointerInfo> | null = null;
  /** Dipanggil saat petak diklik (di luar mode memilih) — untuk info petak. */
  onTileClick: ((index: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // preserveDrawingBuffer tidak dipakai (tak ada screenshot) dan memperlambat GPU HP.
    this.engine = new Engine(canvas, true, { stencil: true, powerPreference: "high-performance" }, true);
    if (LOW_GFX) this.adaptiveResolution();
    const scene = (this.scene = new Scene(this.engine));
    // Tidak ada efek hover: jangan picking tiap gerakan pointer (ratusan mesh).
    scene.skipPointerMovePicking = true;
    clearToonCache();
    scene.clearColor = Color4.FromHexString("#8fd8ffff");
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogColor = Color3.FromHexString("#bfeaff");
    scene.fogStart = 60;
    scene.fogEnd = 130;

    // Kamera
    const cam = (this.camera = new ArcRotateCamera("cam", HOME.alpha, HOME.beta, HOME.radius, HOME.target.clone(), scene));
    cam.lowerRadiusLimit = 10;
    cam.upperRadiusLimit = 60;
    cam.lowerBetaLimit = 0.25;
    cam.upperBetaLimit = 1.35;
    cam.wheelDeltaPercentage = 0.01;
    cam.panningSensibility = 0;
    cam.attachControl(canvas, true);
    cam.fov = 0.75;

    // Cahaya cerah kartun
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.65;
    hemi.groundColor = Color3.FromHexString("#b7a6ff");
    const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.6), scene);
    sun.position = new Vector3(20, 40, -20);
    sun.intensity = 0.9;
    if (LOW_GFX) {
      // Tanpa pass blur tiap frame; PCF bawaan cukup halus di layar kecil.
      this.shadows = new ShadowGenerator(1024, sun);
      this.shadows.usePercentageCloserFiltering = true;
      this.shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
    } else {
      this.shadows = new ShadowGenerator(2048, sun);
      this.shadows.useBlurExponentialShadowMap = true;
      this.shadows.blurKernel = 16;
    }
    this.shadows.darkness = 0.45;

    // Post-processing: anti-alias, bloom ringan, warna lebih "pop"
    const pipeline = new DefaultRenderingPipeline("pipe", true, scene, [cam]);
    // HP: MSAA 2x & tanpa bloom (bloom = beberapa pass layar penuh tiap frame).
    pipeline.samples = LOW_GFX ? 2 : 4;
    // FXAA dimatikan: MSAA 4x sudah cukup, FXAA bikin tulisan petak buram.
    pipeline.fxaaEnabled = false;
    pipeline.bloomEnabled = !LOW_GFX;
    pipeline.bloomThreshold = 0.85;
    pipeline.bloomWeight = 0.25;
    pipeline.bloomKernel = 48;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.15;
    pipeline.imageProcessing.exposure = 1.05;
    pipeline.imageProcessing.toneMappingEnabled = false;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 1.2;
    pipeline.imageProcessing.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    this.board = new BoardView(scene, this.shadows);
    this.dice = new Dice(scene, this.shadows);
    this.effects = new Effects(scene);
    this.cards = new CardView(scene, cam, this.shadows);
    this.events = new EventView(scene, cam);

    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP || this.pickObserver) return;
      const idx = info.pickInfo?.pickedMesh?.metadata?.tileIndex;
      if (typeof idx === "number") this.onTileClick?.(idx);
    });

    this.keepRunningInBackground();
    this.engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }

  /**
   * requestAnimationFrame berhenti total saat tab disembunyikan, sehingga game (dan
   * semua suaranya) ikut membeku dan pemain lupa sedang main. Cadangan setTimeout
   * menjaga game tetap berjalan di latar (browser membatasinya ±1 frame/detik —
   * cukup, karena animasi berbasis waktu dan tetap selesai tepat waktu).
   */
  private keepRunningInBackground() {
    let nextId = 1;
    const pending = new Map<number, { raf: number; timer: number }>();
    this.engine.customAnimationFrameRequester = {
      requestAnimationFrame: (fn: (t: number) => void) => {
        const id = nextId++;
        const run = (t: number) => {
          const p = pending.get(id);
          if (!p) return;
          pending.delete(id);
          cancelAnimationFrame(p.raf);
          clearTimeout(p.timer);
          fn(t);
        };
        pending.set(id, {
          raf: requestAnimationFrame(run),
          timer: window.setTimeout(() => run(performance.now()), 250),
        });
        return id;
      },
      cancelAnimationFrame: (id: number) => {
        const p = pending.get(id);
        if (!p) return;
        pending.delete(id);
        cancelAnimationFrame(p.raf);
        clearTimeout(p.timer);
      },
    };
  }

  /**
   * HP/tablet: mulai dari resolusi tajam (maks 2.5x piksel CSS, supaya tulisan
   * petak terbaca), lalu turunkan bertahap HANYA bila FPS memang rendah.
   * Tidak pernah di bawah 1.75x agar layar tidak buram.
   */
  private adaptiveResolution() {
    const dpr = window.devicePixelRatio || 1;
    const MAX_DPR = Math.min(dpr, 2.5);
    const MIN_DPR = Math.min(dpr, 1.75);
    let renderDpr = MAX_DPR;
    // Hardware scaling = piksel CSS per piksel render, jadi 1/renderDpr (bukan dpr/renderDpr).
    const apply = () => this.engine.setHardwareScalingLevel(1 / renderDpr);
    apply();
    let slow = 0;
    window.setInterval(() => {
      if (document.visibilityState !== "visible" || renderDpr <= MIN_DPR) return;
      // Dua cek berturut-turut di bawah 40 FPS baru turun (hindari lonjakan sesaat)
      slow = this.engine.getFps() < 40 ? slow + 1 : 0;
      if (slow < 2) return;
      slow = 0;
      renderDpr = Math.max(MIN_DPR, renderDpr - 0.25);
      apply();
    }, 1500);
  }

  // ------------------------------------------------------------------ setup

  setupPlayers(state: GameState, characterIdx: number[]) {
    this.pawns.forEach((p) => p.root.dispose());
    this.pawns = state.players.map((p, i) => {
      const c = CRITTERS[characterIdx[i] % CRITTERS.length];
      const pawn = new Pawn(this.scene, this.shadows, c.kind, p.color, i);
      pawn.setPosition(pawnSlot(p.position, i));
      pawn.root.rotation.y = -Math.PI / 2;
      return pawn;
    });
    state.tiles.forEach((_, i) => void this.board.updateTile(state, i, false));
  }

  // ------------------------------------------------------------------ camera

  async focus(target: Vector3, radius: number, dur = 0.6, beta?: number, alpha?: number) {
    const cam = this.camera;
    const t0 = cam.target.clone();
    const r0 = cam.radius;
    const b0 = cam.beta;
    // Normalisasi alpha supaya berputar lewat jalur terpendek
    if (alpha !== undefined) {
      const TAU = Math.PI * 2;
      cam.alpha = ((((cam.alpha - alpha) % TAU) + TAU + Math.PI) % TAU) - Math.PI + alpha;
    }
    const a0 = cam.alpha;
    await tween(
      this.scene,
      dur,
      (t) => {
        cam.target = Vector3.Lerp(t0, target, t);
        cam.radius = lerp(r0, radius, t);
        if (beta !== undefined) cam.beta = lerp(b0, beta, t);
        if (alpha !== undefined) cam.alpha = lerp(a0, alpha, t);
      },
      Ease.inOutQuad,
    );
  }

  goHome(dur = 0.8) {
    return this.focus(HOME.target, HOME.radius, dur, HOME.beta, HOME.alpha);
  }

  private follow(p: Pawn) {
    const cam = this.camera;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const target = p.root.position.clone();
      target.y = 0;
      cam.target = Vector3.Lerp(cam.target, target.scale(0.6), 0.06);
      cam.radius = lerp(cam.radius, 26, 0.04);
      cam.beta = lerp(cam.beta, 0.8, 0.04);
    });
    return () => this.scene.onBeforeRenderObservable.remove(obs);
  }

  // ------------------------------------------------------------------ actions

  async rollDice(d1: number, d2: number) {
    sfx.dice();
    await this.dice.roll(d1, d2, new Vector3(0, 0.15, TILE * 0.6));
    sfx.land();
  }

  async movePawn(player: number, path: number[], mode: "walk" | "fly") {
    const pawn = this.pawns[player];
    const stop = this.follow(pawn);
    if (path.length) this.board.showDestination(path[path.length - 1], pawn.color);
    try {
      if (mode === "fly") {
        sfx.fly();
        const dest = path[path.length - 1];
        await pawn.flyTo(pawnSlot(dest, player));
        this.effects.dust(pawn.root.position);
        await this.board.bumpTile(dest);
      } else {
        for (const idx of path) {
          sfx.hop();
          await pawn.hopTo(pawnSlot(idx, player));
          sfx.land();
          this.effects.dust(pawn.root.position);
          void this.board.bumpTile(idx);
        }
      }
    } finally {
      this.board.hideDestination();
      stop();
    }
  }

  /** Guncang kamera (gempa, petir, kentut nuklir). */
  async shakeCamera(strength = 0.6, dur = 0.6) {
    const cam = this.camera;
    const base = cam.target.clone();
    await tween(this.scene, dur, (t) => {
      const k = (1 - t) * strength;
      cam.target = base.add(new Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k * 0.5, (Math.random() - 0.5) * k));
    });
    cam.target = base;
  }

  /** Efek konyol untuk kartu/event. `players` = pion yang kena. */
  async funFx(fx: FunFx, players: number[]) {
    const pawns = players.map((i) => this.pawns[i]).filter((p) => p && !p.isOut);
    const center = pawns.length === 1 ? pawns[0].root.position.clone() : new Vector3(0, 0, 0);
    switch (fx) {
      case "fart":
        sfx.fart();
        for (const p of pawns) this.effects.fart(p.root.position);
        void this.shakeCamera(0.8, 0.8);
        await Promise.all(this.pawns.filter((p) => !p.isOut).map((p) => p.blasted()));
        return;
      case "heli":
        sfx.heli();
        await this.effects.heliVisit(center, async () => {
          await Promise.all(pawns.map((p) => p.dizzy()));
        });
        return;
      case "party":
        sfx.pejabat();
        for (const p of pawns) {
          this.effects.emojiBurst(p.root.position.add(new Vector3(0, 1.8, 0)), "🥂", 5);
          this.effects.confetti(p.root.position.add(new Vector3(0, 1.2, 0)));
        }
        await Promise.all(pawns.map((p) => p.dance()));
        return;
      case "dance":
        sfx.dangdut();
        for (const p of pawns) this.effects.emojiBurst(p.root.position.add(new Vector3(0, 1.8, 0)), "🎵", 6);
        await Promise.all(pawns.map((p) => p.dance()));
        return;
      case "cry":
        sfx.sadTrombone();
        for (const p of pawns) this.effects.tears(p.root.position);
        await Promise.all(pawns.map((p) => p.sulk()));
        return;
      case "rain":
        sfx.coin();
        this.effects.moneyRain(center);
        await Promise.all(pawns.map((p) => p.cheer()));
        return;
      case "shake":
        sfx.zap();
        void this.shakeCamera(0.7, 0.7);
        for (const p of pawns) this.effects.emojiBurst(p.root.position.add(new Vector3(0, 1.8, 0)), "⚡", 5);
        await Promise.all(pawns.map((p) => p.blasted()));
        return;
      case "dizzy":
        sfx.boing();
        for (const p of pawns) this.effects.emojiBurst(p.root.position.add(new Vector3(0, 2, 0)), "⭐", 6);
        await Promise.all(pawns.map((p) => p.dizzy()));
        return;
      case "duck":
        sfx.honk();
        await this.effects.giantDuck(pawns.length === 1 ? center.add(new Vector3(0, 0, TILE * 1.4)) : new Vector3(0, 0, TILE));
        return;
    }
  }

  /** Mode memilih petak: highlight opsi & tunggu klik. */
  pickTile(options: number[]): Promise<number> {
    this.board.setHighlight(options);
    void this.goHome(0.6);
    return new Promise((resolve) => {
      this.pickObserver = this.scene.onPointerObservable.add((info) => {
        if (info.type !== PointerEventTypes.POINTERTAP) return;
        const idx = info.pickInfo?.pickedMesh?.metadata?.tileIndex;
        if (typeof idx === "number" && options.includes(idx)) {
          sfx.click();
          this.cancelPick();
          resolve(idx);
        }
      });
    });
  }

  cancelPick() {
    if (this.pickObserver) this.scene.onPointerObservable.remove(this.pickObserver);
    this.pickObserver = null;
    this.board.clearHighlight();
  }

  /** Proyeksi posisi dunia ke koordinat layar (px) untuk teks melayang. */
  worldToScreen(pos: Vector3): { x: number; y: number } {
    const engine = this.engine;
    const vp = this.camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const p = Vector3.Project(pos, Matrix.Identity(), this.scene.getTransformMatrix(), vp);
    const scale = engine.getHardwareScalingLevel();
    const rect = engine.getRenderingCanvasClientRect();
    return { x: p.x * scale + (rect?.left ?? 0), y: p.y * scale + (rect?.top ?? 0) };
  }

  dispose() {
    this.engine.dispose();
  }
}

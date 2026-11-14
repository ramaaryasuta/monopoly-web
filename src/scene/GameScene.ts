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
import { BoardView } from "./BoardView";
import { Dice } from "./Dice";
import { Effects } from "./Effects";
import { pawnSlot, TILE } from "./layout";
import { CRITTERS, Pawn } from "./Pawn";
import { sfx } from "./sfx";
import { clearToonCache } from "./toon";
import { Ease, lerp, tween } from "./tween";

const HOME = { alpha: -Math.PI / 2, beta: 0.85, radius: 34, target: new Vector3(0, 0, -1) };

export class GameScene {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  board!: BoardView;
  dice!: Dice;
  effects!: Effects;
  pawns: Pawn[] = [];
  private shadows: ShadowGenerator;
  private pickObserver: Observer<PointerInfo> | null = null;
  /** Dipanggil saat petak diklik (di luar mode memilih) — untuk info petak. */
  onTileClick: ((index: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true);
    const scene = (this.scene = new Scene(this.engine));
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
    this.shadows = new ShadowGenerator(2048, sun);
    this.shadows.useBlurExponentialShadowMap = true;
    this.shadows.blurKernel = 16;
    this.shadows.darkness = 0.45;

    // Post-processing: anti-alias, bloom ringan, warna lebih "pop"
    const pipeline = new DefaultRenderingPipeline("pipe", true, scene, [cam]);
    pipeline.samples = 4;
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = true;
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

    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP || this.pickObserver) return;
      const idx = info.pickInfo?.pickedMesh?.metadata?.tileIndex;
      if (typeof idx === "number") this.onTileClick?.(idx);
    });

    this.engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }

  // ------------------------------------------------------------------ setup

  setupPlayers(state: GameState, characterIdx: number[]) {
    this.pawns.forEach((p) => p.root.dispose());
    this.pawns = state.players.map((p, i) => {
      const c = CRITTERS[characterIdx[i] % CRITTERS.length];
      const pawn = new Pawn(this.scene, this.shadows, c.kind, p.color, i);
      pawn.setPosition(pawnSlot(0, i));
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
      stop();
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

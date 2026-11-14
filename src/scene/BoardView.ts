import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type ShadowGenerator,
  type Scene,
} from "@babylonjs/core";
import earcut from "earcut";
import { rentFor } from "../core/rules";
import type { GameState } from "../core/types";
import { BOARD } from "../data/board";
import { gridOf, inwardDir, TILE, TILE_HEIGHT, tilePosition, tileYaw } from "./layout";
import { createTileTexture, drawTile, FONT } from "./tileArt";
import { outline, toon } from "./toon";
import { Ease, tween } from "./tween";

interface TileView {
  root: TransformNode;
  block: Mesh;
  top: Mesh;
  tex: DynamicTexture;
  buildings: TransformNode;
  baseY: number;
}

export class BoardView {
  tiles: TileView[] = [];
  private festivalStar: Mesh;
  private highlighted = new Set<number>();
  private decor: TransformNode[] = [];

  constructor(
    private scene: Scene,
    private shadows: ShadowGenerator,
  ) {
    this.buildEnvironment();
    this.buildTiles();
    this.festivalStar = this.makeStar();
    this.festivalStar.setEnabled(false);

    // Animasi idle: awan melayang, bintang festival
    let time = 0;
    scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      time += dt;
      for (const d of this.decor) {
        const m = d.metadata as { kind: string; phase: number; baseY: number; speed?: number; radius?: number } | undefined;
        if (!m) continue;
        if (m.kind === "cloud") {
          d.position.x += dt * (m.speed ?? 0.3);
          if (d.position.x > 48) d.position.x = -48;
          d.position.y = m.baseY + Math.sin(time * 0.6 + m.phase) * 0.3;
        } else if (m.kind === "sway") {
          d.rotation.z = Math.sin(time * 1.5 + m.phase) * 0.04;
        } else if (m.kind === "bob") {
          d.position.y = m.baseY + Math.sin(time * 1.6 + m.phase) * 0.25;
          d.rotation.z = Math.sin(time * 1.1 + m.phase) * 0.12;
          d.rotation.x = Math.cos(time * 0.9 + m.phase) * 0.08;
        } else if (m.kind === "orbit") {
          const a = time * (m.speed ?? 0.2) + m.phase;
          const r = m.radius ?? 30;
          d.position.set(Math.cos(a) * r, m.baseY, Math.sin(a) * r);
          d.rotation.y = -a;
        } else if (m.kind === "wobble") {
          d.rotation.z = Math.sin(time * 0.8 + m.phase) * 0.08;
          d.position.y = m.baseY + Math.sin(time * 1.3 + m.phase) * 0.3;
        }
      }
      if (this.festivalStar.isEnabled()) {
        this.festivalStar.rotation.y += dt * 1.5;
        this.festivalStar.position.y = 3 + Math.sin(time * 2) * 0.25;
      }
      // Petak yang di-highlight memantul
      for (const i of this.highlighted) {
        const t = this.tiles[i];
        t.root.position.y = t.baseY + 0.15 + Math.abs(Math.sin(time * 5 + i)) * 0.2;
      }
    });
  }

  // ------------------------------------------------------------------ environment

  private buildEnvironment() {
    const s = this.scene;
    const R = TILE * 9 * 0.82;

    // Laut
    const sea = MeshBuilder.CreateDisc("sea", { radius: 120, tessellation: 64 }, s);
    sea.rotation.x = Math.PI / 2;
    sea.position.y = -1.2;
    const seaMat = toon(s, "#3fb7ff");
    sea.material = seaMat;
    sea.receiveShadows = true;

    // Riak ombak di sekitar pulau
    for (let i = 0; i < 3; i++) {
      const ring = MeshBuilder.CreateTorus(`wave${i}`, { diameter: R * 2 + 4 + i * 5, thickness: 0.25, tessellation: 64 }, s);
      ring.position.y = -1.15;
      ring.scaling.y = 0.2;
      ring.material = toon(s, "#bff0ff");
      ring.metadata = { kind: "sway", phase: i, baseY: -1.15 };
      this.decor.push(ring);
    }

    // Pulau: pasir + rumput
    const sand = MeshBuilder.CreateCylinder("sand", { diameter: R * 2 + 3, height: 1, tessellation: 64 }, s);
    sand.position.y = -0.9;
    sand.material = toon(s, "#ffe2a1");
    sand.receiveShadows = true;
    outline(sand, 0.06);

    const grass = MeshBuilder.CreateCylinder("grass", { diameter: R * 2, height: 1, tessellation: 64 }, s);
    grass.position.y = -0.45;
    grass.material = toon(s, "#6fdc5b");
    grass.receiveShadows = true;
    outline(grass, 0.06);

    // Area dalam papan (rumput lebih terang)
    const inner = MeshBuilder.CreateBox("inner", { width: TILE * 7.6, depth: TILE * 7.6, height: 0.2 }, s);
    inner.position.y = 0.05;
    inner.material = toon(s, "#8ef07a");
    inner.receiveShadows = true;

    // Papan judul di tengah
    this.buildTitle();

    // Bukit di luar papan
    const hillSpots = [
      [-14, 13, 4],
      [15, 14, 5],
      [-16, -12, 3.5],
      [16, -13, 4],
      [0, 17, 3],
      [-18, 1, 3],
      [18, 0, 3.2],
    ];
    hillSpots.forEach(([x, z, r], i) => {
      const hill = MeshBuilder.CreateSphere(`hill${i}`, { diameter: r * 2, segments: 16 }, s);
      hill.scaling.y = 0.55;
      hill.position.set(x, -0.3, z);
      hill.material = toon(s, i % 2 ? "#4fc94a" : "#5ed65a");
      hill.receiveShadows = true;
      outline(hill, 0.05);
    });

    // Pohon bulat & jamur di luar papan
    const rnd = mulberry(7);
    for (let i = 0; i < 40; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = TILE * 5.4 + rnd() * 4.5;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (Math.hypot(x, z) > R - 1) continue;
      // Jangan taruh pohon di sisi depan (arah kamera) agar papan tidak tertutup
      if (z < -TILE * 4.6) continue;
      if (rnd() < 0.7) this.makeTree(new Vector3(x, 0, z), 0.8 + rnd() * 0.6, i);
      else this.makeMushroom(new Vector3(x, 0, z), 0.7 + rnd() * 0.4, i);
    }

    // Pohon kecil di sudut area dalam
    const c = TILE * 2.6;
    [
      [-c, -c],
      [c, -c],
      [-c, c],
      [c, c],
    ].forEach(([x, z], i) => this.makeTree(new Vector3(x, 0.15, z), 0.9, 100 + i));

    this.buildWackyDecor();

    // Awan
    for (let i = 0; i < 9; i++) {
      const cloud = new TransformNode(`cloud${i}`, s);
      const n = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const puff = MeshBuilder.CreateSphere(`puff${i}_${k}`, { diameter: 2 + rnd() * 1.5, segments: 12 }, s);
        puff.position.set(k * 1.3 - n * 0.6, rnd() * 0.5, rnd() * 0.8);
        puff.material = toon(s, "#ffffff");
        puff.parent = cloud;
        outline(puff, 0.05);
      }
      // Awan di cakrawala (jauh dari papan) supaya tidak menghalangi kamera
      const y = 5 + rnd() * 6;
      const ang = rnd() * Math.PI * 2;
      const dist = 34 + rnd() * 14;
      cloud.position.set(Math.cos(ang) * dist, y, Math.abs(Math.sin(ang)) * dist + 5);
      cloud.metadata = { kind: "cloud", phase: rnd() * 6, baseY: y, speed: 0.3 + rnd() * 0.5 };
      this.decor.push(cloud);
    }
  }

  private buildTitle() {
    const s = this.scene;
    const tex = new DynamicTexture("titleTex", { width: 1024, height: 512 }, s, true);
    tex.hasAlpha = true;
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 1024, 512);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#2b1d3a";
    ctx.font = `bold 150px ${FONT}`;
    ctx.lineWidth = 28;
    ctx.strokeText("MEMONOPOLI", 512, 170, 980);
    const g = ctx.createLinearGradient(0, 90, 0, 250);
    g.addColorStop(0, "#ffe14d");
    g.addColorStop(1, "#ff9a3d");
    ctx.fillStyle = g;
    ctx.fillText("MEMONOPOLI", 512, 170, 980);
    ctx.font = `bold 110px ${FONT}`;
    ctx.lineWidth = 24;
    ctx.strokeText("WILAYAH WNI", 512, 350, 900);
    const g2 = ctx.createLinearGradient(0, 300, 0, 400);
    g2.addColorStop(0, "#ffffff");
    g2.addColorStop(1, "#ffb3b3");
    ctx.fillStyle = g2;
    ctx.fillText("WILAYAH WNI", 512, 350, 900);
    tex.update();

    const plane = MeshBuilder.CreatePlane("title", { width: TILE * 4.2, height: TILE * 2.1 }, s);
    plane.rotation.x = Math.PI / 2;
    plane.position.set(0, 0.17, -TILE * 2.1);
    const mat = new StandardMaterial("titleMat", s);
    mat.diffuseTexture = tex;
    mat.emissiveColor = new Color3(0.6, 0.6, 0.6);
    mat.useAlphaFromDiffuseTexture = true;
    mat.specularColor = Color3.Black();
    plane.material = mat;
  }

  private makeTree(pos: Vector3, scale: number, id: number) {
    const s = this.scene;
    const root = new TransformNode(`tree${id}`, s);
    root.position.copyFrom(pos);
    root.scaling.setAll(scale);
    const trunk = MeshBuilder.CreateCylinder(`trunk${id}`, { diameterTop: 0.35, diameterBottom: 0.5, height: 1.4 }, s);
    trunk.position.y = 0.7;
    trunk.material = toon(s, "#a8673a");
    trunk.parent = root;
    outline(trunk, 0.04);
    const crown = MeshBuilder.CreateSphere(`crown${id}`, { diameter: 1.9, segments: 14 }, s);
    crown.position.y = 2;
    crown.material = toon(s, id % 3 === 0 ? "#3fbf4a" : "#4ccf55");
    crown.parent = root;
    outline(crown, 0.04);
    this.shadows.addShadowCaster(crown);
    this.shadows.addShadowCaster(trunk);
    // Wajah konyol menghadap kamera (sebagian pohon saja)
    if (id % 2 === 0 || id >= 100) this.addFace(root, new Vector3(0, 2.05, -0.86), 0.32, id % 4 === 0 ? "grin" : "o");
    root.metadata = { kind: "sway", phase: id, baseY: pos.y };
    this.decor.push(root);
  }

  private makeMushroom(pos: Vector3, scale: number, id: number) {
    const s = this.scene;
    const root = new TransformNode(`mush${id}`, s);
    root.position.copyFrom(pos);
    root.scaling.setAll(scale);
    const stem = MeshBuilder.CreateCylinder(`stem${id}`, { diameterTop: 0.5, diameterBottom: 0.65, height: 0.9 }, s);
    stem.position.y = 0.45;
    stem.material = toon(s, "#fff3dc");
    stem.parent = root;
    outline(stem, 0.04);
    const cap = MeshBuilder.CreateSphere(`cap${id}`, { diameter: 1.6, segments: 14, slice: 0.5 }, s);
    cap.position.y = 0.8;
    cap.material = toon(s, id % 2 ? "#ff5b7a" : "#ff8c3d");
    cap.parent = root;
    outline(cap, 0.04);
    for (let k = 0; k < 4; k++) {
      const dot = MeshBuilder.CreateSphere(`dot${id}_${k}`, { diameter: 0.3, segments: 8 }, s);
      const a = (k / 4) * Math.PI * 2;
      dot.position.set(Math.cos(a) * 0.5, 1.15, Math.sin(a) * 0.5);
      dot.scaling.y = 0.5;
      dot.material = toon(s, "#ffffff");
      dot.parent = root;
    }
    this.shadows.addShadowCaster(cap);
    this.addFace(root, new Vector3(0, 0.5, -0.3), 0.18, "grin");
  }

  /** Mata googly juling + mulut di permukaan objek (menghadap -z). */
  private addFace(parent: TransformNode, at: Vector3, size: number, mouth: "grin" | "o") {
    const s = this.scene;
    for (const sx of [-1, 1]) {
      const eye = MeshBuilder.CreateSphere("fEye", { diameter: size, segments: 10 }, s);
      eye.material = toon(s, "#ffffff");
      eye.parent = parent;
      eye.position.set(at.x + sx * size * 0.62, at.y, at.z);
      eye.scaling.z = 0.6;
      outline(eye, 0.02);
      const p = MeshBuilder.CreateSphere("fPupil", { diameter: size * 0.45, segments: 8 }, s);
      p.material = toon(s, "#2b1d3a");
      p.parent = parent;
      p.position.set(at.x + sx * size * 0.62 - sx * size * 0.12, at.y - size * 0.05, at.z - size * 0.28);
      p.scaling.z = 0.4;
    }
    const m =
      mouth === "o"
        ? MeshBuilder.CreateSphere("fMouth", { diameter: size * 0.5, segments: 8 }, s)
        : MeshBuilder.CreateBox("fMouth", { width: size * 1.3, height: size * 0.25, depth: size * 0.2 }, s);
    m.material = toon(s, "#2b1d3a");
    m.parent = parent;
    m.position.set(at.x, at.y - size * 0.85, at.z + 0.02);
    if (mouth === "o") m.scaling.z = 0.4;
  }

  /** Dekorasi aneh: matahari berkacamata, bebek karet, sirip hiu, sendal raksasa, donat. */
  private buildWackyDecor() {
    const s = this.scene;
    const mk = (m: Mesh, hex: string, parent: TransformNode, w = 0.05) => {
      m.material = toon(s, hex);
      m.parent = parent;
      if (w) outline(m, w);
      return m;
    };

    // Matahari pakai kacamata hitam
    const sun = new TransformNode("sunFace", s);
    sun.position.set(-26, 20, 42);
    const disc = mk(MeshBuilder.CreateSphere("sunDisc", { diameter: 8, segments: 20 }, s), "#ffd23f", sun, 0.08);
    disc.scaling.z = 0.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const ray = mk(MeshBuilder.CreateCylinder("ray", { diameterTop: 0, diameterBottom: 1.2, height: 1.8, tessellation: 4 }, s), "#ffb84d", sun, 0.04);
      ray.position.set(Math.cos(a) * 5.2, Math.sin(a) * 5.2, 0);
      ray.rotation.z = a - Math.PI / 2;
    }
    for (const sx of [-1.3, 1.3]) {
      const lens = mk(MeshBuilder.CreateBox("sunLens", { width: 2.2, height: 1.2, depth: 0.3 }, s), "#111122", sun, 0.03);
      lens.position.set(sx, 0.7, -2);
    }
    const bridge = mk(MeshBuilder.CreateBox("sunBridge", { width: 1, height: 0.25, depth: 0.2 }, s), "#111122", sun, 0);
    bridge.position.set(0, 0.9, -2);
    const smile = mk(MeshBuilder.CreateBox("sunSmile", { width: 3, height: 0.35, depth: 0.2 }, s), "#c25a00", sun, 0);
    smile.position.set(0, -1.3, -1.95);
    for (const sx of [-1, 1]) {
      const corner = mk(MeshBuilder.CreateBox("sunSmileC", { width: 0.7, height: 0.35, depth: 0.2 }, s), "#c25a00", sun, 0);
      corner.position.set(sx * 1.65, -1.05, -1.95);
      corner.rotation.z = sx * 0.7;
    }
    sun.metadata = { kind: "wobble", phase: 0, baseY: 20 };
    this.decor.push(sun);

    // Bebek karet mengapung di laut
    const duckSpots: [number, number, number][] = [
      [24, -24, 1.6],
      [-30, -14, 1.2],
      [33, 12, 1.4],
    ];
    duckSpots.forEach(([x, z, sc], i) => {
      const duck = new TransformNode(`duck${i}`, s);
      duck.position.set(x, -1.1, z);
      duck.scaling.setAll(sc);
      duck.rotation.y = Math.PI + i;
      const b = mk(MeshBuilder.CreateSphere("duckBody", { diameter: 2, segments: 14 }, s), "#ffd23f", duck);
      b.scaling.set(1.25, 0.75, 1);
      b.position.y = 0.5;
      const hd = mk(MeshBuilder.CreateSphere("duckHead", { diameter: 1.2, segments: 14 }, s), "#ffd23f", duck);
      hd.position.set(0, 1.5, 0.5);
      const bk = mk(MeshBuilder.CreateSphere("duckBeak", { diameter: 0.7, segments: 10 }, s), "#ff8c3d", duck, 0.03);
      bk.scaling.set(1.1, 0.4, 1);
      bk.position.set(0, 1.4, 1.1);
      const tail = mk(MeshBuilder.CreateCylinder("duckTail", { diameterTop: 0, diameterBottom: 0.7, height: 0.7, tessellation: 8 }, s), "#ffd23f", duck, 0.03);
      tail.position.set(0, 1, -1.1);
      tail.rotation.x = -0.9;
      for (const sx of [-0.3, 0.3]) {
        const e = mk(MeshBuilder.CreateSphere("duckEye", { diameter: 0.3, segments: 8 }, s), "#ffffff", duck, 0.02);
        e.position.set(sx, 1.7, 0.95);
        const p = mk(MeshBuilder.CreateSphere("duckPupil", { diameter: 0.15, segments: 6 }, s), "#111122", duck, 0);
        p.position.set(sx * (i === 1 ? 0.6 : 1.2), 1.68, 1.08);
      }
      duck.metadata = { kind: "bob", phase: i * 2, baseY: -1.1 };
      this.decor.push(duck);
    });

    // Sirip hiu berputar mengelilingi pulau
    for (let i = 0; i < 2; i++) {
      const fin = new TransformNode(`fin${i}`, s);
      const f = mk(MeshBuilder.CreateCylinder("fin", { diameterTop: 0, diameterBottom: 1.6, height: 1.8, tessellation: 3 }, s), "#6c7a92", fin);
      f.scaling.z = 0.3;
      f.position.y = 0.5;
      const foam = mk(MeshBuilder.CreateTorus("foam", { diameter: 1.8, thickness: 0.25, tessellation: 16 }, s), "#ffffff", fin, 0);
      foam.scaling.y = 0.3;
      fin.metadata = { kind: "orbit", phase: i * Math.PI, baseY: -1.1, speed: 0.18 + i * 0.07, radius: 28 + i * 6 };
      this.decor.push(fin);
    }

    // Sendal jepit raksasa nancep di bukit belakang
    const sandal = new TransformNode("giantSandal", s);
    sandal.position.set(15, 1.2, 15.5);
    sandal.rotation.set(-1.1, 0.5, 0.2);
    const sole = mk(MeshBuilder.CreateCylinder("sole", { diameter: 2.4, height: 0.35, tessellation: 24 }, s), "#ffffff", sandal);
    sole.scaling.set(1, 1, 2);
    const sole2 = mk(MeshBuilder.CreateCylinder("sole2", { diameter: 2.4, height: 0.15, tessellation: 24 }, s), "#3a7bff", sandal, 0);
    sole2.scaling.set(1, 1, 2);
    sole2.position.y = -0.24;
    for (const sx of [-1, 1]) {
      const strap = mk(MeshBuilder.CreateCapsule("strap", { radius: 0.15, height: 1.9 }, s), "#3a7bff", sandal, 0.03);
      strap.position.set(sx * 0.45, 0.4, 0.6);
      strap.rotation.set(0.9, 0, sx * 0.8);
    }

    // Donat raksasa tergeletak
    const donut = new TransformNode("giantDonut", s);
    donut.position.set(-15.5, 0.6, 14);
    donut.rotation.set(0.25, 0, 0.2);
    mk(MeshBuilder.CreateTorus("dough", { diameter: 3.2, thickness: 1.3, tessellation: 24 }, s), "#e9a04b", donut);
    const frost = mk(MeshBuilder.CreateTorus("frost", { diameter: 3.2, thickness: 1.2, tessellation: 24 }, s), "#ff7ab6", donut, 0);
    frost.position.y = 0.18;
    frost.scaling.y = 0.75;
    const sprCols = ["#ffe14d", "#5bb8ff", "#7ee06b", "#ffffff"];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 1.45 + (i % 3) * 0.15;
      const sp = mk(MeshBuilder.CreateCapsule("spr", { radius: 0.06, height: 0.3 }, s), sprCols[i % 4], donut, 0);
      sp.position.set(Math.cos(a) * r, 0.68, Math.sin(a) * r);
      sp.rotation.set(Math.PI / 2, a * 3, 0);
    }
    this.shadows.addShadowCaster(frost);
  }

  private makeStar(): Mesh {
    const s = this.scene;
    const shape: Vector3[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.8 : 0.35;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      shape.push(new Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    shape.push(shape[0]);
    const star = MeshBuilder.ExtrudePolygon("festStar", { shape: shape.map((v) => new Vector3(v.x, 0, v.y)), depth: 0.25 }, s, earcut);
    star.rotation.x = -Math.PI / 2;
    const holder = new Mesh("festStarHolder", s);
    star.parent = holder;
    star.material = toon(s, "#ffd23f");
    outline(star, 0.04);
    return holder;
  }

  // ------------------------------------------------------------------ tiles

  private buildTiles() {
    const s = this.scene;
    for (const def of BOARD) {
      const root = new TransformNode(`tile${def.index}`, s);
      const p = tilePosition(def.index, 0);
      root.position.copyFrom(p);
      root.rotation.y = tileYaw(def.index);
      const isCorner = def.index % 8 === 0;

      const size = TILE * 0.94;
      const block = MeshBuilder.CreateBox(`block${def.index}`, { width: size, depth: size, height: TILE_HEIGHT }, s);
      block.position.y = TILE_HEIGHT / 2;
      block.material = toon(s, isCorner ? "#ffcf4d" : "#fff6e6");
      block.parent = root;
      block.receiveShadows = true;
      outline(block, 0.03);
      block.metadata = { tileIndex: def.index };

      const top = MeshBuilder.CreatePlane(`top${def.index}`, { size: size * 0.98 }, s);
      top.rotation.x = Math.PI / 2;
      top.position.y = TILE_HEIGHT + 0.06;
      top.parent = root;
      const tex = createTileTexture(s, `tileTex${def.index}`);
      const mat = new StandardMaterial(`tileMat${def.index}`, s);
      mat.diffuseTexture = tex;
      mat.useAlphaFromDiffuseTexture = true;
      mat.emissiveColor = new Color3(0.45, 0.45, 0.45);
      mat.specularColor = Color3.Black();
      top.material = mat;
      top.receiveShadows = true;
      top.metadata = { tileIndex: def.index };

      const buildings = new TransformNode(`bld${def.index}`, s);
      buildings.parent = root;
      // Bangunan diletakkan di rumput sisi dalam petak supaya label tetap terbaca
      buildings.position.set(0, 0.15, TILE * 0.82);

      this.tiles.push({ root, block, top, tex, buildings, baseY: 0 });
      drawTile(tex, def, { ownerColor: null, rent: 0, festival: false });
      tex.update();
    }
  }

  /** Perbarui tampilan petak sesuai state, dengan animasi "pop" untuk bangunan baru. */
  async updateTile(state: GameState, index: number, animate = true) {
    const def = BOARD[index];
    const ts = state.tiles[index];
    const view = this.tiles[index];
    const owner = ts.owner !== null ? state.players[ts.owner] : null;
    drawTile(view.tex, def, { ownerColor: owner?.color ?? null, rent: rentFor(state, index), festival: ts.festival });
    view.tex.update();

    // Festival star
    if (ts.festival) {
      const p = tilePosition(index, 3);
      this.festivalStar.position.copyFrom(p);
      this.festivalStar.setEnabled(true);
    } else if (state.festivalTile === null) {
      this.festivalStar.setEnabled(false);
    }

    const key = `${ts.owner}:${ts.level}`;
    if (view.buildings.metadata === key) return;
    view.buildings.metadata = key;
    view.buildings.getChildMeshes().forEach((m) => m.dispose());
    view.buildings.getChildren().forEach((c) => c.dispose());
    if (!owner || ts.level === 0) return;

    const node = this.makeBuilding(def.kind === "resort" ? "resort" : ts.level, owner.color, index);
    node.parent = view.buildings;
    if (animate) {
      node.scaling.setAll(0.01);
      await tween(this.scene, 0.45, (t) => node.scaling.setAll(Math.max(0.01, t)), Ease.outBack);
    }
  }

  /** Model bangunan prosedural per level. */
  private makeBuilding(level: number | "resort", color: string, id: number): TransformNode {
    const s = this.scene;
    const root = new TransformNode(`b_${id}_${level}`, s);
    const add = (m: Mesh, hex: string, shadow = true) => {
      m.material = toon(s, hex);
      m.parent = root;
      outline(m, 0.03);
      if (shadow) this.shadows.addShadowCaster(m);
      return m;
    };

    if (level === "resort") {
      const pole = add(MeshBuilder.CreateCylinder("pole", { diameter: 0.12, height: 1.4 }, s), "#ffffff");
      pole.position.y = 0.7;
      const umb = add(MeshBuilder.CreateCylinder("umb", { diameterTop: 0, diameterBottom: 1.5, height: 0.5, tessellation: 8 }, s), color);
      umb.position.y = 1.5;
      const chair = add(MeshBuilder.CreateBox("chair", { width: 0.5, height: 0.12, depth: 1 }, s), "#ffffff");
      chair.position.set(0.6, 0.12, 0);
      return root;
    }

    if (level === 1) {
      const pole = add(MeshBuilder.CreateCylinder("flagpole", { diameter: 0.1, height: 1.6 }, s), "#ffffff");
      pole.position.y = 0.8;
      const flag = add(MeshBuilder.CreateBox("flag", { width: 0.7, height: 0.45, depth: 0.05 }, s), color);
      flag.position.set(0.38, 1.35, 0);
      const base = add(MeshBuilder.CreateCylinder("flagbase", { diameter: 0.5, height: 0.15 }, s), "#8a8a9a");
      base.position.y = 0.07;
      return root;
    }

    if (level >= 2 && level <= 4) {
      const count = level - 1;
      const spacing = 0.75;
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * spacing;
        const big = level === 4 && i === 1;
        const h = big ? 0.9 : 0.6;
        const body = add(MeshBuilder.CreateBox("house", { width: 0.6, height: h, depth: 0.6 }, s), "#fff6e6");
        body.position.set(x, h / 2, 0);
        const roof = add(
          MeshBuilder.CreateCylinder("roof", { diameterTop: 0, diameterBottom: 0.95, height: 0.5, tessellation: 4 }, s),
          color,
        );
        roof.rotation.y = Math.PI / 4;
        roof.position.set(x, h + 0.25, 0);
        const door = add(MeshBuilder.CreateBox("door", { width: 0.2, height: 0.3, depth: 0.02 }, s), "#a8673a", false);
        door.position.set(x, 0.15, -0.31);
        // Jendela = mata googly, rumahnya ikut melongo
        for (const sx of [-0.15, 0.15]) {
          const win = add(MeshBuilder.CreateSphere("winEye", { diameter: 0.17, segments: 8 }, s), "#ffffff", false);
          win.position.set(x + sx, h - 0.15, -0.3);
          win.scaling.z = 0.4;
          const pup = add(MeshBuilder.CreateSphere("winPupil", { diameter: 0.08, segments: 6 }, s), "#2b1d3a", false);
          pup.position.set(x + sx + (Math.random() - 0.5) * 0.05, h - 0.17, -0.35);
          pup.renderOutline = false;
        }
      }
      return root;
    }

    // Landmark: menara megah
    const base = add(MeshBuilder.CreateCylinder("lmBase", { diameter: 1.3, height: 0.5, tessellation: 12 }, s), "#fff6e6");
    base.position.y = 0.25;
    const tower = add(MeshBuilder.CreateCylinder("lmTower", { diameterTop: 0.6, diameterBottom: 0.9, height: 1.8, tessellation: 12 }, s), color);
    tower.position.y = 1.4;
    const cap = add(MeshBuilder.CreateCylinder("lmCap", { diameterTop: 0, diameterBottom: 1, height: 0.8, tessellation: 12 }, s), "#ffd23f");
    cap.position.y = 2.7;
    const orb = add(MeshBuilder.CreateSphere("lmOrb", { diameter: 0.35 }, s), "#ffffff");
    orb.position.y = 3.2;
    // Menara sultan: kacamata hitam + kumis
    for (const sx of [-0.17, 0.17]) {
      const lens = add(MeshBuilder.CreateBox("lmLens", { width: 0.28, height: 0.16, depth: 0.06 }, s), "#111122", false);
      lens.position.set(sx, 1.85, -0.36);
    }
    for (const sx of [-1, 1]) {
      const st = add(MeshBuilder.CreateCapsule("lmStache", { radius: 0.06, height: 0.4 }, s), "#2b1d3a", false);
      st.position.set(sx * 0.15, 1.6, -0.4);
      st.rotation.z = sx * (Math.PI / 2 - 0.4);
    }
    return root;
  }

  // ------------------------------------------------------------------ picking

  setHighlight(indices: number[]) {
    this.clearHighlight();
    for (const i of indices) {
      this.highlighted.add(i);
      const b = this.tiles[i].block;
      b.renderOverlay = true;
      b.overlayColor = Color3.FromHexString("#ffe14d");
      b.overlayAlpha = 0.6;
    }
  }

  clearHighlight() {
    for (const i of this.highlighted) {
      const t = this.tiles[i];
      t.block.renderOverlay = false;
      t.root.position.y = t.baseY;
    }
    this.highlighted.clear();
  }

  /** Efek "tekan" petak saat pion mendarat. */
  async bumpTile(index: number) {
    const t = this.tiles[index];
    await tween(this.scene, 0.25, (k) => {
      t.root.position.y = t.baseY - Math.sin(k * Math.PI) * 0.15;
    });
  }

  tileCenter(index: number) {
    return tilePosition(index);
  }

  inward(index: number) {
    return inwardDir(index);
  }

  grid(index: number) {
    return gridOf(index);
  }
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

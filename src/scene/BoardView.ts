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

    // Animasi idle: awan melayang, koin berputar, bintang festival
    let time = 0;
    scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      time += dt;
      for (const d of this.decor) {
        const m = d.metadata as { kind: string; phase: number; baseY: number; speed?: number } | undefined;
        if (!m) continue;
        if (m.kind === "cloud") {
          d.position.x += dt * (m.speed ?? 0.3);
          if (d.position.x > 48) d.position.x = -48;
          d.position.y = m.baseY + Math.sin(time * 0.6 + m.phase) * 0.3;
        } else if (m.kind === "coin") {
          d.rotation.y += dt * 2;
          d.position.y = m.baseY + Math.sin(time * 2 + m.phase) * 0.2;
        } else if (m.kind === "sway") {
          d.rotation.z = Math.sin(time * 1.5 + m.phase) * 0.04;
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

    // Koin melayang
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const coin = MeshBuilder.CreateCylinder(`coin${i}`, { diameter: 0.9, height: 0.15, tessellation: 24 }, s);
      coin.rotation.x = Math.PI / 2;
      const holder = new TransformNode(`coinHolder${i}`, s);
      coin.parent = holder;
      holder.position.set(Math.cos(ang) * TILE * 2.2, 2.2, Math.sin(ang) * TILE * 2.2);
      coin.material = toon(s, "#ffd23f");
      outline(coin, 0.04);
      holder.metadata = { kind: "coin", phase: i, baseY: 2.2 };
      this.decor.push(holder);
      this.shadows.addShadowCaster(coin);
    }

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
    ctx.font = `bold 170px ${FONT}`;
    ctx.lineJoin = "round";
    ctx.lineWidth = 30;
    ctx.strokeStyle = "#2b1d3a";
    ctx.strokeText("PULAU", 512, 150);
    ctx.strokeText("KAYA", 512, 340);
    const g = ctx.createLinearGradient(0, 60, 0, 440);
    g.addColorStop(0, "#ffe14d");
    g.addColorStop(1, "#ff9a3d");
    ctx.fillStyle = g;
    ctx.fillText("PULAU", 512, 150);
    ctx.fillText("KAYA", 512, 340);
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

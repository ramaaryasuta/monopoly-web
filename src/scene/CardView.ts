import {
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  TransformNode,
  Vector3,
  type ArcRotateCamera,
  type Material,
  type Scene,
  type ShadowGenerator,
} from "@babylonjs/core";
import { TILE } from "./layout";
import { cameraFacing, inFrontOfCamera, roundRect, unlitMaterial, viewDistance, wrapText } from "./screenSpace";
import { FONT } from "./tileArt";
import { outline, toon } from "./toon";
import { cardSfx } from "./sfx";
import { Ease, lerp, Speed, tween } from "./tween";

/** Ukuran kartu (unit dunia). Rasio mirip kartu remi. */
const W = 1.5;
const H = 2.1;
const THICK = 0.05;
/** Resolusi tekstur muka kartu. */
const TW = 512;
const TH = Math.round((TW * H) / W);

export interface CardFace {
  icon: string;
  title: string;
  text: string;
  /** "card" = kartu biasa, "item" = kartu simpanan (warna & label beda). */
  kind: "card" | "item";
  /** Label pita atas kartu biasa, mis. nama petak paket. */
  header?: string;
}

/** Letak tumpukan kartu di dalam papan (pojok kanan-atas area rumput). */
const DECK_POS = new Vector3(TILE * 2.3, 0.15, TILE * 2.1);
const DECK_SIZE = 6;

/** Rotasi kartu yang tergeletak telungkup (punggung menghadap atas). */
const FACE_DOWN = Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2);

/** Tumpukan kartu 3D + animasi ambil kartu, buka kartu, dan lempar kartu simpanan. */
export class CardView {
  private backMat: StandardMaterial;
  private edgeMat: Material;
  private deck: TransformNode;

  constructor(
    private scene: Scene,
    private camera: ArcRotateCamera,
    shadows: ShadowGenerator,
  ) {
    this.backMat = unlitMaterial(this.scene, "cardBack", this.drawBack());
    this.edgeMat = toon(scene, "#fffbe6");

    // Tumpukan kartu di papan, sedikit acak supaya terlihat "ditumpuk tangan"
    this.deck = new TransformNode("deck", scene);
    this.deck.position.copyFrom(DECK_POS);
    this.deck.rotation.y = 0.25;
    for (let i = 0; i < DECK_SIZE; i++) {
      const c = this.buildCard(`deck${i}`, null);
      c.parent = this.deck;
      c.position.set((Math.sin(i * 7.1) * 0.06), THICK / 2 + i * (THICK + 0.005), Math.cos(i * 3.3) * 0.06);
      c.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.sin(i * 5.3) * 0.08).multiply(FACE_DOWN);
      c.getChildMeshes().forEach((m) => shadows.addShadowCaster(m));
    }
  }

  // ------------------------------------------------------------------ textures

  private drawBack() {
    const tex = new DynamicTexture("cardBackTex", { width: TW, height: TH }, this.scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#fffbe6";
    ctx.fillRect(0, 0, TW, TH);
    roundRect(ctx, 22, 22, TW - 44, TH - 44, 34);
    const g = ctx.createLinearGradient(0, 0, TW, TH);
    g.addColorStop(0, "#8a5cff");
    g.addColorStop(1, "#ff5fa2");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#2b1d3a";
    ctx.stroke();
    // Pola polkadot
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let y = 60; y < TH - 40; y += 56)
      for (let x = 60 + ((y / 56) % 2) * 28; x < TW - 40; x += 56) {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    // Tanda tanya besar
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold 300px ${FONT}`;
    ctx.lineJoin = "round";
    ctx.lineWidth = 22;
    ctx.strokeStyle = "#2b1d3a";
    ctx.strokeText("?", TW / 2, TH / 2 - 10);
    ctx.fillStyle = "#ffe14d";
    ctx.fillText("?", TW / 2, TH / 2 - 10);
    ctx.font = `bold 44px ${FONT}`;
    ctx.lineWidth = 10;
    ctx.strokeText("MEMONOPOLI", TW / 2, TH - 110);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("MEMONOPOLI", TW / 2, TH - 110);
    ctx.font = `bold 30px ${FONT}`;
    ctx.lineWidth = 8;
    ctx.strokeText("WILAYAH WNI", TW / 2, TH - 66);
    ctx.fillStyle = "#ffe14d";
    ctx.fillText("WILAYAH WNI", TW / 2, TH - 66);
    tex.update();
    return tex;
  }

  private drawFront(face: CardFace) {
    const tex = new DynamicTexture("cardFrontTex", { width: TW, height: TH }, this.scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    const item = face.kind === "item";
    ctx.fillStyle = "#fffbe6";
    ctx.fillRect(0, 0, TW, TH);
    roundRect(ctx, 22, 22, TW - 44, TH - 44, 34);
    ctx.fillStyle = item ? "#ffe1f0" : "#fff3c4";
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#2b1d3a";
    ctx.stroke();

    // Pita label atas
    roundRect(ctx, 60, 48, TW - 120, 64, 30);
    ctx.fillStyle = item ? "#ff5fa2" : "#36d1c4";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(item ? "🎒 KARTU SIMPANAN" : `📦 ${(face.header ?? "Paket Misterius").toUpperCase()}`, TW / 2, 82);

    // Ikon besar di lingkaran
    ctx.beginPath();
    ctx.arc(TW / 2, 270, 120, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.font = `150px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`;
    ctx.fillStyle = "#000";
    ctx.fillText(face.icon, TW / 2, 280);

    // Judul
    ctx.font = `bold 46px ${FONT}`;
    const titleLines = wrapText(ctx, face.title, TW - 100).slice(0, 2);
    let y = 440;
    ctx.lineJoin = "round";
    for (const l of titleLines) {
      ctx.lineWidth = 9;
      ctx.strokeStyle = "#2b1d3a";
      ctx.strokeText(l, TW / 2, y);
      ctx.fillStyle = item ? "#ff5fa2" : "#ff8a3d";
      ctx.fillText(l, TW / 2, y);
      y += 52;
    }

    // Teks efek
    ctx.font = `600 30px ${FONT}`;
    ctx.fillStyle = "#2b1d3a";
    const lines = wrapText(ctx, face.text, TW - 110).slice(0, 6);
    y += 14;
    for (const l of lines) {
      ctx.fillText(l, TW / 2, y);
      y += 38;
    }
    tex.update();
    return tex;
  }

  // ------------------------------------------------------------------ mesh

  /** Kartu = badan tipis + muka depan (-z lokal) + punggung (+z lokal). */
  private buildCard(name: string, face: CardFace | null): TransformNode {
    const s = this.scene;
    const root = new TransformNode(name, s);
    const body = MeshBuilder.CreateBox(`${name}_body`, { width: W, height: H, depth: THICK }, s);
    body.material = this.edgeMat;
    body.parent = root;
    // Outline hanya untuk kartu di tumpukan; pada kartu dekat kamera cangkang outline menutupi muka kartu
    if (!face) outline(body, 0.025);

    const back = MeshBuilder.CreatePlane(`${name}_back`, { width: W, height: H }, s);
    back.material = this.backMat;
    back.parent = root;
    back.position.z = THICK / 2 + 0.002;
    back.rotation.y = Math.PI;

    if (face) {
      const front = MeshBuilder.CreatePlane(`${name}_front`, { width: W, height: H }, s);
      front.material = unlitMaterial(this.scene, `${name}_frontMat`, this.drawFront(face));
      front.parent = root;
      front.position.z = -THICK / 2 - 0.002;
    }
    return root;
  }

  private setOnTop(root: TransformNode) {
    for (const m of root.getChildMeshes()) (m as Mesh).renderingGroupId = 1;
  }

  private disposeCard(root: TransformNode) {
    for (const m of root.getChildMeshes()) {
      const mat = m.material;
      if (mat instanceof StandardMaterial && mat !== this.backMat) {
        mat.emissiveTexture?.dispose();
        mat.dispose();
      }
    }
    root.dispose();
  }

  // ------------------------------------------------------------------ animasi

  private current: TransformNode | null = null;

  /**
   * Ambil kartu teratas dari tumpukan: melayang ke depan kamera sambil berputar,
   * lalu dibalik memperlihatkan muka kartu. Kartu tetap tampil sampai `dismiss()`.
   */
  async draw(face: CardFace) {
    if (this.current) this.disposeCard(this.current);
    const card = (this.current = this.buildCard("drawn", face));
    this.setOnTop(card);
    const top = this.deck.getChildren()[DECK_SIZE - 1] as TransformNode;
    const start = top.getAbsolutePosition().add(new Vector3(0, THICK, 0));
    const startQ = Quaternion.RotationAxis(Vector3.Up(), this.deck.rotation.y).multiply(FACE_DOWN);
    card.position.copyFrom(start);
    card.rotationQuaternion = startQ.clone();
    card.scaling.setAll(1);

    // 1) Lompat dari tumpukan & terbang ke depan kamera (punggung menghadap kamera), berputar
    cardSfx.slide();
    cardSfx.flutter(0.65 / Speed.factor);
    await tween(
      this.scene,
      0.7,
      (t) => {
        const end = inFrontOfCamera(this.camera, viewDistance(this.scene, this.camera, 6, 1.9));
        const p = Vector3.Lerp(start, end, Ease.inOutQuad(t));
        p.y += Math.sin(t * Math.PI) * 1.2;
        card.position.copyFrom(p);
        const backToCam = cameraFacing(this.camera).multiply(Quaternion.RotationAxis(Vector3.Up(), Math.PI));
        const spin = Quaternion.RotationAxis(Vector3.Forward(), (1 - Ease.outQuad(t)) * Math.PI * 2);
        card.rotationQuaternion = Quaternion.Slerp(startQ, backToCam, Ease.outQuad(t)).multiply(spin);
        card.scaling.setAll(lerp(1, 1.1, t));
      },
      Ease.linear,
    );

    // 2) Balik kartu dengan efek "pop", lalu denting saat muka kartu terlihat
    cardSfx.flip();
    // Muka kartu mulai terlihat sekitar separuh animasi balik
    setTimeout(() => cardSfx.reveal(face.kind), 220 / Speed.factor);
    await tween(
      this.scene,
      0.5,
      (t) => {
        card.position.copyFrom(inFrontOfCamera(this.camera, viewDistance(this.scene, this.camera, 6, 1.9)));
        const ang = lerp(Math.PI, 0, Ease.outBack(t));
        card.rotationQuaternion = cameraFacing(this.camera).multiply(Quaternion.RotationAxis(Vector3.Up(), ang));
        card.scaling.setAll(1.1 + Math.sin(t * Math.PI) * 0.18);
      },
      Ease.linear,
    );
    this.holdInView(card);
  }

  private holdObs: ReturnType<Scene["onBeforeRenderObservable"]["add"]> | null = null;

  /** Kartu "melayang" lembut mengikuti kamera selama dibaca. */
  private holdInView(card: TransformNode) {
    this.stopHold();
    let t = 0;
    this.holdObs = this.scene.onBeforeRenderObservable.add(() => {
      t += this.scene.getEngine().getDeltaTime() / 1000;
      card.position.copyFrom(inFrontOfCamera(this.camera, viewDistance(this.scene, this.camera, 6, 1.9), 0.35 + Math.sin(t * 2.2) * 0.05));
      card.rotationQuaternion = cameraFacing(this.camera).multiply(Quaternion.RotationAxis(Vector3.Forward(), Math.sin(t * 1.7) * 0.04));
    });
  }

  private stopHold() {
    if (this.holdObs) this.scene.onBeforeRenderObservable.remove(this.holdObs);
    this.holdObs = null;
  }

  /**
   * Singkirkan kartu yang sedang tampil.
   * `to` diisi (posisi pion) → kartu mengecil masuk ke pion (kartu simpanan masuk kantong).
   * Tanpa `to` → kartu berputar terbang ke atas dan menghilang.
   */
  async dismiss(to?: Vector3) {
    const card = this.current;
    if (!card) return;
    this.stopHold();
    this.current = null;
    const start = card.position.clone();
    const q0 = card.rotationQuaternion!.clone();
    const s0 = card.scaling.x;
    if (to) {
      cardSfx.pocket(0.55 / Speed.factor);
      const end = to.add(new Vector3(0, 1.6, 0));
      await tween(this.scene, 0.55, (t) => {
        const p = Vector3.Lerp(start, end, Ease.inOutQuad(t));
        p.y += Math.sin(t * Math.PI) * 1.2;
        card.position.copyFrom(p);
        card.rotationQuaternion = q0.multiply(Quaternion.RotationAxis(Vector3.Up(), t * Math.PI * 4));
        card.scaling.setAll(lerp(s0, 0.05, Ease.inOutQuad(t)));
      });
    } else {
      cardSfx.vanish();
      await tween(this.scene, 0.45, (t) => {
        card.position.copyFrom(start.add(new Vector3(0, Ease.inOutQuad(t) * 3, 0)));
        card.rotationQuaternion = q0.multiply(Quaternion.RotationAxis(Vector3.Forward(), t * Math.PI * 3));
        card.scaling.setAll(lerp(s0, 0.01, Ease.inOutQuad(t)));
      });
    }
    this.disposeCard(card);
  }

  /** Kartu simpanan dipakai: muncul di atas pion pemakai, lalu dilempar melengkung ke sasaran. */
  async throwItem(face: CardFace, from: Vector3, to: Vector3) {
    const card = this.buildCard("thrown", face);
    this.setOnTop(card);
    const a = from.add(new Vector3(0, 2.2, 0));
    const b = to.add(new Vector3(0, 0.9, 0));
    card.position.copyFrom(a);

    // Muncul & tunjukkan muka kartu ke kamera
    cardSfx.appear();
    await tween(this.scene, 0.45, (t) => {
      card.position.copyFrom(a);
      card.rotationQuaternion = cameraFacing(this.camera).multiply(Quaternion.RotationAxis(Vector3.Up(), lerp(Math.PI, 0, Ease.outBack(t))));
      card.scaling.setAll(lerp(0.1, 1.2, Ease.outBack(t)));
    });
    await tween(this.scene, 0.35, () => {
      card.rotationQuaternion = cameraFacing(this.camera);
    });
    // Lempar melengkung sambil berputar seperti frisbee
    const q0 = cameraFacing(this.camera);
    const dist = Vector3.Distance(a, b);
    cardSfx.whirl(0.6 / Speed.factor);
    await tween(this.scene, 0.6, (t) => {
      const p = Vector3.Lerp(a, b, t);
      p.y += Math.sin(t * Math.PI) * Math.min(4, 1 + dist * 0.25);
      card.position.copyFrom(p);
      card.rotationQuaternion = q0.multiply(Quaternion.RotationAxis(Vector3.Forward(), t * Math.PI * 6));
      card.scaling.setAll(lerp(1.2, 0.5, t));
    });
    cardSfx.hit();
    this.disposeCard(card);
  }
}

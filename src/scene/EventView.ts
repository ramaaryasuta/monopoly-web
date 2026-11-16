import {
  Color3,
  DynamicTexture,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type ArcRotateCamera,
  type Mesh,
  type Observer,
  type Scene,
} from "@babylonjs/core";
import { cameraFacing, inFrontOfCamera, roundRect, unlitMaterial, viewDistance, wrapText } from "./screenSpace";
import { FONT } from "./tileArt";
import { toon } from "./toon";
import { tvSfx } from "./sfx";
import { Ease, lerp, Speed, tween } from "./tween";
import { Lang } from "../lang/id";

export interface EventScreen {
  icon: string;
  headline: string;
  text: string;
  /** Baris tambahan, mis. "Yang kena: Jago". */
  sub?: string;
  /** "event" = berita heboh (TV merah), "season" = event musiman (TV biru). */
  kind: "event" | "season";
  /** Suara khas yang diputar setelah jingle, menggantikan bunyi sirene (dipakai event musiman). */
  sting?: () => void;
}

/** Ukuran TV (unit dunia). Muka TV menghadap -z lokal. */
const TV_W = 3;
const TV_H = 2.2;
const TV_D = 1.1;
const SCR_W = 2.15;
const SCR_H = 1.62;
const SCR_X = -0.32;
/** Resolusi tekstur layar. */
const SW = 1024;
const SH = Math.round((SW * SCR_H) / SCR_W);
const EMOJI_FONT = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";

/** TV kartun berita heboh: jatuh dari langit, layar menyala, sirene berkedip, lalu dimatikan. */
export class EventView {
  private tv: TransformNode | null = null;
  private screen: Mesh | null = null;
  private holdObs: Observer<Scene> | null = null;

  constructor(
    private scene: Scene,
    private camera: ArcRotateCamera,
  ) {}

  // ------------------------------------------------------------------ layar

  private drawScreen(e: EventScreen) {
    const tex = new DynamicTexture("tvScreenTex", { width: SW, height: SH }, this.scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    const season = e.kind === "season";

    // Latar studio berita
    const g = ctx.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, season ? "#1b4f9c" : "#3a1460");
    g.addColorStop(1, season ? "#0d2a5c" : "#1a0a33");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SW, SH);
    // Sinar dari tengah
    ctx.save();
    ctx.translate(SW * 0.22, SH * 0.52);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(900, -70);
      ctx.lineTo(900, 70);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Pita judul atas
    ctx.fillStyle = season ? "#36c6ff" : "#ff2e4d";
    ctx.fillRect(0, 34, SW, 92);
    ctx.fillStyle = "#ffe14d";
    ctx.fillRect(0, 126, SW, 10);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `bold 58px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(season ? Lang.scene3d.seasonTag : Lang.scene3d.newsTag, 40, 82);
    // Lencana LIVE
    roundRect(ctx, SW - 190, 52, 150, 60, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = "#ff2e4d";
    ctx.beginPath();
    ctx.arc(SW - 160, 82, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText(Lang.scene3d.live, SW - 138, 84);

    // Ikon besar di kiri
    ctx.beginPath();
    ctx.arc(225, 395, 160, 0, Math.PI * 2);
    ctx.fillStyle = "#fffbe6";
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#2b1d3a";
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = `190px ${EMOJI_FONT}`;
    ctx.fillStyle = "#000";
    ctx.fillText(e.icon, 225, 408);

    // Judul berita
    const left = 425;
    const maxW = SW - left - 40;
    ctx.textAlign = "left";
    ctx.font = `bold 72px ${FONT}`;
    ctx.lineJoin = "round";
    let y = 230;
    for (const l of wrapText(ctx, e.headline, maxW).slice(0, 2)) {
      ctx.lineWidth = 14;
      ctx.strokeStyle = "#2b1d3a";
      ctx.strokeText(l, left, y);
      ctx.fillStyle = "#ffe14d";
      ctx.fillText(l, left, y);
      y += 80;
    }
    // Isi berita
    ctx.font = `600 40px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    y += 6;
    for (const l of wrapText(ctx, e.text, maxW).slice(0, 4)) {
      ctx.fillText(l, left, y);
      y += 50;
    }
    if (e.sub) {
      ctx.font = `bold 40px ${FONT}`;
      const w = Math.min(maxW, ctx.measureText(e.sub).width + 40);
      roundRect(ctx, left - 6, y - 4, w, 58, 16);
      ctx.fillStyle = "#ff5fa2";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(e.sub, left + 14, y + 26);
    }

    // Teks berjalan di bawah
    ctx.fillStyle = "#ffe14d";
    ctx.fillRect(0, SH - 90, SW, 90);
    ctx.fillStyle = "#2b1d3a";
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText(Lang.scene3d.ticker(e.headline.toUpperCase()), 30, SH - 44);

    // Garis scanline tipis ala TV jadul
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let sy = 0; sy < SH; sy += 6) ctx.fillRect(0, sy, SW, 2);
    tex.update();
    return tex;
  }

  // ------------------------------------------------------------------ model

  private build(e: EventScreen): TransformNode {
    const s = this.scene;
    const season = e.kind === "season";
    const root = new TransformNode("newsTv", s);
    const add = (m: AbstractMesh) => {
      m.parent = root;
      m.renderingGroupId = 1; // selalu di atas papan
      return m;
    };

    const shell = add(MeshBuilder.CreateBox("tvBody", { width: TV_W, height: TV_H, depth: TV_D }, s));
    shell.material = toon(s, season ? "#36a3ff" : "#ff5f6d");
    // Bingkai layar gelap sedikit menonjol
    const bezel = add(MeshBuilder.CreateBox("tvBezel", { width: SCR_W + 0.18, height: SCR_H + 0.18, depth: 0.08 }, s));
    bezel.position.set(SCR_X, 0, -TV_D / 2 - 0.03);
    bezel.material = toon(s, "#2b1d3a");

    const screen = add(MeshBuilder.CreatePlane("tvScreen", { width: SCR_W, height: SCR_H }, s)) as Mesh;
    screen.position.set(SCR_X, 0, -TV_D / 2 - 0.075);
    screen.material = unlitMaterial(s, "tvScreenMat", this.drawScreen(e));
    screen.scaling.y = 0.02;
    this.screen = screen;

    // Kenop & speaker di panel kanan
    const panelX = TV_W / 2 - 0.36;
    for (const [i, y] of [0.45, -0.05].entries()) {
      const knob = add(MeshBuilder.CreateCylinder(`tvKnob${i}`, { diameter: 0.34, height: 0.12, tessellation: 16 }, s));
      knob.rotation.x = Math.PI / 2;
      knob.position.set(panelX, y, -TV_D / 2 - 0.05);
      knob.material = toon(s, i === 0 ? "#ffe14d" : "#fffbe6");
    }
    for (let i = 0; i < 3; i++) {
      const slot = add(MeshBuilder.CreateBox(`tvSpk${i}`, { width: 0.38, height: 0.06, depth: 0.04 }, s));
      slot.position.set(panelX, -0.45 - i * 0.14, -TV_D / 2 - 0.02);
      slot.material = toon(s, "#2b1d3a");
    }
    // Kaki
    for (const sx of [-1, 1]) {
      const leg = add(MeshBuilder.CreateCylinder(`tvLeg${sx}`, { diameterTop: 0.14, diameterBottom: 0.08, height: 0.5 }, s));
      leg.position.set(sx * (TV_W / 2 - 0.45), -TV_H / 2 - 0.2, 0);
      leg.rotation.z = sx * 0.3;
      leg.material = toon(s, "#2b1d3a");
    }
    // Antena V dengan bola di ujung
    const antenna = new TransformNode("tvAntenna", s);
    antenna.parent = root;
    antenna.position.set(0, TV_H / 2, 0);
    for (const sx of [-1, 1]) {
      const rod = add(MeshBuilder.CreateCylinder(`tvRod${sx}`, { diameter: 0.06, height: 1.1 }, s));
      rod.parent = antenna;
      rod.rotation.z = sx * -0.5;
      rod.position.set(sx * 0.26, 0.48, 0);
      const ball = add(MeshBuilder.CreateSphere(`tvBall${sx}`, { diameter: 0.2 }, s));
      ball.parent = antenna;
      ball.position.set(sx * 0.53, 0.97, 0);
      ball.material = toon(s, "#ffe14d");
    }
    // Lampu sirene di dua pojok atas
    const sirens: StandardMaterial[] = [];
    for (const [i, sx] of [-1, 1].entries()) {
      const base = add(MeshBuilder.CreateCylinder(`tvSirenBase${i}`, { diameter: 0.5, height: 0.12 }, s));
      base.position.set(sx * (TV_W / 2 - 0.35), TV_H / 2 + 0.06, 0);
      base.material = toon(s, "#2b1d3a");
      const dome = add(MeshBuilder.CreateSphere(`tvSiren${i}`, { diameter: 0.42, slice: 0.5 }, s));
      dome.position.set(sx * (TV_W / 2 - 0.35), TV_H / 2 + 0.12, 0);
      const m = new StandardMaterial(`tvSirenMat${i}`, s);
      m.disableLighting = true;
      m.emissiveColor = Color3.FromHexString(i === 0 ? "#ff2e4d" : "#2e8bff");
      dome.material = m;
      sirens.push(m);
    }
    root.metadata = { antenna, sirens };
    return root;
  }

  private dispose() {
    this.stopHold();
    if (!this.tv) return;
    for (const m of this.tv.getChildMeshes()) {
      const mat = m.material;
      // Material toon di-cache & dipakai bersama → hanya buang material milik TV
      if (mat instanceof StandardMaterial && mat.name.startsWith("tv")) {
        mat.emissiveTexture?.dispose();
        mat.dispose();
      }
    }
    this.tv.dispose();
    this.tv = null;
    this.screen = null;
  }

  private stopHold() {
    if (this.holdObs) this.scene.onBeforeRenderObservable.remove(this.holdObs);
    this.holdObs = null;
  }

  private dist() {
    return viewDistance(this.scene, this.camera, 9.5, TV_W);
  }

  /** Posisi & rotasi TV saat ditonton (sedikit di atas tengah layar). */
  private pose(extraUp = 0) {
    return {
      pos: inFrontOfCamera(this.camera, this.dist(), 0.25 + extraUp),
      rot: cameraFacing(this.camera),
    };
  }

  // ------------------------------------------------------------------ animasi

  /** TV jatuh dari langit, memantul, lalu layarnya menyala. Tetap tampil sampai `hide()`. */
  async show(e: EventScreen) {
    this.dispose();
    const tv = (this.tv = this.build(e));
    const { antenna, sirens } = tv.metadata as { antenna: TransformNode; sirens: StandardMaterial[] };
    const dropH = this.dist() * 0.8;

    // 1) Jatuh dari atas layar sambil miring, memantul saat "mendarat"
    tvSfx.fall(0.45 / Speed.factor);
    // Gedebuk tepat saat pertama menyentuh "lantai" (outBounce mencapai 1 di ~36% durasi)
    const thud = setTimeout(() => tvSfx.thud(), (0.75 * 0.36 * 1000) / Speed.factor);
    await tween(this.scene, 0.75, (t) => {
      const { pos, rot } = this.pose(lerp(dropH, 0, Ease.outBounce(t)));
      tv.position.copyFrom(pos);
      tv.rotationQuaternion = rot.multiply(Quaternion.RotationAxis(Vector3.Forward(), (1 - t) * 0.5));
    });
    // 2) Gepeng sebentar lalu kembali (squash & stretch)
    await tween(this.scene, 0.35, (t) => {
      const k = Math.sin(t * Math.PI) * (1 - t);
      tv.scaling.set(1 + k * 0.25, 1 - k * 0.3, 1);
      const { pos, rot } = this.pose();
      tv.position.copyFrom(pos);
      tv.rotationQuaternion = rot;
    });
    tv.scaling.setAll(1);

    // 3) Layar menyala ala TV tabung: garis tipis melebar
    clearTimeout(thud);
    const screen = this.screen!;
    tvSfx.powerOn();
    await tween(this.scene, 0.3, (t) => {
      screen.scaling.y = lerp(0.02, 1, Ease.outBack(t));
      screen.scaling.x = lerp(0.6, 1, Ease.outQuad(t));
    });

    tvSfx.jingle(e.kind);

    // 4) Tahan: sirene berkedip (dengan bunyi "wiu-wiu"), antena goyang, TV bergoyang pelan
    let time = 0;
    let lastOn: boolean | null = null;
    // Sirene (atau suara khas) mulai setelah jingle selesai supaya tidak bertabrakan
    const sirenFrom = 1.3;
    let stingPlayed = false;
    this.holdObs = this.scene.onBeforeRenderObservable.add(() => {
      time += this.scene.getEngine().getDeltaTime() / 1000;
      const { pos, rot } = this.pose(Math.abs(Math.sin(time * 6)) * 0.04);
      tv.position.copyFrom(pos);
      tv.rotationQuaternion = rot.multiply(Quaternion.RotationAxis(Vector3.Forward(), Math.sin(time * 3) * 0.035));
      antenna.rotation.z = Math.sin(time * 9) * 0.12;
      const on = Math.floor(time * 5) % 2 === 0;
      if (on !== lastOn) {
        lastOn = on;
        if (e.sting) {
          if (time > sirenFrom && !stingPlayed) {
            stingPlayed = true;
            e.sting();
          }
        } else if (time > sirenFrom && time < sirenFrom + 3) tvSfx.sirenBeep(on);
      }
      sirens[0].emissiveColor = Color3.FromHexString(on ? "#ff2e4d" : "#5c1020");
      sirens[1].emissiveColor = Color3.FromHexString(on ? "#10305c" : "#2e8bff");
    });
  }

  /** Layar mati ala TV tabung (menyusut jadi garis lalu titik), TV melompat turun & menghilang. */
  async hide() {
    const tv = this.tv;
    const screen = this.screen;
    if (!tv || !screen) return;
    this.stopHold();
    tvSfx.powerOff();
    await tween(this.scene, 0.18, (t) => (screen.scaling.y = lerp(1, 0.02, Ease.inOutQuad(t))));
    await tween(this.scene, 0.14, (t) => (screen.scaling.x = lerp(1, 0.01, Ease.inOutQuad(t))));
    const p0 = tv.position.clone();
    const q0 = tv.rotationQuaternion!.clone();
    tvSfx.whoosh();
    await tween(this.scene, 0.4, (t) => {
      tv.position.copyFrom(p0.add(new Vector3(0, Math.sin(t * Math.PI) * 0.8 - t * t * 4, 0)));
      tv.rotationQuaternion = q0.multiply(Quaternion.RotationAxis(Vector3.Forward(), t * 1.2));
      tv.scaling.setAll(lerp(1, 0.01, Ease.inOutQuad(t)));
    });
    this.dispose();
  }
}

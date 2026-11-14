import { MeshBuilder, TransformNode, Vector3, type Mesh, type Scene, type ShadowGenerator } from "@babylonjs/core";
import { outline, toon } from "./toon";
import { Ease, lerp, tween } from "./tween";

export type CritterKind = "cat" | "bunny" | "bear" | "frog";

export const CRITTERS: { kind: CritterKind; label: string; color: string }[] = [
  { kind: "cat", label: "Kiko si Kucing", color: "#ff6b9a" },
  { kind: "bunny", label: "Momo si Kelinci", color: "#5bb8ff" },
  { kind: "bear", label: "Bubu si Beruang", color: "#ffa53d" },
  { kind: "frog", label: "Pipo si Katak", color: "#5fd35f" },
];

/** Pion karakter lucu prosedural (original) dengan animasi lompat squash & stretch. */
export class Pawn {
  readonly root: TransformNode;
  /** Node untuk squash/stretch (pivot di kaki). */
  private body: TransformNode;
  private idleTime = Math.random() * 10;
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

    const meshes: Mesh[] = [];
    const part = (m: Mesh, hex: string, outlineW = 0.03) => {
      m.material = toon(scene, hex);
      m.parent = this.body;
      outline(m, outlineW);
      meshes.push(m);
      return m;
    };
    const light = lighten(color, 0.55);

    // Badan
    const torso = part(MeshBuilder.CreateSphere("torso", { diameter: 0.75, segments: 16 }, scene), color);
    torso.scaling.set(1, 0.95, 0.9);
    torso.position.y = 0.4;
    const belly = part(MeshBuilder.CreateSphere("belly", { diameter: 0.5, segments: 12 }, scene), light, 0);
    belly.position.set(0, 0.36, 0.22);
    belly.scaling.z = 0.5;

    // Kaki
    for (const sx of [-0.18, 0.18]) {
      const foot = part(MeshBuilder.CreateSphere("foot", { diameter: 0.26, segments: 10 }, scene), color);
      foot.scaling.set(1, 0.6, 1.3);
      foot.position.set(sx, 0.07, 0.05);
    }

    // Kepala
    const head = part(MeshBuilder.CreateSphere("head", { diameter: 0.78, segments: 16 }, scene), color);
    head.position.y = 0.98;
    const muzzle = part(MeshBuilder.CreateSphere("muzzle", { diameter: 0.34, segments: 10 }, scene), light, 0);
    muzzle.position.set(0, 0.88, 0.31);
    muzzle.scaling.set(1.2, 0.8, 0.6);

    // Mata besar ala kartun
    for (const sx of [-0.15, 0.15]) {
      const eye = part(MeshBuilder.CreateSphere("eye", { diameter: 0.2, segments: 10 }, scene), "#ffffff", 0.015);
      eye.position.set(sx, 1.05, 0.31);
      eye.scaling.set(0.85, 1.15, 0.6);
      const pupil = part(MeshBuilder.CreateSphere("pupil", { diameter: 0.11, segments: 8 }, scene), "#2b1d3a", 0);
      pupil.position.set(sx, 1.04, 0.37);
      pupil.scaling.z = 0.5;
      const shine = part(MeshBuilder.CreateSphere("shine", { diameter: 0.04, segments: 6 }, scene), "#ffffff", 0);
      shine.position.set(sx + 0.025, 1.07, 0.4);
    }
    // Pipi merona
    for (const sx of [-0.25, 0.25]) {
      const cheek = part(MeshBuilder.CreateSphere("cheek", { diameter: 0.12, segments: 8 }, scene), "#ff9ab8", 0);
      cheek.position.set(sx, 0.9, 0.29);
      cheek.scaling.z = 0.3;
    }

    // Ciri khas tiap karakter
    switch (kind) {
      case "cat":
        for (const sx of [-0.22, 0.22]) {
          const ear = part(MeshBuilder.CreateCylinder("ear", { diameterTop: 0, diameterBottom: 0.26, height: 0.3, tessellation: 4 }, scene), color);
          ear.position.set(sx, 1.38, 0);
          ear.rotation.z = -sx * 1.2;
        }
        {
          const tail = part(MeshBuilder.CreateCylinder("tail", { diameterTop: 0.08, diameterBottom: 0.12, height: 0.6 }, scene), color);
          tail.position.set(0, 0.55, -0.42);
          tail.rotation.x = -0.8;
        }
        break;
      case "bunny":
        for (const sx of [-0.13, 0.13]) {
          const ear = part(MeshBuilder.CreateCapsule("ear", { radius: 0.09, height: 0.65 }, scene), color);
          ear.position.set(sx, 1.55, -0.02);
          ear.rotation.z = -sx * 1.1;
          const inner = part(MeshBuilder.CreateCapsule("earIn", { radius: 0.05, height: 0.45 }, scene), "#ffc2d6", 0);
          inner.position.set(sx, 1.55, 0.05);
          inner.rotation.z = -sx * 1.1;
        }
        {
          const tail = part(MeshBuilder.CreateSphere("tail", { diameter: 0.25, segments: 8 }, scene), "#ffffff");
          tail.position.set(0, 0.3, -0.38);
        }
        break;
      case "bear":
        for (const sx of [-0.27, 0.27]) {
          const ear = part(MeshBuilder.CreateSphere("ear", { diameter: 0.26, segments: 10 }, scene), color);
          ear.position.set(sx, 1.3, -0.02);
          ear.scaling.z = 0.6;
        }
        {
          const nose = part(MeshBuilder.CreateSphere("nose", { diameter: 0.1, segments: 8 }, scene), "#2b1d3a", 0);
          nose.position.set(0, 0.93, 0.42);
        }
        break;
      case "frog":
        for (const sx of [-0.2, 0.2]) {
          const bump = part(MeshBuilder.CreateSphere("eyeBump", { diameter: 0.3, segments: 10 }, scene), color);
          bump.position.set(sx, 1.3, 0.12);
        }
        {
          const crown = part(MeshBuilder.CreateCylinder("crown", { diameterTop: 0.34, diameterBottom: 0.28, height: 0.16, tessellation: 5 }, scene), "#ffd23f");
          crown.position.set(0, 1.42, -0.1);
        }
        break;
    }

    for (const m of meshes) shadows.addShadowCaster(m);

    // Idle: bernapas pelan
    scene.onBeforeRenderObservable.add(() => {
      if (this.busy) return;
      this.idleTime += scene.getEngine().getDeltaTime() / 1000;
      const s = Math.sin(this.idleTime * 3) * 0.03;
      this.body.scaling.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);
    });
  }

  setPosition(p: Vector3) {
    this.root.position.copyFrom(p);
  }

  faceTowards(target: Vector3) {
    const d = target.subtract(this.root.position);
    if (d.lengthSquared() < 1e-4) return;
    this.root.rotation.y = Math.atan2(d.x, d.z);
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
    await this.squash(0.22, 0.09);
    this.busy = false;
  }

  /** Terbang melengkung tinggi (Wisata Dunia / kartu). */
  async flyTo(target: Vector3) {
    this.busy = true;
    const from = this.root.position.clone();
    this.faceTowards(target);
    await this.squash(0.3, 0.15);
    const spin = this.root.rotation.y;
    await tween(
      this.scene,
      1.1,
      (t) => {
        this.root.position.x = lerp(from.x, target.x, t);
        this.root.position.z = lerp(from.z, target.z, t);
        this.root.position.y = lerp(from.y, target.y, t) + Math.sin(t * Math.PI) * 7;
        this.root.rotation.y = spin + t * Math.PI * 4;
      },
      Ease.inOutQuad,
    );
    this.root.rotation.y = spin;
    await this.squash(0.3, 0.15);
    this.busy = false;
  }

  /** Lompat senang di tempat. */
  async cheer() {
    const base = this.root.position.y;
    for (let i = 0; i < 2; i++) {
      await tween(this.scene, 0.25, (t) => (this.root.position.y = base + Math.sin(t * Math.PI) * 0.6));
    }
  }

  /** Sedih: menunduk & mengecil (bangkrut). */
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
    return this.root.position.add(new Vector3(0, 1.8, 0));
  }
}

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (c: number) => Math.round(c + (255 - c) * amt);
  return `#${((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1)}`;
}

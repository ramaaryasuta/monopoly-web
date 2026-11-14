import {
  Color3,
  DynamicTexture,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Vector3,
  Vector4,
  VertexBuffer,
  type Mesh,
  type Scene,
  type ShadowGenerator,
} from "@babylonjs/core";
import { outline } from "./toon";
import { Ease, lerp, tween } from "./tween";

/** Nilai per face box (pasangan berlawanan berjumlah 7). */
const FACE_VALUES = [1, 6, 2, 5, 3, 4];

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};

export class Dice {
  private dice: Mesh[] = [];
  /** Normal lokal per face, dibaca langsung dari geometri box agar akurat. */
  private faceNormals: Vector3[] = [];

  constructor(
    private scene: Scene,
    shadows: ShadowGenerator,
  ) {
    const tex = this.makeAtlas();
    const mat = new StandardMaterial("diceMat", scene);
    mat.diffuseTexture = tex;
    mat.emissiveColor = new Color3(0.35, 0.35, 0.35);
    mat.specularColor = new Color3(0.2, 0.2, 0.2);

    const faceUV = FACE_VALUES.map((v) => new Vector4((v - 1) / 6, 0, v / 6, 1));
    for (let i = 0; i < 2; i++) {
      const d = MeshBuilder.CreateBox(`die${i}`, { size: 1.1, faceUV, wrap: true }, scene);
      d.material = mat;
      outline(d, 0.035);
      d.rotationQuaternion = Quaternion.Identity();
      d.position.set(i === 0 ? -0.9 : 0.9, 0.75, 0);
      shadows.addShadowCaster(d);
      this.dice.push(d);
    }

    const normals = this.dice[0].getVerticesData(VertexBuffer.NormalKind)!;
    for (let f = 0; f < 6; f++) {
      const o = f * 4 * 3;
      this.faceNormals.push(new Vector3(normals[o], normals[o + 1], normals[o + 2]).normalize());
    }
    this.dice.forEach((d, i) => (d.rotationQuaternion = this.orientationFor(i === 0 ? 1 : 6, 0.3)));
  }

  private makeAtlas() {
    const cell = 128;
    const tex = new DynamicTexture("diceAtlas", { width: cell * 6, height: cell }, this.scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    for (let v = 1; v <= 6; v++) {
      const x0 = (v - 1) * cell;
      ctx.fillStyle = "#fffdf5";
      ctx.fillRect(x0, 0, cell, cell);
      ctx.strokeStyle = "#e8dcc8";
      ctx.lineWidth = 10;
      ctx.strokeRect(x0 + 5, 5, cell - 10, cell - 10);
      ctx.fillStyle = v === 1 ? "#ff4d6d" : "#2b1d3a";
      for (const [px, py] of PIPS[v]) {
        ctx.beginPath();
        ctx.arc(x0 + px * cell, py * cell, v === 1 ? 17 : 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    tex.update();
    return tex;
  }

  /** Quaternion yang membuat face bernilai `value` menghadap atas, dengan yaw tertentu. */
  private orientationFor(value: number, yaw: number): Quaternion {
    const face = FACE_VALUES.indexOf(value);
    const n = this.faceNormals[face];
    const align = new Quaternion();
    Quaternion.FromUnitVectorsToRef(n, Vector3.Up(), align);
    const yawQ = Quaternion.RotationAxis(Vector3.Up(), yaw);
    // Urutan perkalian quaternion rawan salah; pilih yang benar-benar membuat face menghadap atas.
    const a = yawQ.multiply(align);
    if (n.applyRotationQuaternion(a).y > 0.99) return a;
    return align.multiply(yawQ);
  }

  /** Lempar dadu dari langit, berputar, memantul, lalu mendarat menunjukkan d1 & d2. */
  async roll(d1: number, d2: number, center: Vector3) {
    const values = [d1, d2];
    await Promise.all(
      this.dice.map((die, i) => {
        const finalQ = this.orientationFor(values[i], Math.random() * Math.PI * 2);
        const axis = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const turns = 3 + Math.random() * 2;
        const start = center.add(new Vector3(i === 0 ? -3 : 3, 8, -2 + Math.random()));
        const end = center.add(new Vector3(i === 0 ? -0.8 : 0.8, 0.55, Math.random() * 0.6 - 0.3));
        return tween(
          this.scene,
          1.15,
          (t) => {
            die.position.x = lerp(start.x, end.x, Ease.outQuad(t));
            die.position.z = lerp(start.z, end.z, Ease.outQuad(t));
            die.position.y = lerp(start.y, end.y, Ease.outBounce(t));
            const spin = Quaternion.RotationAxis(axis, (1 - t) ** 2 * turns * Math.PI * 2);
            die.rotationQuaternion = finalQ.multiply(spin);
          },
          Ease.linear,
        );
      }),
    );
  }
}

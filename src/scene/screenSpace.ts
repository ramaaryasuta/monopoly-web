import {
  Color3,
  Matrix,
  Quaternion,
  StandardMaterial,
  Vector3,
  type ArcRotateCamera,
  type DynamicTexture,
  type Scene,
} from "@babylonjs/core";

/** Helper untuk objek 3D yang tampil "di depan kamera" (kartu, TV berita). */

/**
 * Material tanpa pencahayaan: warna murni dari tekstur emissive supaya tulisan selalu terbaca.
 * (Dengan disableLighting, diffuse tidak berkontribusi; emissiveColor dijumlahkan ke tekstur → harus hitam.)
 */
export function unlitMaterial(scene: Scene, name: string, tex: DynamicTexture) {
  const m = new StandardMaterial(name, scene);
  m.emissiveTexture = tex;
  m.emissiveColor = Color3.Black();
  m.diffuseColor = Color3.Black();
  m.disableLighting = true;
  m.specularColor = Color3.Black();
  return m;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Rotasi dunia kamera (+z lokal = arah pandang). Objek dengan rotasi ini → sisi -z menghadap kamera. */
export function cameraFacing(camera: ArcRotateCamera): Quaternion {
  const q = new Quaternion();
  Matrix.Invert(camera.getViewMatrix()).decompose(undefined, q);
  return q;
}

/**
 * Jarak dari kamera untuk objek selebar `width`: biasanya `base`, tapi di layar sempit (HP tegak)
 * dijauhkan secukupnya agar objek memakai ±80% lebar layar.
 */
export function viewDistance(scene: Scene, camera: ArcRotateCamera, base = 6, width = 1.5) {
  const aspect = scene.getEngine().getAspectRatio(camera);
  const visibleWidthPerUnit = 2 * Math.tan(camera.fov / 2) * aspect;
  return Math.max(base, width / (0.8 * visibleWidthPerUnit));
}

/** Titik di depan kamera, sedikit ke atas (`up`) agar tidak tertutup lembaran tombol di bawah. */
export function inFrontOfCamera(camera: ArcRotateCamera, dist: number, up = 0.35): Vector3 {
  const fwd = camera.target.subtract(camera.position).normalize();
  const right = Vector3.Cross(Vector3.Up(), fwd).normalize();
  const camUp = Vector3.Cross(fwd, right).normalize();
  return camera.position.add(fwd.scale(dist)).add(camUp.scale(up));
}

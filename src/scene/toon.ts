import { Color3, type AbstractMesh, type Scene } from "@babylonjs/core";
import { CellMaterial } from "@babylonjs/materials/cell";

const cache = new Map<string, CellMaterial>();

/** Material toon (cel-shading) dengan cache per warna. */
export function toon(scene: Scene, hex: string): CellMaterial {
  const key = hex.toLowerCase();
  let m = cache.get(key);
  if (!m || m.getScene() !== scene) {
    m = new CellMaterial(`toon_${key}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.computeHighLevel = true;
    cache.set(key, m);
  }
  return m;
}

export const OUTLINE_COLOR = Color3.FromHexString("#2b1d3a");

/** Tambah outline kartun ke mesh. */
export function outline(mesh: AbstractMesh, width = 0.04) {
  mesh.renderOutline = true;
  mesh.outlineColor = OUTLINE_COLOR;
  mesh.outlineWidth = width;
  return mesh;
}

export function clearToonCache() {
  cache.clear();
}

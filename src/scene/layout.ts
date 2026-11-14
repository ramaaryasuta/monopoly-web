import { Vector3 } from "@babylonjs/core";

/** Ukuran satu petak (unit dunia). */
export const TILE = 2.4;
export const HALF = 4; // papan 9x9, koordinat grid -4..4
export const TILE_HEIGHT = 0.5;
export const TILE_TOP = TILE_HEIGHT;

/** Koordinat grid (x, z) dari indeks petak. Petak 0 di kanan-bawah, berjalan searah jarum jam dilihat dari atas. */
export function gridOf(index: number): { x: number; z: number } {
  const side = Math.floor(index / 8);
  const k = index % 8;
  switch (side) {
    case 0:
      return { x: HALF - k, z: -HALF };
    case 1:
      return { x: -HALF, z: -HALF + k };
    case 2:
      return { x: -HALF + k, z: HALF };
    default:
      return { x: HALF, z: HALF - k };
  }
}

export function tilePosition(index: number, y = TILE_TOP): Vector3 {
  const g = gridOf(index);
  return new Vector3(g.x * TILE, y, g.z * TILE);
}

/** Arah "ke dalam" papan (menuju pusat) untuk petak non-sudut. */
export function inwardDir(index: number): Vector3 {
  const side = Math.floor(index / 8);
  const k = index % 8;
  if (k === 0) {
    const p = tilePosition(index, 0);
    return new Vector3(-Math.sign(p.x), 0, -Math.sign(p.z)).normalize();
  }
  return [new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), new Vector3(-1, 0, 0)][side];
}

/** Rotasi Y supaya label petak terbaca dari luar papan (sisi luar = bawah teks). */
export function tileYaw(index: number): number {
  const side = Math.floor(index / 8);
  return [0, Math.PI / 2, Math.PI, -Math.PI / 2][side];
}

/** Offset slot pion supaya 4 pion bisa berdiri di satu petak. */
export function pawnSlot(index: number, slot: number): Vector3 {
  const base = tilePosition(index);
  const offs = [
    [-0.45, -0.45],
    [0.45, -0.45],
    [-0.45, 0.45],
    [0.45, 0.45],
  ][slot % 4];
  return base.add(new Vector3(offs[0], 0, offs[1]));
}

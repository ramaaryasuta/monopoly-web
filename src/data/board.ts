import type { TileDef } from "../core/types";
import { Lang } from "../lang/id";

/** Warna grup properti (gaya kartun, saturasi tinggi). */
export const GROUP_COLORS = [
  "#ff7ab6", // 0 permen
  "#ffb84d", // 1 jeruk
  "#ffe14d", // 2 lemon
  "#7ee06b", // 3 daun
  "#4dd6ff", // 4 langit
  "#5b8cff", // 5 laut
  "#b57aff", // 6 anggur
  "#ff5b5b", // 7 ceri
];

/** Nama grup warna (sesuai komentar GROUP_COLORS), untuk pengumuman set lengkap. */
export const GROUP_NAMES = Lang.board.groupNames;

const P = (index: number, name: string, group: number, price: number): TileDef => ({
  index,
  kind: "property",
  name,
  group,
  price,
});

/** Jumlah langkah per sisi papan (1 sudut + 9 petak lokasi). */
export const SIDE_LEN = 10;

/**
 * Papan 40 petak, searah jarum jam. Sudut: 0, 10, 20, 30.
 * Nama tempat bernuansa Indonesia (plesetan & tempat terkenal).
 */
export const BOARD: TileDef[] = [
  { index: 0, kind: "start", name: Lang.tiles[0] },
  P(1, Lang.tiles[1], 0, 50),
  { index: 2, kind: "resort", name: Lang.tiles[2], price: 200 },
  P(3, Lang.tiles[3], 0, 50),
  P(4, Lang.tiles[4], 0, 70),
  P(5, Lang.tiles[5], 0, 70),
  { index: 6, kind: "chance", name: Lang.tiles[6] },
  P(7, Lang.tiles[7], 1, 90),
  P(8, Lang.tiles[8], 1, 110),
  P(9, Lang.tiles[9], 1, 110),

  { index: 10, kind: "island", name: Lang.tiles[10] },
  P(11, Lang.tiles[11], 2, 130),
  P(12, Lang.tiles[12], 2, 130),
  { index: 13, kind: "chance", name: Lang.tiles[13] },
  P(14, Lang.tiles[14], 2, 140),
  P(15, Lang.tiles[15], 2, 140),
  { index: 16, kind: "resort", name: Lang.tiles[16], price: 200 },
  P(17, Lang.tiles[17], 3, 160),
  P(18, Lang.tiles[18], 3, 180),
  P(19, Lang.tiles[19], 3, 180),

  { index: 20, kind: "festival", name: Lang.tiles[20] },
  P(21, Lang.tiles[21], 4, 200),
  { index: 22, kind: "chance", name: Lang.tiles[22] },
  P(23, Lang.tiles[23], 4, 200),
  P(24, Lang.tiles[24], 4, 220),
  P(25, Lang.tiles[25], 4, 220),
  { index: 26, kind: "resort", name: Lang.tiles[26], price: 200 },
  P(27, Lang.tiles[27], 5, 230),
  P(28, Lang.tiles[28], 5, 250),
  P(29, Lang.tiles[29], 5, 250),

  { index: 30, kind: "tour", name: Lang.tiles[30] },
  { index: 31, kind: "resort", name: Lang.tiles[31], price: 200 },
  P(32, Lang.tiles[32], 6, 270),
  P(33, Lang.tiles[33], 6, 290),
  P(34, Lang.tiles[34], 6, 290),
  { index: 35, kind: "chance", name: Lang.tiles[35] },
  { index: 36, kind: "tax", name: Lang.tiles[36] },
  P(37, Lang.tiles[37], 7, 320),
  P(38, Lang.tiles[38], 7, 340),
  P(39, Lang.tiles[39], 7, 360),
];

export const BOARD_SIZE = BOARD.length;
export const ISLAND_INDEX = SIDE_LEN;
export const FESTIVAL_INDEX = SIDE_LEN * 2;
export const TOUR_INDEX = SIDE_LEN * 3;

/** Indeks petak berdasarkan nama (untuk kartu "pergi ke ..."). */
export function tileIndexByName(name: string): number {
  const t = BOARD.find((b) => b.name === name);
  if (!t) throw new Error(Lang.board.tileNotFound(name));
  return t.index;
}

export function isCorner(index: number): boolean {
  return index % SIDE_LEN === 0;
}

/** Sisi papan (0..3) untuk petak non-sudut, null untuk sudut. */
export function sideOf(index: number): number | null {
  if (isCorner(index)) return null;
  return Math.floor(index / SIDE_LEN);
}

export const PROPERTY_GROUPS: number[][] = (() => {
  const groups: number[][] = [];
  for (const t of BOARD) {
    if (t.kind === "property" && t.group !== undefined) {
      (groups[t.group] ??= []).push(t.index);
    }
  }
  return groups;
})();

export const RESORTS = BOARD.filter((t) => t.kind === "resort").map((t) => t.index);

/** Properti (bukan resort) per sisi papan, untuk menang "monopoli garis". */
export const SIDE_PROPERTIES: number[][] = [0, 1, 2, 3].map((s) =>
  BOARD.filter((t) => (t.kind === "property" || t.kind === "resort") && sideOf(t.index) === s).map((t) => t.index),
);

import type { TileDef } from "../core/types";

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

const P = (index: number, name: string, group: number, price: number): TileDef => ({
  index,
  kind: "property",
  name,
  group,
  price,
});

/**
 * Papan 32 petak, searah jarum jam. Sudut: 0, 8, 16, 24.
 * Semua nama fiktif/original.
 */
export const BOARD: TileDef[] = [
  { index: 0, kind: "start", name: "Mulai" },
  P(1, "Desa Jamur", 0, 60),
  { index: 2, kind: "resort", name: "Pantai Kerang", price: 200 },
  P(3, "Bukit Permen", 0, 60),
  P(4, "Lembah Gula", 0, 80),
  { index: 5, kind: "chance", name: "Kotak Kejutan" },
  P(6, "Kebun Jeruk", 1, 100),
  P(7, "Kota Marmalade", 1, 120),

  { index: 8, kind: "island", name: "Pulau Terpencil" },
  P(9, "Dusun Lemon", 2, 140),
  P(10, "Taman Madu", 2, 140),
  { index: 11, kind: "chance", name: "Kotak Kejutan" },
  P(12, "Kota Pisang", 2, 160),
  { index: 13, kind: "resort", name: "Air Terjun Pelangi", price: 200 },
  P(14, "Hutan Daun", 3, 180),
  P(15, "Lembah Lumut", 3, 200),

  { index: 16, kind: "festival", name: "Festival Bintang" },
  P(17, "Kota Awan", 4, 220),
  { index: 18, kind: "chance", name: "Kotak Kejutan" },
  P(19, "Puncak Angin", 4, 220),
  P(20, "Menara Langit", 4, 240),
  { index: 21, kind: "resort", name: "Gunung Salju", price: 200 },
  P(22, "Teluk Biru", 5, 260),
  P(23, "Pelabuhan Ombak", 5, 280),

  { index: 24, kind: "tour", name: "Wisata Dunia" },
  { index: 25, kind: "resort", name: "Gua Kristal", price: 200 },
  P(26, "Kebun Anggur", 6, 300),
  P(27, "Istana Ungu", 6, 320),
  { index: 28, kind: "chance", name: "Kotak Kejutan" },
  { index: 29, kind: "tax", name: "Pajak Kerajaan" },
  P(30, "Kota Ceri", 7, 350),
  P(31, "Puri Merah", 7, 400),
];

export const BOARD_SIZE = BOARD.length;
export const ISLAND_INDEX = 8;
export const FESTIVAL_INDEX = 16;
export const TOUR_INDEX = 24;

/** Sisi papan (0..3) untuk petak non-sudut, null untuk sudut. */
export function sideOf(index: number): number | null {
  if (index % 8 === 0) return null;
  return Math.floor(index / 8);
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

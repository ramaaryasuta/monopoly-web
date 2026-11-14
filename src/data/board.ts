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
 * Nama tempat bernuansa Indonesia (plesetan & tempat terkenal).
 */
export const BOARD: TileDef[] = [
  { index: 0, kind: "start", name: "Mulai" },
  P(1, "Burjo SS Tembalang", 0, 60),
  { index: 2, kind: "resort", name: "Malioboro", price: 200 },
  P(3, "OTY Fried Chicken", 0, 60),
  P(4, "RM Pagi Sore", 0, 80),
  { index: 5, kind: "chance", name: "Paket Shopee" },
  P(6, "Rumah Ratapan Oslo", 1, 100),
  P(7, "Lawang Rongewu", 1, 120),

  { index: 8, kind: "island", name: "Nusakambangan" },
  P(9, "Polri", 2, 140),
  P(10, "Tugu Jogja", 2, 140),
  { index: 11, kind: "chance", name: "Paket Tokopedia" },
  P(12, "Buletan HI", 2, 160),
  { index: 13, kind: "resort", name: "Monas", price: 200 },
  P(14, "Jembatan Mahakam", 3, 180),
  P(15, "Bank Living by Sendiri", 3, 200),

  { index: 16, kind: "festival", name: "Pesta Pejabat" },
  P(17, "Kopi Kenangan", 4, 220),
  { index: 18, kind: "chance", name: "Paket Blibli" },
  P(19, "Telkom", 4, 220),
  P(20, "Pakuwon Mall", 4, 240),
  { index: 21, kind: "resort", name: "Wakatobi", price: 200 },
  P(22, "Tambang Nikel", 5, 260),
  P(23, "IKN", 5, 280),

  { index: 24, kind: "tour", name: "Naik Pesawat Negara" },
  { index: 25, kind: "resort", name: "Raja Ampat", price: 200 },
  P(26, "Jam Gadang", 6, 300),
  P(27, "Kantor KPK", 6, 320),
  { index: 28, kind: "chance", name: "Paket Lazada" },
  { index: 29, kind: "tax", name: "Uang Ormas" },
  P(30, "Gedung DPR", 7, 350),
  P(31, "Istana Presiden", 7, 400),
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

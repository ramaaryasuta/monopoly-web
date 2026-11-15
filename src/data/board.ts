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

/** Nama grup warna (sesuai komentar GROUP_COLORS), untuk pengumuman set lengkap. */
export const GROUP_NAMES = ["Permen", "Jeruk", "Lemon", "Daun", "Langit", "Laut", "Anggur", "Ceri"];

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
  { index: 0, kind: "start", name: "Mulai" },
  P(1, "Burjo SS Tembalang", 0, 50),
  { index: 2, kind: "resort", name: "Malioboro", price: 200 },
  P(3, "OTY Fried Chicken", 0, 50),
  P(4, "RM Pagi Sore", 0, 70),
  P(5, "Sei Indonesia", 0, 70),
  { index: 6, kind: "chance", name: "Paket Shopee" },
  P(7, "Rumah Ratapan Oslo", 1, 90),
  P(8, "Lawang Rongewu", 1, 110),
  P(9, "Lembang Park Zoo", 1, 110),

  { index: 10, kind: "island", name: "Nusakambangan" },
  P(11, "Polri", 2, 130),
  P(12, "Tugu Jogja", 2, 130),
  { index: 13, kind: "chance", name: "Paket Tokopedia" },
  P(14, "Buletan HI", 2, 140),
  P(15, "Gedung Sate", 2, 140),
  { index: 16, kind: "resort", name: "Monas", price: 200 },
  P(17, "Jembatan Mahakam", 3, 160),
  P(18, "Bank Living by Sendiri", 3, 180),
  P(19, "Karimun Jawa", 3, 180),

  { index: 20, kind: "festival", name: "Pesta Pejabat" },
  P(21, "Kopi Kenangan", 4, 200),
  { index: 22, kind: "chance", name: "Paket Blibli" },
  P(23, "Telkom", 4, 200),
  P(24, "Pakuwon Mall", 4, 220),
  P(25, "Sam Poo Kong", 4, 220),
  { index: 26, kind: "resort", name: "Wakatobi", price: 200 },
  P(27, "Tambang Nikel", 5, 230),
  P(28, "IKN", 5, 250),
  P(29, "Candi Prambanan", 5, 250),

  { index: 30, kind: "tour", name: "Naik Pesawat Negara" },
  { index: 31, kind: "resort", name: "Raja Ampat", price: 200 },
  P(32, "Jam Gadang", 6, 270),
  P(33, "Kantor KPK", 6, 290),
  P(34, "Candi Borobudur", 6, 290),
  { index: 35, kind: "chance", name: "Paket Lazada" },
  { index: 36, kind: "tax", name: "Uang Ormas" },
  P(37, "Gedung DPR", 7, 320),
  P(38, "Masjid Istiqlal", 7, 340),
  P(39, "Istana Presiden", 7, 360),
];

export const BOARD_SIZE = BOARD.length;
export const ISLAND_INDEX = SIDE_LEN;
export const FESTIVAL_INDEX = SIDE_LEN * 2;
export const TOUR_INDEX = SIDE_LEN * 3;

/** Indeks petak berdasarkan nama (untuk kartu "pergi ke ..."). */
export function tileIndexByName(name: string): number {
  const t = BOARD.find((b) => b.name === name);
  if (!t) throw new Error(`Petak tidak ada: ${name}`);
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

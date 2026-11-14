export type TileKind =
  | "start"
  | "property"
  | "resort"
  | "chance"
  | "tax"
  | "island" // penjara: Pulau Terpencil
  | "festival"
  | "tour"; // Wisata Dunia: teleport giliran berikutnya

export interface TileDef {
  index: number;
  kind: TileKind;
  name: string;
  /** Grup warna (hanya properti). */
  group?: number;
  /** Harga tanah (properti) atau harga beli (resort). */
  price?: number;
}

/**
 * Level bangunan properti:
 * 0 = belum dimiliki, 1 = tanah, 2 = rumah 1, 3 = rumah 2, 4 = vila, 5 = landmark
 */
export type BuildLevel = 0 | 1 | 2 | 3 | 4 | 5;
export const MAX_NORMAL_LEVEL = 4;
export const LANDMARK_LEVEL = 5;

export interface TileState {
  owner: number | null;
  level: BuildLevel;
  /** Pengali sewa dari festival. */
  festival: boolean;
}

export interface PlayerState {
  id: number;
  name: string;
  color: string;
  isBot: boolean;
  money: number;
  position: number;
  bankrupt: boolean;
  /** Sisa giliran terjebak di pulau (0 = bebas). */
  islandTurns: number;
  /** Akan memilih tujuan Wisata Dunia di giliran berikutnya. */
  pendingTour: boolean;
  /** Kartu pelindung: membebaskan sekali bayar sewa. */
  shields: number;
}

export type WinReason = "lastStanding" | "tripleMonopoly" | "lineMonopoly" | "resortMonopoly" | "roundLimit";

export interface GameState {
  tiles: TileState[];
  players: PlayerState[];
  current: number;
  round: number;
  festivalTile: number | null;
  winner: number | null;
  winReason: WinReason | null;
}

export interface PlayerSetup {
  name: string;
  color: string;
  isBot: boolean;
}

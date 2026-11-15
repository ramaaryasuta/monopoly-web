import { BOARD, PROPERTY_GROUPS, RESORTS, SIDE_PROPERTIES } from "../data/board";
import type { BuildLevel, GameState, PlayerSetup, WinReason } from "./types";

const ROUND_LIMIT = 62;

export const CONFIG = {
  startMoney: 300,
  salary: 350,
  islandTurns: 3,
  islandBail: 50,
  tourFee: 50,
  taxRate: 0.1,
  roundLimit: ROUND_LIMIT,
  /**
   * Event musiman Musim Turis (semua sewa x2) baru boleh muncul setelah 75% game berjalan
   * (ronde 47 dari 62), supaya sewa tidak meledak saat pemain masih punya sedikit uang dan aset.
   * Pesta Pejabat (efek petak) tidak dibatasi.
   */
  turisFromRound: Math.ceil(ROUND_LIMIT * 0.75),
  sellRate: 0.5,
  festivalMultiplier: 2,
  /** Sewa wisata = dasar x 2^(jumlah wisata dimiliki - 1): 30 / 60 / 120 / 240. */
  resortBaseRent: 30,
  /** Sewa = persentase nilai wilayah (total biaya tanah + bangunan yang sudah dikeluarkan). */
  rentRate: 0.65,
  /** Punya satu grup warna lengkap (set): sewa semua wilayah di set naik 30%. */
  setRentBonus: 0.3,
};

/** Biaya untuk naik KE level tertentu, sebagai pengali harga tanah. */
const LEVEL_COST_FACTOR = [0, 1, 0.5, 0.5, 0.75, 1.0];

export const LEVEL_NAMES = ["Kosong", "Tanah", "Rumah 1", "Rumah 2", "Vila", "Landmark"];

export function createGame(setups: PlayerSetup[]): GameState {
  if (setups.length < 2 || setups.length > 4) throw new Error("Jumlah pemain harus 2-4");
  return {
    tiles: BOARD.map(() => ({ owner: null, level: 0, festival: false })),
    players: setups.map((s, id) => ({
      id,
      name: s.name,
      color: s.color,
      isBot: s.isBot,
      money: CONFIG.startMoney,
      position: 0,
      bankrupt: false,
      islandTurns: 0,
      pendingTour: false,
      shields: 0,
      items: [],
      laps: 0,
    })),
    current: 0,
    firstPlayer: 0,
    round: 1,
    // Dengan 2 pemain tidak ada bias urutan yang berarti, jadi urutan ular tidak dipakai
    snake: setups.length >= 3,
    festivalTile: null,
    season: null,
    market: [],
    winner: null,
    winReason: null,
  };
}

const round10 = (n: number) => Math.round(n / 10) * 10;

export function levelCost(tileIndex: number, toLevel: number): number {
  const t = BOARD[tileIndex];
  if (t.kind === "resort") return toLevel === 1 ? t.price! : Infinity;
  if (t.kind !== "property") return Infinity;
  return round10(t.price! * LEVEL_COST_FACTOR[toLevel]);
}

/** Total biaya dari level `from` (eksklusif) sampai `to` (inklusif). */
export function upgradeCost(tileIndex: number, from: number, to: number): number {
  let sum = 0;
  for (let l = from + 1; l <= to; l++) sum += levelCost(tileIndex, l);
  return sum;
}

/** Total yang sudah diinvestasikan pada petak. */
export function investedValue(state: GameState, tileIndex: number): number {
  return upgradeCost(tileIndex, 0, state.tiles[tileIndex].level);
}

export function rentFor(state: GameState, tileIndex: number): number {
  const def = BOARD[tileIndex];
  const ts = state.tiles[tileIndex];
  if (ts.owner === null || ts.level === 0) return 0;
  let rent = 0;
  if (def.kind === "resort") {
    const owned = RESORTS.filter((r) => state.tiles[r].owner === ts.owner).length;
    rent = round10(CONFIG.resortBaseRent * 2 ** (owned - 1));
  } else if (def.kind === "property") {
    // Dibulatkan dulu, baru dikali bonus, supaya "x2" selalu tepat dua kali lipat
    rent = round10(upgradeCost(tileIndex, 0, ts.level) * CONFIG.rentRate);
    // Bonus set: satu grup warna lengkap → sewa +30% di semua level
    if (ownsGroup(state, ts.owner, def.group!)) rent = round10(rent * (1 + CONFIG.setRentBonus));
  }
  if (ts.festival) rent *= CONFIG.festivalMultiplier;
  if (state.season?.id === "turis") rent *= 2;
  return rent;
}

/** Apakah Musim Turis (sewa x2) sudah boleh muncul di ronde ini. */
export function turisOpen(state: GameState): boolean {
  return state.round >= CONFIG.turisFromRound;
}

/** Biaya beli/bangun setelah efek event musiman (Harbolnas = diskon 50%). */
export function seasonalCost(state: GameState, cost: number): number {
  return state.season?.id === "diskon" ? round10(cost / 2) : cost;
}

/** Gaji melewati Mulai (Musim THR = x2). */
export function salaryFor(state: GameState): number {
  return state.season?.id === "thr" ? CONFIG.salary * 2 : CONFIG.salary;
}

/** Putaran pertama pemain (belum pernah melewati Mulai): hanya boleh membeli tanah. */
export function inFirstLap(state: GameState, player: number): boolean {
  return state.players[player].laps === 0;
}

/**
 * Level maksimum yang boleh dituju dalam satu kunjungan oleh `player`.
 * Landmark hanya bisa dibangun jika sudah Vila (level 4) sebelum kunjungan ini.
 * Di putaran pertama pemain hanya bisa membeli tanah (level 1).
 */
export function maxTargetLevel(state: GameState, tileIndex: number, player?: number): BuildLevel {
  const def = BOARD[tileIndex];
  const lvl = state.tiles[tileIndex].level;
  if (def.kind === "resort") return 1;
  if (def.kind !== "property") return 0;
  if (player !== undefined && inFirstLap(state, player)) return 1;
  if (lvl === 4) return 5;
  if (lvl === 5) return 5;
  return 4;
}

export function ownsGroup(state: GameState, player: number, group: number): boolean {
  return PROPERTY_GROUPS[group].every((i) => state.tiles[i].owner === player);
}

export function netWorth(state: GameState, player: number): number {
  let total = state.players[player].money;
  state.tiles.forEach((t, i) => {
    if (t.owner === player) total += investedValue(state, i);
  });
  return total;
}

export function ownedTiles(state: GameState, player: number): number[] {
  return state.tiles.flatMap((t, i) => (t.owner === player ? [i] : []));
}

export function sellValue(state: GameState, tileIndex: number): number {
  return round10(investedValue(state, tileIndex) * CONFIG.sellRate);
}

/**
 * Opsi menurunkan bangunan ke bank (wilayah tetap dimiliki): untuk tiap level
 * tujuan di bawah level sekarang (minimal Tanah), dapat 50% biaya bangunan yang dibongkar.
 */
export function downgradeOptions(state: GameState, tileIndex: number): { level: number; value: number }[] {
  if (BOARD[tileIndex].kind !== "property") return [];
  const cur = state.tiles[tileIndex].level;
  const out: { level: number; value: number }[] = [];
  for (let to = cur - 1; to >= 1; to--) {
    out.push({ level: to, value: round10(upgradeCost(tileIndex, to, cur) * CONFIG.sellRate) });
  }
  return out;
}

export function checkMonopolyWin(state: GameState, player: number): WinReason | null {
  const groups = PROPERTY_GROUPS.filter((_, g) => ownsGroup(state, player, g)).length;
  if (groups >= 3) return "tripleMonopoly";
  if (SIDE_PROPERTIES.some((side) => side.every((i) => state.tiles[i].owner === player))) return "lineMonopoly";
  // Wisata murah (4 x 200), jadi menang lewat wisata juga mensyaratkan satu grup warna lengkap
  if (groups >= 1 && RESORTS.every((i) => state.tiles[i].owner === player)) return "resortMonopoly";
  return null;
}

export function activePlayers(state: GameState): number[] {
  return state.players.filter((p) => !p.bankrupt).map((p) => p.id);
}

export function richestPlayer(state: GameState): number {
  return activePlayers(state).reduce((best, id) => (netWorth(state, id) > netWorth(state, best) ? id : best));
}

export const WIN_TEXT: Record<WinReason, string> = {
  lastStanding: "Pemain terakhir yang bertahan!",
  tripleMonopoly: "Monopoli 3 grup warna!",
  lineMonopoly: "Menguasai satu sisi papan penuh!",
  resortMonopoly: "Menguasai semua tempat wisata + 1 grup warna!",
  roundLimit: "Batas ronde tercapai — kekayaan terbesar!",
};

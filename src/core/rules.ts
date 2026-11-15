import { BOARD, PROPERTY_GROUPS, RESORTS, SIDE_PROPERTIES } from "../data/board";
import type { BuildLevel, GameState, PlayerSetup, WinReason } from "./types";

export const CONFIG = {
  startMoney: 1500,
  salary: 200,
  islandTurns: 3,
  islandBail: 100,
  tourFee: 50,
  taxRate: 0.1,
  roundLimit: 30,
  sellRate: 0.5,
  festivalMultiplier: 2,
  resortBaseRent: 50,
};

/** Biaya untuk naik KE level tertentu, sebagai pengali harga tanah. */
const LEVEL_COST_FACTOR = [0, 1, 0.5, 0.5, 0.75, 1.0];
/** Sewa per level, sebagai pengali harga tanah. */
const RENT_FACTOR = [0, 0.3, 1.0, 2.0, 3.2, 5.0];

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
    })),
    current: 0,
    round: 1,
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
    rent = CONFIG.resortBaseRent * 2 ** (owned - 1);
  } else if (def.kind === "property") {
    rent = def.price! * RENT_FACTOR[ts.level];
    // Bonus satu grup penuh: sewa x2 untuk tanah kosong (level 1)
    if (ts.level === 1 && ownsGroup(state, ts.owner, def.group!)) rent *= 2;
  }
  if (ts.festival) rent *= CONFIG.festivalMultiplier;
  if (state.season?.id === "turis") rent *= 2;
  return round10(rent);
}

/** Biaya beli/bangun setelah efek event musiman (Harbolnas = diskon 50%). */
export function seasonalCost(state: GameState, cost: number): number {
  return state.season?.id === "diskon" ? round10(cost / 2) : cost;
}

/** Gaji melewati Mulai (Musim THR = x2). */
export function salaryFor(state: GameState): number {
  return state.season?.id === "thr" ? CONFIG.salary * 2 : CONFIG.salary;
}

/**
 * Level maksimum yang boleh dituju dalam satu kunjungan.
 * Landmark hanya bisa dibangun jika sudah Vila (level 4) sebelum kunjungan ini.
 */
export function maxTargetLevel(state: GameState, tileIndex: number): BuildLevel {
  const def = BOARD[tileIndex];
  const lvl = state.tiles[tileIndex].level;
  if (def.kind === "resort") return 1;
  if (def.kind !== "property") return 0;
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

export function checkMonopolyWin(state: GameState, player: number): WinReason | null {
  const groups = PROPERTY_GROUPS.filter((_, g) => ownsGroup(state, player, g)).length;
  if (groups >= 3) return "tripleMonopoly";
  if (SIDE_PROPERTIES.some((side) => side.every((i) => state.tiles[i].owner === player))) return "lineMonopoly";
  if (RESORTS.every((i) => state.tiles[i].owner === player)) return "resortMonopoly";
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
  resortMonopoly: "Menguasai semua tempat wisata!",
  roundLimit: "Batas ronde tercapai — kekayaan terbesar!",
};

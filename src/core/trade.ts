import { BOARD } from "../data/board";
import type { TradeOffer } from "./interfaces";
import { rp } from "./money";
import { investedValue } from "./rules";
import type { GameState, MarketListing } from "./types";

/** Maksimal tawaran yang boleh dikirim satu pemain per giliran. */
export const MAX_TRADES_PER_TURN = 3;
/** Maksimal tawar-menawar balik dalam satu negosiasi. */
export const MAX_COUNTERS = 4;
export const MIN_MARKET_PRICE = 10;
export const MAX_MARKET_PRICE = 99_990;

const isOwnable = (t: number) => BOARD[t]?.kind === "property" || BOARD[t]?.kind === "resort";
const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/** Wilayah yang bisa diperdagangkan pemain (semua miliknya). */
export function tradeableTiles(state: GameState, pid: number): number[] {
  return state.tiles.flatMap((t, i) => (t.owner === pid && isOwnable(i) ? [i] : []));
}

/** Kembalikan alasan tawaran tidak sah, atau `null` bila sah. Dipakai di semua peer (deterministik). */
export function tradeError(state: GameState, o: TradeOffer): string | null {
  const { players, tiles } = state;
  if (!o || !isInt(o.from) || !isInt(o.to) || !players[o.from] || !players[o.to]) return "pemain tidak dikenal";
  if (o.from === o.to) return "tidak bisa tawar ke diri sendiri";
  if (players[o.from].bankrupt || players[o.to].bankrupt) return "pemain sudah bangkrut";
  if (!Array.isArray(o.giveTiles) || !Array.isArray(o.takeTiles)) return "data tawaran rusak";
  if (!isInt(o.giveMoney) || !isInt(o.takeMoney) || o.giveMoney < 0 || o.takeMoney < 0) return "jumlah uang tidak sah";
  const all = [...o.giveTiles, ...o.takeTiles];
  if (new Set(all).size !== all.length) return "wilayah dobel";
  if (o.giveTiles.some((t) => !isInt(t) || !isOwnable(t) || tiles[t].owner !== o.from)) return "wilayah yang ditawarkan bukan milik pengirim";
  if (o.takeTiles.some((t) => !isInt(t) || !isOwnable(t) || tiles[t].owner !== o.to)) return "wilayah yang diminta bukan milik lawan";
  if (o.giveMoney > 0 && o.takeMoney > 0) return "uang hanya boleh dari satu pihak";
  if (all.length === 0) return "tawaran tidak boleh tanpa wilayah";
  if (players[o.from].money < o.giveMoney) return `uang ${players[o.from].name} tidak cukup`;
  if (players[o.to].money < o.takeMoney) return `uang ${players[o.to].name} tidak cukup`;
  return null;
}

/** Tawaran yang sama dilihat dari pihak lawan (untuk tawar balik). */
export function flipOffer(o: TradeOffer): TradeOffer {
  return { from: o.to, to: o.from, giveTiles: [...o.takeTiles], giveMoney: o.takeMoney, takeTiles: [...o.giveTiles], takeMoney: o.giveMoney };
}

export function sameOffer(a: TradeOffer, b: TradeOffer): boolean {
  const eq = (x: number[], y: number[]) => x.length === y.length && [...x].sort().every((v, i) => v === [...y].sort()[i]);
  return a.from === b.from && a.to === b.to && a.giveMoney === b.giveMoney && a.takeMoney === b.takeMoney && eq(a.giveTiles, b.giveTiles) && eq(a.takeTiles, b.takeTiles);
}

/** Nilai bersih (versi nilai investasi) yang diterima `to` bila menerima tawaran. */
export function offerGainFor(state: GameState, o: TradeOffer): number {
  const v = (ts: number[]) => ts.reduce((s, t) => s + investedValue(state, t), 0);
  return v(o.giveTiles) + o.giveMoney - v(o.takeTiles) - o.takeMoney;
}

const list = (tiles: number[], money: number) => {
  const parts = tiles.map((t) => BOARD[t].name);
  if (money > 0) parts.push(rp(money));
  return parts.length ? parts.join(", ") : "—";
};

/** Ringkasan satu baris untuk catatan permainan. */
export function describeOffer(state: GameState, o: TradeOffer): string {
  const a = state.players[o.from].name;
  const b = state.players[o.to].name;
  return `${a} beri [${list(o.giveTiles, o.giveMoney)}] ⇄ ${b} beri [${list(o.takeTiles, o.takeMoney)}]`;
}

/** Listing Pasar Terbuka yang masih sah (pemilik masih penjualnya). */
export function activeListings(state: GameState): MarketListing[] {
  return state.market.filter((l) => state.tiles[l.tile]?.owner === l.seller && !state.players[l.seller]?.bankrupt);
}

export function listingFor(state: GameState, tile: number): MarketListing | undefined {
  return activeListings(state).find((l) => l.tile === tile);
}

export function validMarketPrice(price: unknown): price is number {
  return isInt(price) && price >= MIN_MARKET_PRICE && price <= MAX_MARKET_PRICE;
}

/** Harga jual awal yang disarankan: nilai investasi (dibulatkan ke 10). */
export function suggestedPrice(state: GameState, tile: number): number {
  return Math.max(MIN_MARKET_PRICE, Math.round(investedValue(state, tile) / 10) * 10);
}

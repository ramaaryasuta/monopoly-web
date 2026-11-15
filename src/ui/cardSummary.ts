import { activePlayers, ownedTiles } from "../core/rules";
import type { GameState } from "../core/types";
import { BOARD } from "../data/board";
import { ITEMS, MAX_ITEMS, type Card } from "../data/cards";
import { rp } from "../core/money";

export type CardTone = "gain" | "loss" | "mixed" | "neutral";

export interface CardSummary {
  tone: CardTone;
  /** Inti efek, singkat & besar (mis. "+Rp135 jt"). */
  main: string;
  /** Penjelasan tambahan kecil (rincian hitungan). */
  detail?: string;
}

const plus = (n: number) => `+${rp(n)}`;
const minus = (n: number) => `−${rp(n)}`;

/** Ringkasan efek kartu dari sudut pandang pemain yang menariknya (dihitung dari state saat ini). */
export function cardSummary(state: GameState, pid: number, card: Card): CardSummary {
  const e = card.effect;
  const others = activePlayers(state).filter((i) => i !== pid);
  switch (e.type) {
    case "gain":
      return { tone: "gain", main: `💰 ${plus(e.amount)}`, detail: "Uangmu bertambah" };
    case "pay":
      return { tone: "loss", main: `💸 ${minus(e.amount)}`, detail: "Bayar ke bank" };
    case "repair": {
      const buildings = ownedTiles(state, pid).reduce(
        (s, i) => s + (BOARD[i].kind === "property" ? Math.max(0, state.tiles[i].level - 1) : 0),
        0,
      );
      const cost = buildings * e.perLevel;
      return cost > 0
        ? { tone: "loss", main: `💸 ${minus(cost)}`, detail: `${buildings} bangunan × ${rp(e.perLevel)}` }
        : { tone: "neutral", main: "😌 Rp0", detail: "Belum punya bangunan, lolos!" };
    }
    case "shield":
      return { tone: "gain", main: "🛡️ Bebas sewa 1×", detail: "Dipakai otomatis saat kena sewa berikutnya" };
    case "goto": {
      const dest = BOARD[e.tile].name;
      return { tone: "neutral", main: `✈️ Pindah ke ${dest}`, detail: e.tile === 0 ? "Dapat gaji Mulai" : undefined };
    }
    case "island":
      return { tone: "loss", main: "⛓️ Masuk Nusakambangan", detail: "Terjebak beberapa giliran" };
    case "collectFromAll": {
      const total = e.amount * others.length;
      return { tone: "gain", main: `💰 ${plus(total)}`, detail: `${rp(e.amount)} × ${others.length} pemain lain` };
    }
    case "payAll": {
      const total = e.amount * others.length;
      return { tone: "loss", main: `💸 ${minus(total)}`, detail: `${rp(e.amount)} ke ${others.length} pemain lain` };
    }
    case "stealRichest": {
      if (others.length === 0) return { tone: "neutral", main: "🤷 Tidak ada yang bisa dipinjami" };
      const victim = others.reduce((a, b) => (state.players[b].money > state.players[a].money ? b : a));
      const amt = Math.min(e.amount, state.players[victim].money);
      return { tone: "gain", main: `💰 ${plus(amt)}`, detail: `Diambil dari ${state.players[victim].name}` };
    }
    case "gacha":
      return { tone: "mixed", main: `🎲 ${minus(-e.min)} s/d ${plus(e.max)}`, detail: "Untung atau rugi, diundi!" };
    case "back":
      return { tone: "neutral", main: `⬅️ Mundur ${e.steps} petak` };
    case "forward":
      return { tone: "neutral", main: `➡️ Maju ${e.steps} petak` };
    case "pushOthers":
      return { tone: "gain", main: `💨 Lawan mundur ${e.steps} petak`, detail: "Uangmu aman" };
    case "swap":
      return { tone: "neutral", main: "🔄 Tukar posisi", detail: "Dengan pemain acak" };
    case "randomTile":
      return { tone: "neutral", main: "🚁 Pindah ke petak acak" };
    case "item": {
      const def = ITEMS[e.item];
      if (state.players[pid].items.length >= MAX_ITEMS) return { tone: "gain", main: `💰 ${plus(50)}`, detail: `Kantong penuh, ${def.name} dijual ke tukang loak` };
      return { tone: "gain", main: `🎒 Dapat ${def.icon} ${def.name}`, detail: "Disimpan di kantong, pakai nanti" };
    }
  }
}

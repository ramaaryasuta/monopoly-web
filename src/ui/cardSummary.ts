import { activePlayers, ownedTiles } from "../core/rules";
import type { GameState } from "../core/types";
import { BOARD } from "../data/board";
import { ITEMS, MAX_ITEMS, MAX_SHIELDS, type Card } from "../data/cards";
import { rp } from "../core/money";
import { Lang } from "../lang/id";

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
      return { tone: "gain", main: `💰 ${plus(e.amount)}`, detail: Lang.cardSummary.gainDetail };
    case "pay":
      return { tone: "loss", main: `💸 ${minus(e.amount)}`, detail: Lang.cardSummary.payDetail };
    case "repair": {
      const buildings = ownedTiles(state, pid).reduce(
        (s, i) => s + (BOARD[i].kind === "property" ? Math.max(0, state.tiles[i].level - 1) : 0),
        0,
      );
      const cost = buildings * e.perLevel;
      return cost > 0
        ? { tone: "loss", main: `💸 ${minus(cost)}`, detail: Lang.cardSummary.repairDetail(buildings, rp(e.perLevel)) }
        : { tone: "neutral", main: Lang.cardSummary.repairNone, detail: Lang.cardSummary.repairNoneDetail };
    }
    case "shield":
      return {
        tone: "gain",
        main: Lang.cardSummary.shieldMain,
        detail: state.players[pid].shields >= MAX_SHIELDS ? Lang.cardSummary.shieldReplace : Lang.cardSummary.shieldDetail,
      };
    case "goto": {
      const dest = BOARD[e.tile].name;
      return { tone: "neutral", main: Lang.cardSummary.gotoMain(dest), detail: e.tile === 0 ? Lang.cardSummary.gotoDetail : undefined };
    }
    case "island":
      return { tone: "loss", main: Lang.cardSummary.islandMain, detail: Lang.cardSummary.islandDetail };
    case "collectFromAll": {
      const total = e.amount * others.length;
      return { tone: "gain", main: `💰 ${plus(total)}`, detail: Lang.cardSummary.collectDetail(rp(e.amount), others.length) };
    }
    case "payAll": {
      const total = e.amount * others.length;
      return { tone: "loss", main: `💸 ${minus(total)}`, detail: Lang.cardSummary.payAllDetail(rp(e.amount), others.length) };
    }
    case "stealRichest": {
      if (others.length === 0) return { tone: "neutral", main: Lang.cardSummary.stealNone };
      const victim = others.reduce((a, b) => (state.players[b].money > state.players[a].money ? b : a));
      const amt = Math.min(e.amount, state.players[victim].money);
      return { tone: "gain", main: `💰 ${plus(amt)}`, detail: Lang.cardSummary.stealDetail(state.players[victim].name) };
    }
    case "gacha":
      return { tone: "mixed", main: Lang.cardSummary.gachaMain(minus(-e.min), plus(e.max)), detail: Lang.cardSummary.gachaDetail };
    case "back":
      return { tone: "neutral", main: Lang.cardSummary.backMain(e.steps) };
    case "forward":
      return { tone: "neutral", main: Lang.cardSummary.forwardMain(e.steps) };
    case "pushOthers":
      return { tone: "gain", main: Lang.cardSummary.pushMain(e.steps), detail: Lang.cardSummary.pushDetail };
    case "swap":
      return { tone: "neutral", main: Lang.cardSummary.swapMain, detail: Lang.cardSummary.swapDetail };
    case "randomTile":
      return { tone: "neutral", main: Lang.cardSummary.randomTileMain };
    case "item": {
      const def = ITEMS[e.item];
      if (state.players[pid].items.length >= MAX_ITEMS) return { tone: "gain", main: `💰 ${plus(50)}`, detail: Lang.cardSummary.itemFullDetail(def.name) };
      return { tone: "gain", main: Lang.cardSummary.itemMain(def.icon, def.name), detail: Lang.cardSummary.itemDetail };
    }
  }
}

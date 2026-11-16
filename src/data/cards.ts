import { Lang } from "../lang/id";
import { FESTIVAL_INDEX } from "./board";
export type CardEffect =
  | { type: "gain"; amount: number }
  | { type: "pay"; amount: number }
  | { type: "repair"; perLevel: number }
  | { type: "shield" }
  | { type: "goto"; tile: number }
  | { type: "island" }
  | { type: "collectFromAll"; amount: number }
  | { type: "payAll"; amount: number }
  | { type: "back"; steps: number }
  | { type: "forward"; steps: number }
  /** Tukar posisi dengan pemain lain acak (tanpa efek petak). */
  | { type: "swap" }
  /** Curi dari pemain terkaya lainnya. */
  | { type: "stealRichest"; amount: number }
  /** Uang acak antara min..max (kelipatan 10). */
  | { type: "gacha"; min: number; max: number }
  /** Semua pemain lain terdorong mundur N petak (tanpa efek petak). */
  | { type: "pushOthers"; steps: number }
  /** Diculik ke petak acak, lalu efek petak berlaku. */
  | { type: "randomTile" }
  /** Dapat kartu simpanan (masuk kantong, dipakai nanti). */
  | { type: "item"; item: ItemId };

/** Efek visual tambahan saat kartu/event muncul. */
export type FunFx = "fart" | "heli" | "dance" | "party" | "cry" | "rain" | "shake" | "duck" | "dizzy";

export interface Card {
  id: string;
  title: string;
  text: string;
  icon: string;
  effect: CardEffect;
  fx?: FunFx;
}

export const CARDS: Card[] = [
  { id: "coinRain", title: Lang.cards.coinRain.title, text: Lang.cards.coinRain.text, icon: "💸", effect: { type: "gain", amount: 135 }, fx: "rain" },
  { id: "harvest", title: Lang.cards.harvest.title, text: Lang.cards.harvest.text, icon: "🏦", effect: { type: "gain", amount: 90 }, fx: "dance" },
  { id: "leakyWallet", title: Lang.cards.leakyWallet.title, text: Lang.cards.leakyWallet.text, icon: "📉", effect: { type: "pay", amount: 100 }, fx: "cry" },
  { id: "repair", title: Lang.cards.repair.title, text: Lang.cards.repair.text, icon: "🪣", effect: { type: "repair", perLevel: 20 }, fx: "cry" },
  { id: "shield", title: Lang.cards.shield.title, text: Lang.cards.shield.text, icon: "🩲", effect: { type: "shield" }, fx: "dance" },
  { id: "toStart", title: Lang.cards.toStart.title, text: Lang.cards.toStart.text, icon: "🪃", effect: { type: "goto", tile: 0 }, fx: "dizzy" },
  { id: "toIsland", title: Lang.cards.toIsland.title, text: Lang.cards.toIsland.text, icon: "🚓", effect: { type: "island" }, fx: "cry" },
  { id: "birthday", title: Lang.cards.birthday.title, text: Lang.cards.birthday.text, icon: "🎂", effect: { type: "collectFromAll", amount: 45 }, fx: "dance" },
  { id: "back3", title: Lang.cards.back3.title, text: Lang.cards.back3.text, icon: "🔑", effect: { type: "back", steps: 3 }, fx: "dizzy" },
  { id: "toFestival", title: Lang.cards.toFestival.title, text: Lang.cards.toFestival.text, icon: "🥂", effect: { type: "goto", tile: FESTIVAL_INDEX }, fx: "party" },
  { id: "fart", title: Lang.cards.fart.title, text: Lang.cards.fart.text, icon: "💨", effect: { type: "pushOthers", steps: 2 }, fx: "fart" },
  { id: "heli", title: Lang.cards.heli.title, text: Lang.cards.heli.text, icon: "🚁", effect: { type: "randomTile" }, fx: "heli" },
  { id: "swap", title: Lang.cards.swap.title, text: Lang.cards.swap.text, icon: "⚡", effect: { type: "swap" }, fx: "shake" },
  { id: "treat", title: Lang.cards.treat.title, text: Lang.cards.treat.text, icon: "⚽", effect: { type: "payAll", amount: 50 }, fx: "cry" },
  { id: "steal", title: Lang.cards.steal.title, text: Lang.cards.steal.text, icon: "🤝", effect: { type: "stealRichest", amount: 100 }, fx: "dance" },
  { id: "claw", title: Lang.cards.claw.title, text: Lang.cards.claw.text, icon: "🕹️", effect: { type: "gacha", min: -150, max: 230 }, fx: "shake" },
  { id: "duck", title: Lang.cards.duck.title, text: Lang.cards.duck.text, icon: "🦆", effect: { type: "forward", steps: 4 }, fx: "duck" },
  { id: "sandal", title: Lang.cards.sandal.title, text: Lang.cards.sandal.text, icon: "📈", effect: { type: "gain", amount: 72 }, fx: "dance" },
  { id: "gorengan", title: Lang.cards.gorengan.title, text: Lang.cards.gorengan.text, icon: "⏰", effect: { type: "pay", amount: 60 }, fx: "cry" },
  { id: "mancing", title: Lang.cards.mancing.title, text: Lang.cards.mancing.text, icon: "💌", effect: { type: "gain", amount: 63 }, fx: "dance" },
  { id: "cukur", title: Lang.cards.cukur.title, text: Lang.cards.cukur.text, icon: "📑", effect: { type: "pay", amount: 50 }, fx: "dizzy" },
  { id: "itemSandal", title: Lang.cards.itemSandal.title, text: Lang.cards.itemSandal.text, icon: "🩴", effect: { type: "item", item: "sandal" }, fx: "dance" },
  { id: "itemUtang", title: Lang.cards.itemUtang.title, text: Lang.cards.itemUtang.text, icon: "📜", effect: { type: "item", item: "utang" }, fx: "dance" },
  { id: "itemTurbo", title: Lang.cards.itemTurbo.title, text: Lang.cards.itemTurbo.text, icon: "🛼", effect: { type: "item", item: "turbo" }, fx: "duck" },
  { id: "itemKecoak", title: Lang.cards.itemKecoak.title, text: Lang.cards.itemKecoak.text, icon: "🏃", effect: { type: "item", item: "kecoak" }, fx: "shake" },
  { id: "orangDalam", title: Lang.cards.orangDalam.title, text: Lang.cards.orangDalam.text, icon: "🕴️", effect: { type: "shield" }, fx: "dance" },
  { id: "tilang", title: Lang.cards.tilang.title, text: Lang.cards.tilang.text, icon: "👮", effect: { type: "pay", amount: 75 }, fx: "cry" },
  { id: "pajak", title: Lang.cards.pajak.title, text: Lang.cards.pajak.text, icon: "🧾", effect: { type: "repair", perLevel: 25 }, fx: "cry" },
  { id: "korupsi", title: Lang.cards.korupsi.title, text: Lang.cards.korupsi.text, icon: "💼", effect: { type: "gacha", min: -200, max: 270 }, fx: "shake" },
  { id: "pinjol", title: Lang.cards.pinjol.title, text: Lang.cards.pinjol.text, icon: "📱", effect: { type: "pay", amount: 150 }, fx: "cry" },
  { id: "viral", title: Lang.cards.viral.title, text: Lang.cards.viral.text, icon: "🤳", effect: { type: "collectFromAll", amount: 36 }, fx: "dance" },
  { id: "gusur", title: Lang.cards.gusur.title, text: Lang.cards.gusur.text, icon: "🚜", effect: { type: "back", steps: 4 }, fx: "shake" },
  { id: "wapres", title: Lang.cards.wapres.title, text: Lang.cards.wapres.text, icon: "🪑", effect: { type: "goto", tile: 39 /* Istana Presiden */ }, fx: "dizzy" },
  { id: "ronda", title: Lang.cards.ronda.title, text: Lang.cards.ronda.text, icon: "⚖️", effect: { type: "goto", tile: 11 /* Polri */ }, fx: "dizzy" },
];

/** Event konyol sedunia: kadang muncul di awal ronde. */
export type ChaosEffect =
  | { type: "allGain"; amount: number }
  | { type: "allPay"; amount: number }
  /** Satu pemain acak kena/untung. */
  | { type: "randomGain"; amount: number }
  | { type: "randomPay"; amount: number }
  /** Pemain termiskin dapat bantuan. */
  | { type: "poorestGain"; amount: number }
  /** Pemain terkaya kena "pajak" dibagi rata ke yang lain. */
  | { type: "robinHood"; amount: number }
  /** Pemain acak diangkut helikopter ke petak acak (tanpa efek petak). */
  | { type: "heliAbduct" }
  /** Tidak ada efek uang, cuma heboh. */
  | { type: "nothing" };

export interface ChaosEvent {
  id: string;
  headline: string;
  text: string;
  icon: string;
  effect: ChaosEffect;
  fx: FunFx;
}

export const CHAOS_EVENTS: ChaosEvent[] = [
  { id: "bansos", headline: Lang.chaos.bansos.headline, text: Lang.chaos.bansos.text, icon: "🧧", effect: { type: "allGain", amount: 60 }, fx: "rain" },
  { id: "iuran", headline: Lang.chaos.iuran.headline, text: Lang.chaos.iuran.text, icon: "🇮🇩", effect: { type: "allPay", amount: 40 }, fx: "shake" },
  { id: "seagull", headline: Lang.chaos.seagull.headline, text: Lang.chaos.seagull.text, icon: "🐦", effect: { type: "randomPay", amount: 80 }, fx: "cry" },
  { id: "lottery", headline: Lang.chaos.lottery.headline, text: Lang.chaos.lottery.text, icon: "🧳", effect: { type: "randomGain", amount: 150 }, fx: "dance" },
  { id: "pity", headline: Lang.chaos.pity.headline, text: Lang.chaos.pity.text, icon: "🥺", effect: { type: "poorestGain", amount: 120 }, fx: "cry" },
  { id: "robin", headline: Lang.chaos.robin.headline, text: Lang.chaos.robin.text, icon: "🦹", effect: { type: "robinHood", amount: 150 }, fx: "shake" },
  { id: "heli", headline: Lang.chaos.heli.headline, text: Lang.chaos.heli.text, icon: "🚁", effect: { type: "heliAbduct" }, fx: "heli" },
  { id: "blackout", headline: Lang.chaos.blackout.headline, text: Lang.chaos.blackout.text, icon: "🔦", effect: { type: "nothing" }, fx: "dance" },
  { id: "fartquake", headline: Lang.chaos.fartquake.headline, text: Lang.chaos.fartquake.text, icon: "💨", effect: { type: "allPay", amount: 30 }, fx: "fart" },
  { id: "giantduck", headline: Lang.chaos.giantduck.headline, text: Lang.chaos.giantduck.text, icon: "🦆", effect: { type: "randomGain", amount: 100 }, fx: "duck" },
];

/** Peluang event konyol muncul di awal setiap ronde baru. */
export const CHAOS_CHANCE = 0.45;

// ------------------------------------------------------------------ kartu simpanan

export type ItemId = "sandal" | "utang" | "turbo" | "kecoak";

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  /** Penjelasan singkat efek saat dipakai. */
  text: string;
  /** Butuh memilih pemain sasaran / petak sasaran. */
  target: "player" | "tile" | null;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  sandal: { id: "sandal", name: Lang.items.sandal.name, icon: "🩴", text: Lang.items.sandal.text, target: "player" },
  utang: { id: "utang", name: Lang.items.utang.name, icon: "📜", text: Lang.items.utang.text, target: "player" },
  turbo: { id: "turbo", name: Lang.items.turbo.name, icon: "🛼", text: Lang.items.turbo.text, target: null },
  kecoak: { id: "kecoak", name: Lang.items.kecoak.name, icon: "🏃", text: Lang.items.kecoak.text, target: "tile" },
};

/** Maksimal kartu simpanan per pemain. Kalau penuh, kartu baru dijual Rp50 jt. */
export const MAX_ITEMS = 3;
export const SANDAL_STEPS = 3;
export const UTANG_AMOUNT = 100;
export const TURBO_STEPS = 3;

// ------------------------------------------------------------------ event musiman

export type SeasonId = "turis" | "banjir" | "diskon" | "thr";

export interface SeasonDef {
  id: SeasonId;
  headline: string;
  text: string;
  /** Teks pendek untuk lencana ronde. */
  badge: string;
  icon: string;
  fx: FunFx;
}

export const SEASONS: Record<SeasonId, SeasonDef> = {
  turis: { id: "turis", headline: Lang.seasons.turis.headline, text: Lang.seasons.turis.text, badge: Lang.seasons.turis.badge, icon: "📸", fx: "dance" },
  banjir: { id: "banjir", headline: Lang.seasons.banjir.headline, text: Lang.seasons.banjir.text, badge: Lang.seasons.banjir.badge, icon: "🌊", fx: "rain" },
  diskon: { id: "diskon", headline: Lang.seasons.diskon.headline, text: Lang.seasons.diskon.text, badge: Lang.seasons.diskon.badge, icon: "🛍️", fx: "dance" },
  thr: { id: "thr", headline: Lang.seasons.thr.headline, text: Lang.seasons.thr.text, badge: Lang.seasons.thr.badge, icon: "💰", fx: "rain" },
};

export const SEASON_IDS = Object.keys(SEASONS) as SeasonId[];
/** Lama event musiman (ronde). */
export const SEASON_ROUNDS = 2;
/** Peluang event musiman mulai di awal ronde (bila sedang tidak ada). */
export const SEASON_CHANCE = 0.3;

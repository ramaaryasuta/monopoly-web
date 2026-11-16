import type { Card, ChaosEvent, ItemId, SeasonDef } from "../data/cards";
import type { GameState } from "./types";

export interface BuildChoice {
  player: number;
  tile: number;
  currentLevel: number;
  /** Level yang bisa dituju beserta total biayanya (sudah difilter yang terjangkau). */
  options: { level: number; cost: number }[];
  /** Level yang ada tapi uangnya tidak cukup — ditampilkan sebagai tombol nonaktif. */
  unaffordable?: { level: number; cost: number }[];
  money: number;
  /** Putaran pertama: hanya tanah yang boleh dibeli (untuk keterangan di UI). */
  firstLap?: boolean;
}

export interface IslandChoice {
  player: number;
  bail: number;
  canPay: boolean;
  turnsLeft: number;
}

export interface TileChoice {
  player: number;
  purpose: "tour" | "festival";
  options: number[];
}

/** Kena sewa sambil memegang kartu bebas sewa: pakai sekarang atau simpan. */
export interface ShieldChoice {
  player: number;
  tile: number;
  rent: number;
  owner: number;
  money: number;
}

export interface ItemChoice {
  player: number;
  /** Kartu simpanan yang bisa dipakai sekarang beserta sasaran sahnya (pemain atau petak). */
  usable: { item: ItemId; targets: number[] }[];
}

/** Kartu yang dipakai; `target` = id pemain / indeks petak (bila kartunya butuh sasaran). */
export interface ItemUse {
  item: ItemId;
  target: number | null;
}

/**
 * Tawaran tukar/jual wilayah antar pemain. Dilihat dari sisi pengirim (`from`):
 * `give*` = yang diberikan `from` ke `to`, `take*` = yang diminta `from` dari `to`.
 */
export interface TradeOffer {
  from: number;
  to: number;
  giveTiles: number[];
  giveMoney: number;
  takeTiles: number[];
  takeMoney: number;
}

/** Aksi sebelum lempar dadu: negosiasi atau transaksi Pasar Terbuka. */
export type DealAction =
  | { type: "trade"; offer: TradeOffer }
  | { type: "list"; tile: number; price: number }
  | { type: "unlist"; tile: number }
  | { type: "buy"; tile: number }
  /** Hanya dari menu yang disela aksi kapan saja: proses antrian dulu, lalu tanya lagi. */
  | { type: "sync" };

export interface DealChoice {
  player: number;
  /** Sisa jatah mengirim tawaran negosiasi di giliran ini. */
  tradesLeft: number;
  /** Ada kartu simpanan yang bisa dipakai (untuk tombol 🎒). */
  hasItems: boolean;
  inIsland: boolean;
}

export type TradeReply = { type: "accept" } | { type: "reject" } | { type: "counter"; offer: TradeOffer };

export interface TradeReplyChoice {
  /** Pemain yang menjawab (= offer.to). */
  player: number;
  offer: TradeOffer;
  /** Tawaran ke berapa dalam negosiasi ini (0 = tawaran pertama). */
  round: number;
  canCounter: boolean;
}

/** Uang tidak cukup untuk membayar: pemain memilih cara mencari uang. */
export interface DebtChoice {
  player: number;
  /** Total yang harus dibayar. */
  amount: number;
  money: number;
  /** Penerima uang (null = bank). */
  creditor: number | null;
  /** Wilayah yang bisa dijual ke bank beserta hasilnya, termurah dulu. */
  tiles: { tile: number; value: number }[];
  /** Wilayah yang bangunannya bisa diturunkan (wilayah tetap milikmu), per level tujuan. */
  downgrades: { tile: number; level: number; options: { level: number; value: number }[] }[];
  /** Sisa jatah menawar ke pemain lain selama mencari uang. */
  tradesLeft: number;
}

export type DebtAction =
  | { type: "sell"; tile: number }
  | { type: "downgrade"; tile: number; level: number }
  | { type: "trade"; offer: TradeOffer }
  | { type: "giveUp" };

/** Sumber keputusan: pemain manusia (UI) atau bot (AI). */
export interface Decider {
  waitForRoll(player: number): Promise<void>;
  /** Kembalikan level tujuan, atau `currentLevel` untuk lewati. */
  chooseBuild(c: BuildChoice): Promise<number>;
  chooseIslandAction(c: IslandChoice): Promise<"pay" | "roll">;
  /** Pakai kartu bebas sewa (true) atau bayar sewa dan simpan kartunya (false). */
  chooseShield(c: ShieldChoice): Promise<boolean>;
  chooseTile(c: TileChoice): Promise<number>;
  /** Sebelum lempar dadu: pakai kartu simpanan, atau `null` untuk langsung lempar. */
  chooseItem(c: ItemChoice): Promise<ItemUse | null>;
  /** Di awal giliran: negosiasi / pasar, atau `null` untuk lanjut (lempar dadu). */
  chooseDeal(c: DealChoice): Promise<DealAction | null>;
  /** Menjawab tawaran negosiasi: terima, tolak, atau tawar balik. */
  respondTrade(c: TradeReplyChoice): Promise<TradeReply>;
  /** Uang kurang untuk membayar: jual wilayah ke bank, nego, atau menyerah (bangkrut). */
  chooseDebt(c: DebtChoice): Promise<DebtAction>;
}

export type MessageKind = "info" | "good" | "bad";

/** Visualisasi & feedback. Implementasi: scene 3D + UI (atau NullPresenter untuk test). */
export interface Presenter {
  turnStart(state: GameState, player: number): Promise<void>;
  diceRolled(player: number, d1: number, d2: number): Promise<void>;
  movePawn(player: number, path: number[], mode: "walk" | "fly"): Promise<void>;
  moneyChanged(state: GameState, player: number, delta: number): void;
  tileChanged(state: GameState, tile: number): Promise<void>;
  message(text: string, kind?: MessageKind): void;
  showCard(player: number, card: Card): Promise<void>;
  /** Event konyol sedunia; targets = pemain yang terkena. */
  showEvent(event: ChaosEvent, targets: number[]): Promise<void>;
  /** Event musiman mulai (`ended` = false) atau selesai. */
  showSeason(season: SeasonDef, ended: boolean): Promise<void>;
  /** Kartu simpanan dipakai. */
  itemUsed(player: number, use: ItemUse): Promise<void>;
  /** Isi Pasar Terbuka berubah. */
  marketChanged(state: GameState): Promise<void>;
  /** Tawaran negosiasi dikirim (semua pemain melihatnya). */
  tradeProposed(state: GameState, offer: TradeOffer, round: number): Promise<void>;
  /** Negosiasi selesai: deal (`accepted`) atau ditolak. */
  tradeResolved(state: GameState, offer: TradeOffer, accepted: boolean): Promise<void>;
  playerBankrupt(state: GameState, player: number): Promise<void>;
  gameOver(state: GameState): Promise<void>;
}

export class NullPresenter implements Presenter {
  async turnStart() {}
  async diceRolled() {}
  async movePawn() {}
  moneyChanged() {}
  async tileChanged() {}
  message() {}
  async showCard() {}
  async showEvent() {}
  async showSeason() {}
  async itemUsed() {}
  async marketChanged() {}
  async tradeProposed() {}
  async tradeResolved() {}
  async playerBankrupt() {}
  async gameOver() {}
}

import type { Card, ChaosEvent } from "../data/cards";
import type { GameState } from "./types";

export interface BuildChoice {
  player: number;
  tile: number;
  currentLevel: number;
  /** Level yang bisa dituju beserta total biayanya (sudah difilter yang terjangkau). */
  options: { level: number; cost: number }[];
  money: number;
}

export interface AcquireChoice {
  player: number;
  tile: number;
  price: number;
  owner: number;
  money: number;
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

/** Sumber keputusan: pemain manusia (UI) atau bot (AI). */
export interface Decider {
  waitForRoll(player: number): Promise<void>;
  /** Kembalikan level tujuan, atau `currentLevel` untuk lewati. */
  chooseBuild(c: BuildChoice): Promise<number>;
  chooseAcquire(c: AcquireChoice): Promise<boolean>;
  chooseIslandAction(c: IslandChoice): Promise<"pay" | "roll">;
  chooseTile(c: TileChoice): Promise<number>;
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
  async playerBankrupt() {}
  async gameOver() {}
}

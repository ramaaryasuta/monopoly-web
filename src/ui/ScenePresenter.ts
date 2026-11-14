import { Vector3 } from "@babylonjs/core";
import type { MessageKind, Presenter } from "../core/interfaces";
import type { GameState } from "../core/types";
import type { Card } from "../data/cards";
import type { GameScene } from "../scene/GameScene";
import { sfx } from "../scene/sfx";
import { wait } from "../scene/tween";
import { modal } from "./dom";
import type { Hud } from "./Hud";

/** Menjembatani event game logic → animasi 3D + HUD. */
export class ScenePresenter implements Presenter {
  constructor(
    private view: GameScene,
    private hud: Hud,
    private state: GameState,
  ) {}

  async turnStart(state: GameState, player: number) {
    this.hud.refresh();
    const p = state.players[player];
    this.hud.setTurnLabel(`Giliran ${p.name}${p.isBot ? " 🤖" : ""}`);
    const pawn = this.view.pawns[player];
    await this.view.focus(new Vector3(pawn.root.position.x * 0.5, 0, pawn.root.position.z * 0.5 - 1), 28, 0.6);
    void pawn.cheer();
  }

  async diceRolled(_player: number, d1: number, d2: number) {
    this.hud.setTurnLabel(null);
    await this.view.rollDice(d1, d2);
    this.hud.showDiceResult(d1, d2);
    await wait(this.view.scene, 0.35);
  }

  async movePawn(player: number, path: number[], mode: "walk" | "fly") {
    await this.view.movePawn(player, path, mode);
  }

  moneyChanged(state: GameState, player: number, delta: number) {
    this.hud.animateMoney(player);
    this.hud.floatMoney(player, delta);
    this.hud.refresh();
    if (delta > 0) {
      sfx.coin();
      this.view.effects.coins(this.view.pawns[player].root.position.add(new Vector3(0, 1.2, 0)), Math.min(40, 8 + delta / 20));
    } else {
      sfx.pay();
    }
    void state;
  }

  async tileChanged(state: GameState, tile: number) {
    const ts = state.tiles[tile];
    if (ts.level > 0) sfx.build();
    await this.view.board.updateTile(state, tile, true);
    this.hud.refresh();
  }

  message(text: string, kind: MessageKind = "info") {
    this.hud.log(text, kind);
    this.hud.toast(text, kind);
  }

  async showCard(player: number, card: Card) {
    sfx.card();
    const bot = this.state.players[player].isBot;
    await modal({
      title: card.title,
      body: `<div class="card-art">${card.icon}</div><p>${card.text}</p>`,
      buttons: [{ label: "OK!", value: 0, class: "green" }],
      autoCloseMs: bot ? 1800 : undefined,
    });
  }

  async playerBankrupt(state: GameState, player: number) {
    sfx.bad();
    this.hud.refresh();
    await this.view.pawns[player].faint();
    void state;
  }

  async gameOver(state: GameState) {
    this.hud.refresh();
    this.hud.setTurnLabel(null);
    sfx.win();
    const pawn = this.view.pawns[state.winner!];
    await this.view.focus(pawn.root.position.clone(), 18, 1, 0.6);
    this.view.effects.confetti(pawn.root.position.add(new Vector3(0, 2, 0)));
    void pawn.cheer().then(() => pawn.cheer());
    await wait(this.view.scene, 1.2);
    await this.hud.showGameOver();
  }
}

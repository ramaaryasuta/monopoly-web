import { Vector3 } from "@babylonjs/core";
import type { MessageKind, Presenter } from "../core/interfaces";
import type { GameState } from "../core/types";
import type { Card, ChaosEvent } from "../data/cards";
import type { GameScene } from "../scene/GameScene";
import { sfx } from "../scene/sfx";
import { wait } from "../scene/tween";
import { escapeHtml, modal } from "./dom";
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
    if (delta >= 150) this.hud.speech(player, pick(HAPPY));
    else if (delta <= -150) this.hud.speech(player, pick(SAD));
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
      className: "comic",
      body: `<div class="comic-pow">${pick(POW)}</div><div class="card-art">${card.icon}</div><p>${card.text}</p>`,
      buttons: [{ label: pick(OK_LABELS), value: 0, class: "green" }],
      autoCloseMs: bot ? 2000 : undefined,
    });
    if (card.fx) await this.view.funFx(card.fx, [player]);
    this.hud.speech(player, pick(card.fx === "cry" ? SAD : HAPPY));
  }

  async showEvent(ev: ChaosEvent, targets: number[]) {
    sfx.scream();
    const names = targets.map((t) => escapeHtml(this.state.players[t].name)).join(", ");
    const allBots = this.state.players.every((p) => p.isBot || p.bankrupt);
    await this.view.goHome(0.5);
    await modal({
      title: ev.headline,
      className: "comic breaking",
      body: `<div class="breaking-tag">📢 BERITA HEBOH</div><div class="card-art">${ev.icon}</div><p>${ev.text}</p>${
        targets.length < this.state.players.length ? `<p class="victim">Yang kena: <b>${names}</b></p>` : ""
      }`,
      buttons: [{ label: pick(["Astaga!", "Waduh!", "Hah?!", "Ngakak 🤣"]), value: 0, class: "pink" }],
      autoCloseMs: allBots ? 2200 : 6000,
    });
    await this.view.funFx(ev.fx, targets);
  }

  async playerBankrupt(state: GameState, player: number) {
    sfx.sadTrombone();
    this.hud.refresh();
    this.hud.speech(player, pick(["Mampus aku...", "Pinjol mana pinjol?!", "Aku pulang kampung aja 😭", "Jual ginjal kah?"]), true);
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

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const POW = ["BOOM!", "WADUH!", "PLAK!", "BRRRT!", "GASS!", "ANJAY!", "DUAR!"];
const OK_LABELS = ["OK deh", "Pasrah 🙏", "Gaskeun!", "Yaudah lah", "Siap bos!"];
const HAPPY = ["Gaskeun! 🔥", "Rezeki anak soleh!", "Mantap jiwa!", "Sultan mah bebas 😎", "Hahaha kaya!", "Cuan cuan cuan!", "Traktir? Nggak."];
const SAD = ["Waduh...", "Dompetku menangis 😭", "Kok gitu sih?!", "Asem!", "Astagaa...", "Nangis di pojokan", "Gajian masih lama..."];

import type { AcquireChoice, BuildChoice, Decider, IslandChoice, TileChoice } from "../core/interfaces";
import { LEVEL_NAMES, rentFor } from "../core/rules";
import type { BuildLevel, GameState } from "../core/types";
import { BOARD, GROUP_COLORS } from "../data/board";
import type { GameScene } from "../scene/GameScene";
import { escapeHtml, fmt, modal } from "./dom";
import type { Hud } from "./Hud";

const LEVEL_ICON = ["", "🚩", "🏠", "🏠🏠", "🏡", "🗼"];

/** Keputusan pemain manusia lewat UI (modal, tombol, klik petak 3D). */
export class HumanDecider implements Decider {
  constructor(
    private state: GameState,
    private hud: Hud,
    private scene: GameScene,
  ) {}

  async waitForRoll(): Promise<void> {
    await this.hud.waitRollButton();
  }

  private rentAt(tile: number, player: number, level: number) {
    const fake = structuredClone(this.state);
    fake.tiles[tile].owner = player;
    fake.tiles[tile].level = level as BuildLevel;
    return rentFor(fake, tile);
  }

  async chooseBuild(c: BuildChoice): Promise<number> {
    const def = BOARD[c.tile];
    const isResort = def.kind === "resort";
    const title = c.currentLevel === 0 ? `Beli ${def.name}?` : `Bangun di ${def.name}?`;
    const buttons = c.options.map((o) => ({
      label: isResort ? `🌴 Beli Wisata — ${fmt(o.cost)}` : `${LEVEL_ICON[o.level]} ${LEVEL_NAMES[o.level]} — ${fmt(o.cost)}`,
      sub: `sewa ${fmt(this.rentAt(c.tile, c.player, o.level))}`,
      value: o.level,
      class: o.level === 5 ? "pink" : "green",
    }));
    buttons.push({ label: "Lewati", sub: "", value: c.currentLevel, class: "white" });
    const levelText = c.currentLevel > 0 ? `Saat ini: <b>${LEVEL_NAMES[c.currentLevel]}</b>. ` : "";
    return modal({
      title,
      bandColor: def.group !== undefined ? GROUP_COLORS[def.group] : "#36d1c4",
      body: `<p>${levelText}Uangmu: <b>🪙 ${fmt(c.money)}</b></p>`,
      buttons,
    });
  }

  async chooseAcquire(c: AcquireChoice): Promise<boolean> {
    const def = BOARD[c.tile];
    const owner = this.state.players[c.owner];
    return modal({
      title: `Akuisisi ${def.name}?`,
      bandColor: GROUP_COLORS[def.group!],
      body: `<p>Rebut properti ini dari <b>${escapeHtml(owner.name)}</b> seharga <b>🪙 ${fmt(c.price)}</b>.<br/>Uangmu: ${fmt(c.money)}</p>`,
      row: true,
      buttons: [
        { label: "💰 Akuisisi!", value: true, class: "pink" },
        { label: "Tidak", value: false, class: "white" },
      ],
    });
  }

  async chooseIslandAction(c: IslandChoice): Promise<"pay" | "roll"> {
    return modal({
      title: "💔 Terdampar di Pulau Jomblo",
      body: `<p>Sisa ${c.turnsLeft} giliran. Dapat dadu kembar untuk kabur, atau sewa perahu bebek dan move on.</p>`,
      buttons: [
        { label: `🦆 Sewa perahu bebek ${fmt(c.bail)}`, value: "pay" as const, class: "blue", disabled: !c.canPay },
        { label: "🎲 Coba dadu kembar", value: "roll" as const, class: "green" },
      ],
    });
  }

  async chooseTile(c: TileChoice): Promise<number> {
    this.hud.showPickBanner(c.purpose === "tour" ? "Klik petak tempat UFO menjatuhkanmu" : "Klik propertimu untuk Pesta Dangdut");
    try {
      return await this.scene.pickTile(c.options);
    } finally {
      this.hud.hidePickBanner();
    }
  }
}

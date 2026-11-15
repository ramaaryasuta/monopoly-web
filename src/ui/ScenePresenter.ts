import { Vector3 } from "@babylonjs/core";
import type { ItemUse, MessageKind, Presenter, TradeOffer } from "../core/interfaces";
import type { GameState } from "../core/types";
import { BOARD, GROUP_COLORS, GROUP_NAMES, PROPERTY_GROUPS } from "../data/board";
import { CONFIG, ownsGroup } from "../core/rules";
import { tilePosition } from "../scene/layout";
import { ITEMS, SEASON_ROUNDS, type Card, type ChaosEvent, type FunFx, type SeasonDef } from "../data/cards";
import type { GameScene } from "../scene/GameScene";
import { seasonSfx, sfx } from "../scene/sfx";
import { wait } from "../scene/tween";
import { escapeHtml, modal } from "./dom";
import type { Hud } from "./Hud";
import { cardSummary } from "./cardSummary";

/** Menjembatani event game logic → animasi 3D + HUD. */
export class ScenePresenter implements Presenter {
  /** Petak tempat Pesta Pejabat terakhir digelar (supaya suara pesta tidak diputar ulang). */
  private partyTile: number | null = null;

  constructor(
    private view: GameScene,
    private hud: Hud,
    private state: GameState,
    /** Pemain manusia yang dikendalikan di perangkat ini (online: bukan pemain jarak jauh). */
    private isLocalHuman: (pid: number) => boolean = (pid) => !state.players[pid].isBot,
  ) {
    this.setOwners = this.currentSetOwners(state);
  }

  /** Pemilik set lengkap per grup warna (null = belum ada), untuk mendeteksi set baru. */
  private setOwners: (number | null)[];

  private currentSetOwners(state: GameState) {
    return PROPERTY_GROUPS.map((tiles) => {
      const owner = state.tiles[tiles[0]].owner;
      return owner !== null && ownsGroup(state, owner, BOARD[tiles[0]].group!) ? owner : null;
    });
  }

  /** Samakan catatan set tanpa perayaan (mis. setelah riwayat online diputar ulang). */
  syncSets(state: GameState) {
    this.setOwners = this.currentSetOwners(state);
  }

  /** Rayakan setiap grup warna yang baru saja dikuasai penuh. */
  private async checkNewSets(state: GameState) {
    const now = this.currentSetOwners(state);
    const fresh = now.map((o, g) => (o !== null && o !== this.setOwners[g] ? g : -1)).filter((g) => g >= 0);
    this.setOwners = now;
    for (const g of fresh) await this.celebrateSet(state, now[g]!, g);
  }

  private async celebrateSet(state: GameState, pid: number, group: number) {
    const p = state.players[pid];
    const tiles = PROPERTY_GROUPS[group];
    const color = GROUP_COLORS[group];
    const center = tiles.reduce((acc, i) => acc.addInPlace(tilePosition(i)), new Vector3()).scaleInPlace(1 / tiles.length);
    const bonus = Math.round(CONFIG.setRentBonus * 100);
    this.hud.log(`👑 SET LENGKAP! ${p.name} menguasai semua wilayah grup ${GROUP_NAMES[group]} — sewanya +${bonus}%!`, "good");
    await this.view.focus(center.clone(), 22, 0.5);
    sfx.setComplete();
    this.hud.banner("👑 SET LENGKAP!", `${p.name} menguasai grup ${GROUP_NAMES[group]} · sewa +${bonus}%`, color);
    tiles.forEach((i, n) => {
      void wait(this.view.scene, n * 0.18).then(() => this.view.effects.emojiBurst(tilePosition(i).add(new Vector3(0, 1.4, 0)), n % 2 ? "⭐" : "👑", 5));
    });
    await this.view.board.celebrateSet(tiles, color);
    this.view.effects.confetti(center.add(new Vector3(0, 2, 0)));
    this.hud.speech(pid, pick(SET_SHOUT), true);
    void this.view.pawns[pid].cheer();
    await wait(this.view.scene, 0.9);
  }

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
    if (ts.festival && this.partyTile !== tile) {
      // Pesta Pejabat baru digelar di properti ini
      this.partyTile = tile;
      sfx.pejabat();
      const at = tilePosition(tile).add(new Vector3(0, 1.5, 0));
      this.view.effects.emojiBurst(at, "🥂", 6);
      this.view.effects.confetti(at);
    } else {
      if (!ts.festival && this.partyTile === tile) this.partyTile = null;
      if (ts.level > 0) sfx.build();
    }
    await this.view.board.updateTile(state, tile, true);
    this.hud.refresh();
    await this.checkNewSets(state);
  }

  message(text: string, kind: MessageKind = "info") {
    this.hud.log(text, kind);
    this.hud.toast(text, kind);
  }

  /** Nama paket (Shopee/Tokopedia/...) sesuai petak tempat pemain mendarat. */
  private packetName(player: number): string | undefined {
    const t = BOARD[this.state.players[player].position];
    return t?.kind === "chance" ? t.name : undefined;
  }

  async showCard(player: number, card: Card) {
    const bot = !this.isLocalHuman(player);
    const isItem = card.effect.type === "item";
    const sum = cardSummary(this.state, player, card);
    // Kartu 3D diambil dari tumpukan, terbang ke depan kamera, lalu dibuka
    await this.view.cards.draw({ icon: card.icon, title: card.title, text: card.text, kind: isItem ? "item" : "card", header: this.packetName(player) });
    await modal({
      title: card.title,
      className: "comic card-reveal",
      body:
        `<div class="comic-pow">${pick(POW)}</div><p>${card.text}</p>` +
        `<div class="card-effect ${sum.tone}"><b>${escapeHtml(sum.main)}</b>${sum.detail ? `<small>${escapeHtml(sum.detail)}</small>` : ""}</div>`,
      buttons: [{ label: isItem ? "🎒 Simpan!" : pick(OK_LABELS), value: 0, class: "green" }],
      autoCloseMs: bot ? 2000 : undefined,
    });
    // Kartu simpanan masuk ke pion; kartu biasa terbang menghilang
    await this.view.cards.dismiss(isItem ? this.view.pawns[player].root.position : undefined);
    if (card.fx) await this.view.funFx(card.fx, [player]);
    this.hud.speech(player, pick(card.fx === "cry" ? SAD : HAPPY));
  }

  async showEvent(ev: ChaosEvent, targets: number[]) {
    const names = targets.map((t) => this.state.players[t].name).join(", ");
    const partial = targets.length < this.state.players.filter((p) => !p.bankrupt).length;
    const allBots = this.state.players.every((p) => !this.isLocalHuman(p.id) || p.bankrupt);
    await this.view.goHome(0.5);
    // TV berita 3D jatuh dari langit & menyiarkan berita
    await this.view.events.show({ icon: ev.icon, headline: ev.headline, text: ev.text, sub: partial ? `Yang kena: ${names}` : undefined, kind: "event" });
    await modal({
      title: ev.headline,
      className: "comic breaking card-reveal",
      body: `<p>${ev.text}</p>${partial ? `<p class="victim">Yang kena: <b>${escapeHtml(names)}</b></p>` : ""}`,
      buttons: [{ label: pick(["Astaga!", "Waduh!", "Hah?!", "Ngakak 🤣"]), value: 0, class: "pink" }],
      autoCloseMs: allBots ? 2200 : 6000,
    });
    await this.view.events.hide();
    await this.view.funFx(ev.fx, targets);
  }

  async showSeason(season: SeasonDef, ended: boolean) {
    this.hud.refresh();
    if (ended) {
      seasonSfx.end();
      this.message(`${season.icon} ${season.headline.replace(/!$/, "")} sudah selesai. Pulau kembali normal.`);
      return;
    }
    const allBots = this.state.players.every((p) => !this.isLocalHuman(p.id) || p.bankrupt);
    await this.view.goHome(0.5);
    await this.view.events.show({ icon: season.icon, headline: season.headline, text: season.text, sub: `Berlaku ${SEASON_ROUNDS} ronde: ${season.badge}`, kind: "season", sting: seasonSfx[season.id] });
    await modal({
      title: season.headline,
      className: "comic breaking season card-reveal",
      body: `<p>${season.text}</p>`,
      buttons: [{ label: pick(["Siap!", "Wah!", "Gaskeun!", "Oke deh"]), value: 0, class: "blue" }],
      autoCloseMs: allBots ? 2200 : 6000,
    });
    await this.view.events.hide();
    await this.view.funFx(season.fx, this.state.players.filter((p) => !p.bankrupt).map((p) => p.id));
  }

  async itemUsed(player: number, use: ItemUse) {
    const def = ITEMS[use.item];
    this.hud.speech(player, `${def.icon} ${pick(ITEM_SHOUT)}`, true);
    // Kartu 3D muncul di atas pion lalu dilempar ke sasaran
    const from = this.view.pawns[player].root.position;
    let to = from;
    if (def.target === "player" && use.target !== null) to = this.view.pawns[use.target].root.position;
    if (def.target === "tile" && use.target !== null) to = this.view.board.tileCenter(use.target);
    await this.view.cards.throwItem({ icon: def.icon, title: def.name, text: def.text, kind: "item" }, from, to);
    const fx: Record<string, FunFx> = { sandal: "dizzy", utang: "cry", turbo: "duck", kecoak: "shake" };
    let targets = [player];
    if (def.target === "player" && use.target !== null) targets = [use.target];
    if (def.target === "tile" && use.target !== null) targets = [this.state.tiles[use.target].owner ?? player];
    await this.view.funFx(fx[use.item], targets);
    this.hud.refresh();
  }

  async marketChanged() {
    this.hud.refresh();
  }

  async tradeProposed(_state: GameState, offer: TradeOffer, round: number) {
    this.hud.speech(offer.from, pick(round === 0 ? DEAL_ASK : DEAL_COUNTER), true);
    sfx.click();
    // Beri waktu membaca balon sebelum modal jawaban muncul
    await wait(this.view.scene, 0.4);
  }

  async tradeResolved(_state: GameState, offer: TradeOffer, accepted: boolean) {
    this.hud.refresh();
    if (!accepted) {
      this.hud.speech(offer.to, pick(DEAL_NO), true);
      return;
    }
    sfx.coin();
    for (const pid of [offer.from, offer.to]) {
      this.view.effects.emojiBurst(this.view.pawns[pid].root.position.add(new Vector3(0, 1.5, 0)), "🤝", 5);
    }
    this.hud.speech(offer.to, pick(DEAL_YES), true);
    await wait(this.view.scene, 0.5);
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
const ITEM_SHOUT = ["Rasakan ini!", "Hiyaaat!", "Kejutan!", "Hehehe...", "Awas ya!"];
const POW = ["BOOM!", "WADUH!", "PLAK!", "BRRRT!", "GASS!", "ANJAY!", "DUAR!"];
const OK_LABELS = ["OK deh", "Pasrah 🙏", "Gaskeun!", "Yaudah lah", "Siap bos!"];
const HAPPY = ["Gaskeun! 🔥", "Rezeki anak soleh!", "Mantap jiwa!", "Sultan mah bebas 😎", "Hahaha kaya!", "Cuan cuan cuan!", "Traktir? Nggak."];
const SAD = ["Waduh...", "Dompetku menangis 😭", "Kok gitu sih?!", "Asem!", "Astagaa...", "Nangis di pojokan", "Gajian masih lama..."];
const DEAL_ASK = ["Deal, bos? 🤝", "Ada penawaran menarik nih!", "Bisa nego dong~", "Harga teman!"];
const DEAL_COUNTER = ["Kurang dikit lagi...", "Gimana kalau segini?", "Naikin dong! 😤", "Nego tipis-tipis"];
const DEAL_NO = ["Ogah! 🙅", "Mimpi kali!", "Nggak dulu deh", "Harga diri lebih mahal!"];
const SET_SHOUT = ["Satu komplek punyaku! 👑", "Tuan tanah sejati!", "Sewa naik, bos! 📈", "Komplit kayak nasi padang!", "Lunas semua, hehe"];
const DEAL_YES = ["Deal! 🤝", "Sepakat!", "Cuan bareng!", "Salaman dulu!"];

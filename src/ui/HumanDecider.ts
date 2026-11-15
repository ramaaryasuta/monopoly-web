import type {
  BuildChoice,
  DealAction,
  DealChoice,
  DebtAction,
  DebtChoice,
  Decider,
  IslandChoice,
  ItemChoice,
  ItemUse,
  TileChoice,
  TradeOffer,
  TradeReply,
  TradeReplyChoice,
} from "../core/interfaces";
import { flipOffer, sameOffer } from "../core/trade";
import { LEVEL_NAMES, rentFor } from "../core/rules";
import type { BuildLevel, GameState } from "../core/types";
import { BOARD, GROUP_COLORS } from "../data/board";
import { ITEMS } from "../data/cards";
import type { GameScene } from "../scene/GameScene";
import { fmt, h, modal } from "./dom";
import type { Hud } from "./Hud";
import { editOffer, marketMenu, offerView, pickTradeTarget } from "./TradeUi";

const LEVEL_ICON = ["", "🚩", "🏠", "🏠🏠", "🏡", "🗼"];

/** Keputusan pemain manusia lewat UI (modal, tombol, klik petak 3D). */
export class HumanDecider implements Decider {
  constructor(
    private state: GameState,
    private hud: Hud,
    private scene: GameScene,
    /** Online: kursi yang dimainkan di perangkat ini (null = main bareng satu perangkat). */
    private localSeats: number[] | null = null,
  ) {}

  /** Beberapa manusia bergantian di perangkat ini → tunjukkan untuk siapa dialognya. */
  private get hotseat() {
    const humans = this.localSeats ?? this.state.players.filter((p) => !p.isBot).map((p) => p.id);
    return humans.filter((id) => !this.state.players[id].bankrupt && !this.state.players[id].isBot).length > 1;
  }

  /** Tombol dadu sudah diklik saat menawarkan kartu simpanan → jangan tunggu lagi. */
  private rollAlreadyClicked = false;
  /** Menu awal giliran: dadu diklik → jangan tawarkan kantong lagi. */
  private skipItemMenu = false;
  /** Menu awal giliran: tombol kantong diklik → langsung buka kantong. */
  private openItemMenu = false;

  async chooseDeal(c: DealChoice): Promise<DealAction | null> {
    this.rollAlreadyClicked = false;
    this.skipItemMenu = false;
    this.openItemMenu = false;
    for (;;) {
      const action = await this.hud.waitTurnMenu({
        items: c.hasItems ? this.state.players[c.player].items.length : 0,
        tradesLeft: c.tradesLeft,
        rollLabel: c.inIsland ? "⛓️ LANJUT" : "🎲 LEMPAR DADU",
      });
      if (action === "roll") {
        this.rollAlreadyClicked = true;
        this.skipItemMenu = true;
        return null;
      }
      if (action === "item") {
        this.openItemMenu = true;
        return null;
      }
      if (action === "market") {
        const deal = await marketMenu(this.state, c.player);
        if (deal) return deal;
        continue;
      }
      const target = await pickTradeTarget(this.state, c.player);
      if (target === null) continue;
      const draft: TradeOffer = { from: c.player, to: target, giveTiles: [], giveMoney: 0, takeTiles: [], takeMoney: 0 };
      const offer = await editOffer(this.state, draft, `🤝 Tawaran ke ${this.state.players[target].name}`);
      if (offer) return { type: "trade", offer };
    }
  }

  async respondTrade(c: TradeReplyChoice): Promise<TradeReply> {
    const o = c.offer;
    const from = this.state.players[o.from];
    const me = this.state.players[c.player];
    // Main bareng satu perangkat: tunjukkan untuk siapa tawaran ini
    const hotseat = this.hotseat;
    for (;;) {
      const v = await modal<"accept" | "counter" | "reject">({
        title: `🤝 ${c.round === 0 ? "Tawaran" : "Tawar balik"} dari ${from.name}`,
        className: "trade-modal",
        body: h("div", {}, hotseat ? h("p", { class: "for-who" }, `Untuk ${me.name} 👀`) : null, offerView(this.state, o)),
        row: true,
        buttons: [
          { label: "✅ Terima", value: "accept", class: "green" },
          ...(c.canCounter ? [{ label: "🔁 Tawar Balik", value: "counter" as const, class: "blue" }] : []),
          { label: "❌ Tolak", value: "reject", class: "white" },
        ],
      });
      if (v !== "counter") return { type: v };
      const counter = await editOffer(this.state, flipOffer(o), `🔁 Tawar balik ke ${from.name}`);
      if (!counter) continue;
      // Tawar balik yang isinya sama persis = menerima
      if (sameOffer(counter, flipOffer(o))) return { type: "accept" };
      return { type: "counter", offer: counter };
    }
  }

  async waitForRoll(): Promise<void> {
    if (this.rollAlreadyClicked) {
      this.rollAlreadyClicked = false;
      return;
    }
    await this.hud.waitRollButton();
  }

  async chooseItem(c: ItemChoice): Promise<ItemUse | null> {
    const count = this.state.players[c.player].items.length;
    if (this.skipItemMenu) {
      this.skipItemMenu = false;
      return null;
    }
    let direct = this.openItemMenu;
    this.openItemMenu = false;
    for (;;) {
      const action = direct ? "item" : await this.hud.waitRollOrItem(count);
      direct = false;
      if (action === "roll") {
        this.rollAlreadyClicked = true;
        return null;
      }
      const picked = await modal<ItemChoice["usable"][number] | null>({
        title: "🎒 Kantong Ajaib",
        body: "<p>Pakai satu kartu sebelum lempar dadu.</p>",
        buttons: [
          ...c.usable.map((u) => ({ label: `${ITEMS[u.item].icon} ${ITEMS[u.item].name}`, sub: ITEMS[u.item].text, value: u, class: "pink" })),
          { label: "Batal", value: null, class: "white" },
        ],
      });
      if (!picked) continue;
      const def = ITEMS[picked.item];
      if (def.target === null) return { item: picked.item, target: null };
      if (def.target === "player") {
        const target = await modal<number | null>({
          title: `${def.icon} Sasaran ${def.name}`,
          body: `<p>${def.text}</p>`,
          buttons: [
            ...picked.targets.map((pid) => {
              const p = this.state.players[pid];
              return { label: p.name, sub: `${fmt(p.money)}`, value: pid as number | null, class: "blue" };
            }),
            { label: "Batal", value: null, class: "white" },
          ],
        });
        if (target === null) continue;
        return { item: picked.item, target };
      }
      this.hud.showPickBanner(`Klik bangunan lawan yang karyawannya mau dibikin resign ${def.icon}`);
      try {
        const tile = await this.scene.pickTile(picked.targets);
        return { item: picked.item, target: tile };
      } finally {
        this.hud.hidePickBanner();
      }
    }
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
    const all = [
      ...c.options.map((o) => ({ ...o, ok: true })),
      ...(c.unaffordable ?? []).map((o) => ({ ...o, ok: false })),
    ].sort((a, b) => a.level - b.level);
    const buttons = all.map((o) => ({
      label: isResort ? `🌴 Beli Wisata — ${fmt(o.cost)}` : `${LEVEL_ICON[o.level]} ${LEVEL_NAMES[o.level]} — ${fmt(o.cost)}`,
      sub: o.ok ? `sewa ${fmt(this.rentAt(c.tile, c.player, o.level))}` : `💸 uang kurang ${fmt(o.cost - c.money)}`,
      value: o.level,
      class: o.level === 5 ? "pink" : "green",
      disabled: !o.ok,
    }));
    const noneAffordable = c.options.length === 0;
    buttons.push({ label: noneAffordable ? "Oke, lewati" : "Lewati", sub: "", value: c.currentLevel, class: "white", disabled: false });
    const levelText = c.currentLevel > 0 ? `Saat ini: <b>${LEVEL_NAMES[c.currentLevel]}</b>. ` : "";
    return modal({
      title,
      bandColor: def.group !== undefined ? GROUP_COLORS[def.group] : "#36d1c4",
      body: `<p>${levelText}Uangmu: <b>${fmt(c.money)}</b></p>`,
      buttons,
    });
  }

  async chooseDebt(c: DebtChoice): Promise<DebtAction> {
    const me = this.state.players[c.player];
    const to = c.creditor === null ? "bank" : this.state.players[c.creditor].name;
    const short = c.amount - c.money;
    const totalSell = c.tiles.reduce((s, t) => s + t.value, 0);
    const hopeless = c.money + totalSell < c.amount;
    const hotseat = this.hotseat;
    const canTrade = c.tradesLeft > 0 && this.state.players.some((p) => p.id !== c.player && !p.bankrupt);
    for (;;) {
      const v = await modal<DebtAction | "trade">({
        title: "💸 Uangnya kurang!",
        className: "debt-modal",
        body: h(
          "div",
          {},
          hotseat ? h("p", { class: "for-who" }, `Untuk ${me.name} 👀`) : null,
          h("p", { html: `Harus bayar <b>${fmt(c.amount)}</b> ke <b>${to}</b>. Uangmu <b>${fmt(c.money)}</b>, kurang <b>${fmt(short)}</b>.` }),
          h(
            "p",
            { class: "debt-hint" },
            hopeless
              ? `⚠️ Walau semua dijual ke bank (+${fmt(totalSell)}) masih kurang. Coba nego jual ke pemain lain, atau menyerah.`
              : "Jual wilayah ke bank (50% nilai investasi), atau nego jual ke pemain lain biar dapat harga lebih bagus.",
          ),
        ),
        buttons: [
          ...c.tiles.map((t) => {
            const def = BOARD[t.tile];
            const lvl = def.kind === "resort" ? "Wisata" : LEVEL_NAMES[this.state.tiles[t.tile].level];
            return {
              label: `🏦 Jual ${def.name} — +${fmt(t.value)}`,
              sub: lvl,
              value: { type: "sell", tile: t.tile } as DebtAction | "trade",
              class: "orange",
            };
          }),
          {
            label: canTrade ? `🤝 Nego jual ke pemain (sisa ${c.tradesLeft}x)` : "🤝 Jatah nego habis",
            value: "trade" as const,
            class: "blue",
            disabled: !canTrade,
          },
          { label: "🏳️ Menyerah (bangkrut)", value: { type: "giveUp" } as DebtAction, class: "white" },
        ],
      });
      if (v === "trade") {
        const target = await pickTradeTarget(this.state, c.player);
        if (target === null) continue;
        const draft: TradeOffer = { from: c.player, to: target, giveTiles: [], giveMoney: 0, takeTiles: [], takeMoney: 0 };
        const offer = await editOffer(this.state, draft, `🤝 Jual ke ${this.state.players[target].name}`);
        if (offer) return { type: "trade", offer };
        continue;
      }
      if (v.type === "giveUp") {
        const sure = await modal({
          title: "🏳️ Yakin menyerah?",
          body: `<p>${me.name} akan bangkrut dan semua wilayahnya kembali ke bank.</p>`,
          row: true,
          buttons: [
            { label: "Batal", value: false, class: "white" },
            { label: "Ya, bangkrut", value: true, class: "pink" },
          ],
        });
        if (!sure) continue;
      }
      return v;
    }
  }

  async chooseIslandAction(c: IslandChoice): Promise<"pay" | "roll"> {
    return modal({
      title: "⛓️ Dipenjara di Nusakambangan",
      body: `<p>Sisa ${c.turnsLeft} giliran. Dapatkan dadu kembar untuk kabur, atau sogok sipir biar langsung bebas.</p>`,
      buttons: [
        { label: `💰 Sogok sipir ${fmt(c.bail)}`, value: "pay" as const, class: "blue", disabled: !c.canPay },
        { label: "🎲 Coba dapat dadu kembar", value: "roll" as const, class: "green" },
      ],
    });
  }

  async chooseTile(c: TileChoice): Promise<number> {
    this.hud.showPickBanner(c.purpose === "tour" ? "Klik petak tujuan pesawat negara" : "Klik propertimu untuk Pesta Pejabat");
    try {
      return await this.scene.pickTile(c.options);
    } finally {
      this.hud.hidePickBanner();
    }
  }
}

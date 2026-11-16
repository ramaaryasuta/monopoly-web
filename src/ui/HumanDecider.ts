import type {
  BuildChoice,
  DealAction,
  DealChoice,
  DebtAction,
  DebtChoice,
  Decider,
  IslandChoice,
  ShieldChoice,
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
import { editOffer, focusMap, mapForButtons, marketMenu, offerView, pickTradeTarget } from "./TradeUi";
import { Lang } from "../lang/id";

const LEVEL_ICON = ["", "🚩", "🏠", "🏠🏠", "🏡", "🗼"];

/** Harga tidak boleh terpotong ganti baris ("Rp200 / jt"). */
const nbsp = (s: string) => s.replace(/ /g, " ");

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
        rollLabel: c.inIsland ? Lang.human.continue : Lang.hud.roll,
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
      const offer = await editOffer(this.state, draft, Lang.human.offerTo(this.state.players[target].name));
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
        title: Lang.human.offerFrom(c.round === 0, from.name),
        className: "trade-modal",
        body: h("div", {}, hotseat ? h("p", { class: "for-who" }, Lang.human.forWho(me.name)) : null, offerView(this.state, o)),
        row: true,
        buttons: [
          { label: Lang.human.accept, value: "accept", class: "green" },
          ...(c.canCounter ? [{ label: Lang.human.counterBtn, value: "counter" as const, class: "blue" }] : []),
          { label: Lang.human.reject, value: "reject", class: "white" },
        ],
      });
      if (v !== "counter") return { type: v };
      const counter = await editOffer(this.state, flipOffer(o), Lang.human.counterTo(from.name));
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
        title: Lang.human.bag,
        body: Lang.human.bagHint,
        buttons: [
          ...c.usable.map((u) => ({ label: `${ITEMS[u.item].icon} ${ITEMS[u.item].name}`, sub: ITEMS[u.item].text, value: u, class: "pink" })),
          { label: Lang.common.cancel, value: null, class: "white" },
        ],
      });
      if (!picked) continue;
      const def = ITEMS[picked.item];
      if (def.target === null) return { item: picked.item, target: null };
      if (def.target === "player") {
        const target = await modal<number | null>({
          title: Lang.human.target(def.icon, def.name),
          body: `<p>${def.text}</p>`,
          buttons: [
            ...picked.targets.map((pid) => {
              const p = this.state.players[pid];
              return { label: p.name, sub: `${fmt(p.money)}`, value: pid as number | null, class: "blue" };
            }),
            { label: Lang.common.cancel, value: null, class: "white" },
          ],
        });
        if (target === null) continue;
        return { item: picked.item, target };
      }
      this.hud.showPickBanner(Lang.human.pickResign(def.icon));
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
    const title = c.currentLevel === 0 ? Lang.human.buyQ(def.name) : Lang.human.buildQ(def.name);
    const all = [
      ...c.options.map((o) => ({ ...o, ok: true })),
      ...(c.unaffordable ?? []).map((o) => ({ ...o, ok: false })),
    ].sort((a, b) => a.level - b.level);
    const buttons = all.map((o) => ({
      label: isResort ? Lang.human.buyResort(nbsp(fmt(o.cost))) : `${LEVEL_ICON[o.level]} ${LEVEL_NAMES[o.level]} — ${nbsp(fmt(o.cost))}`,
      sub: o.ok
        ? Lang.human.rentLeft(fmt(this.rentAt(c.tile, c.player, o.level)), fmt(c.money - o.cost))
        : Lang.human.moneyShort(fmt(o.cost - c.money)),
      value: o.level,
      class: o.level === 5 ? "pink" : "green",
      disabled: !o.ok,
    }));
    const noneAffordable = c.options.length === 0;
    buttons.push({ label: noneAffordable ? Lang.human.skipOk : Lang.human.skip, sub: "", value: c.currentLevel, class: "white", disabled: false });
    const levelText = c.currentLevel > 0 ? Lang.human.currentLevel(LEVEL_NAMES[c.currentLevel]) : "";
    const lapNote = c.firstLap ? Lang.human.lapNote : "";
    return modal({
      title,
      bandColor: def.group !== undefined ? GROUP_COLORS[def.group] : "#36d1c4",
      body: Lang.human.buyBody(levelText, fmt(c.money), lapNote),
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
    type V = DebtAction | "trade" | { type: "pickDown"; tile: number };
    const debtTiles = [...new Set([...(c.downgrades ?? []).map((d) => d.tile), ...c.tiles.map((t) => t.tile)])];
    for (;;) {
      const v = await modal<V>({
        title: Lang.human.debtTitle,
        className: "debt-modal",
        ...mapForButtons(this.state, debtTiles, h(
          "div",
          {},
          hotseat ? h("p", { class: "for-who" }, Lang.human.forWho(me.name)) : null,
          h("p", { html: Lang.human.debtBody(fmt(c.amount), to, fmt(c.money), fmt(short)) }),
          h(
            "p",
            { class: "debt-hint" },
            hopeless
              ? Lang.human.sellAllShort(fmt(totalSell))
              : Lang.human.debtHelp,
          ),
        )),
        buttons: [
          ...(c.downgrades ?? []).map((d) => {
            const def = BOARD[d.tile];
            const best = d.options[d.options.length - 1];
            return {
              label: Lang.human.downgradeMax(def.name, fmt(best.value)),
              sub: `${LEVEL_NAMES[d.level]} → ?`,
              value: { type: "pickDown", tile: d.tile } as V,
              class: "green",
              tile: d.tile,
            };
          }),
          ...c.tiles.map((t) => {
            const def = BOARD[t.tile];
            const lvl = def.kind === "resort" ? Lang.hud.resortWord : LEVEL_NAMES[this.state.tiles[t.tile].level];
            return {
              label: Lang.human.sellTile(def.name, fmt(t.value)),
              sub: lvl,
              value: { type: "sell", tile: t.tile } as V,
              class: "orange",
              tile: t.tile,
            };
          }),
          {
            label: canTrade ? Lang.human.negoSell(c.tradesLeft) : Lang.human.negoUsed,
            value: "trade" as V,
            class: "blue",
            disabled: !canTrade,
          },
          { label: Lang.human.giveUp, value: { type: "giveUp" } as V, class: "white" },
        ],
      });
      if (v !== "trade" && v.type === "pickDown") {
        const d = c.downgrades.find((x) => x.tile === v.tile)!;
        const def = BOARD[d.tile];
        const level = await modal<number | null>({
          title: Lang.human.downgrade(def.name),
          body: h(
            "div",
            {},
            hotseat ? h("p", { class: "for-who" }, Lang.human.forWho(me.name)) : null,
            focusMap(this.state, d.tile),
            h("p", {
              html: Lang.human.downgradeBody(LEVEL_NAMES[d.level], fmt(short)),
            }),
          ),
          buttons: [
            ...d.options.map((o) => ({
              label: Lang.human.becomes(LEVEL_NAMES[o.level], fmt(o.value)),
              sub: o.value >= short ? Lang.human.enough : "",
              value: o.level as number | null,
              class: o.value >= short ? "green" : "orange",
            })),
            { label: Lang.human.back, value: null, class: "white" },
          ],
        });
        if (level === null) continue;
        return { type: "downgrade", tile: d.tile, level };
      }
      if (v === "trade") {
        const target = await pickTradeTarget(this.state, c.player);
        if (target === null) continue;
        const draft: TradeOffer = { from: c.player, to: target, giveTiles: [], giveMoney: 0, takeTiles: [], takeMoney: 0 };
        const offer = await editOffer(this.state, draft, Lang.human.sellTo(this.state.players[target].name));
        if (offer) return { type: "trade", offer };
        continue;
      }
      if (v.type === "giveUp") {
        const sure = await modal({
          title: Lang.human.sure,
          body: Lang.human.giveUpBody(me.name),
          row: true,
          buttons: [
            { label: Lang.human.cancel, value: false, class: "white" },
            { label: Lang.human.yesBankrupt, value: true, class: "pink" },
          ],
        });
        if (!sure) continue;
      }
      return v;
    }
  }

  async chooseIslandAction(c: IslandChoice): Promise<"pay" | "roll"> {
    return modal({
      title: Lang.human.jailTitle,
      body: Lang.human.jailBody(c.turnsLeft),
      buttons: [
        { label: Lang.human.bribe(fmt(c.bail)), value: "pay" as const, class: "blue", disabled: !c.canPay },
        { label: Lang.human.tryDouble, value: "roll" as const, class: "green" },
      ],
    });
  }

  async chooseShield(c: ShieldChoice): Promise<boolean> {
    const owner = this.state.players[c.owner].name;
    return modal({
      title: Lang.human.shieldTitle,
      body: Lang.human.shieldBody(fmt(c.rent), BOARD[c.tile].name, owner),
      buttons: [
        { label: Lang.human.shieldUse, value: true, class: "green" },
        { label: Lang.human.shieldPay(fmt(c.rent)), value: false, class: "white" },
      ],
    });
  }

  async chooseTile(c: TileChoice): Promise<number> {
    this.hud.showPickBanner(c.purpose === "tour" ? Lang.human.pickTour : Lang.human.pickFestival);
    try {
      return await this.scene.pickTile(c.options);
    } finally {
      this.hud.hidePickBanner();
    }
  }
}

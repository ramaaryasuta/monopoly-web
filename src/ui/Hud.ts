import type { MessageKind } from "../core/interfaces";
import { CONFIG, investedValue, LEVEL_NAMES, netWorth, ownedTiles, rentFor, upgradeCost, WIN_TEXT } from "../core/rules";
import type { GameState } from "../core/types";
import { BOARD, GROUP_COLORS } from "../data/board";
import { ITEMS, SEASONS } from "../data/cards";
import { sfx } from "../scene/sfx";
import { Speed } from "../scene/tween";
import { activeListings, listingFor } from "../core/trade";
import { escapeHtml, fmt, h, modal, uiRoot } from "./dom";
import { settingsButton } from "./SettingsMenu";
import { viewMarket } from "./TradeUi";
import { Lang } from "../lang/id";

export const AVATARS = ["🥔", "👾", "🌶️", "🥒", "🐳", "🐱"];

const KIND_LABEL: Record<string, string> = Lang.hud.kindLabel;

const TILE_HELP: Record<string, string> = {
  start: Lang.hud.tileHelp.start(fmt(CONFIG.salary)),
  chance: Lang.hud.tileHelp.chance,
  tax: Lang.hud.tileHelp.tax(CONFIG.taxRate * 100, fmt(50)),
  island: Lang.hud.tileHelp.island(CONFIG.islandTurns, fmt(CONFIG.islandBail)),
  festival: Lang.hud.tileHelp.festival(CONFIG.festivalMultiplier),
  tour: Lang.hud.tileHelp.tour(fmt(CONFIG.tourFee)),
};

export class Hud {
  private cards: HTMLElement[] = [];
  private displayedMoney: number[] = [];
  private round = h("div", { class: "round-badge panel" });
  private logBox = h("div", { class: "entries" });
  private toasts = h("div", { class: "toasts" });
  private actionBar = h("div", { class: "action-bar" });
  private pickBanner: HTMLElement | null = null;
  private toolbar = h("div", { class: "toolbar" });
  private marketBtn = h("button", { class: "btn small white market-btn", title: Lang.hud.market, "data-testid": "market" }, "🏪");
  /** Untuk memproyeksikan teks uang melayang di atas pion. */
  screenPosOfPlayer: ((pid: number) => { x: number; y: number } | null) | null = null;
  onResetCamera: (() => void) | null = null;

  constructor(
    private state: GameState,
    private characterIdx: number[],
    /** Online: pemain yang dikendalikan perangkat ini (diberi tanda ⭐). */
    private localPlayers: number[] | null = null,
  ) {
    const root = uiRoot();
    // Online: pemain di perangkat ini selalu di kiri atas, sisanya searah jarum jam
    // mengikuti urutan main — jadi posisi tidak berubah-ubah antar perangkat.
    const n = state.players.length;
    const me = localPlayers?.[0] ?? null;
    state.players.forEach((p, i) => {
      const slot = me === null ? (i + 3) % 4 : (i - me + n) % n;
      const card = h(
        "div",
        { class: `player-card panel slot${slot}`, "data-testid": `player-${i}` },
        h("div", { class: "turn-tag now" }, Lang.hud.turnNow),
        h("div", { class: "turn-tag next" }, Lang.hud.turnNext),
        h("div", { class: "avatar", style: `background:${p.color}` }, AVATARS[characterIdx[i]]),
        h(
          "div",
          { class: "info" },
          h("div", { class: "name" }, this.nameLabel(i)),
          h("div", { class: "money" }, fmt(p.money)),
          h("div", { class: "meta" }),
        ),
      );
      this.cards.push(card);
      this.displayedMoney.push(p.money);
      root.append(card);
    });

    const log = h("div", { class: "log panel" }, h("h4", {}, h("span", {}, Lang.hud.log), h("span", {}, "▾")), this.logBox);
    log.querySelector("h4")!.addEventListener("click", () => log.classList.toggle("collapsed"));

    const speedBtn = h("button", { class: "btn small white", title: Lang.hud.animSpeed }, `⏩ ${Speed.factor}x`);
    speedBtn.addEventListener("click", () => {
      const steps = [1, 2, 3];
      Speed.factor = steps[(steps.indexOf(Speed.factor) + 1) % steps.length] ?? 1;
      speedBtn.textContent = `⏩ ${Speed.factor}x`;
    });
    const camBtn = h("button", { class: "btn small white", title: Lang.hud.resetCam }, "🎥");
    camBtn.addEventListener("click", () => this.onResetCamera?.());
    this.marketBtn.addEventListener("click", () => {
      sfx.click();
      void viewMarket(this.state, this.localPlayers?.[0] ?? null);
    });
    this.toolbar.append(speedBtn, camBtn, this.marketBtn, settingsButton());

    root.append(this.round, this.toolbar, log, this.toasts, this.actionBar);
    this.refresh();
  }

  /** Online: tombol 🤝 di toolbar untuk menawar kapan saja (tidak harus giliran sendiri). */
  enableAnytimeTrade(onClick: () => void) {
    const btn = h("button", { class: "btn small blue anytime-trade", title: Lang.hud.tradeAnytime, "data-testid": "anytime-trade" }, Lang.hud.nego);
    btn.addEventListener("click", () => {
      sfx.click();
      onClick();
    });
    this.toolbar.append(btn);
  }

  // ------------------------------------------------------------------ player cards

  /** Lingkaran hijau di avatar saat pemain berbicara di voice chat. */
  setSpeaking(pid: number, on: boolean) {
    this.cards[pid]?.classList.toggle("speaking", on);
  }

  refresh() {
    const s = this.state;
    const season = s.season ? SEASONS[s.season.id] : null;
    const left = s.season ? s.season.untilRound - s.round + 1 : 0;
    this.round.textContent = Lang.hud.roundLabel(s.round, CONFIG.roundLimit) + (season ? Lang.hud.seasonLabel(season.icon, season.badge, left) : "");
    this.round.classList.toggle("season", !!season);
    const listed = activeListings(s).length;
    this.marketBtn.replaceChildren("🏪", listed ? h("span", { class: "badge" }, String(listed)) : "");
    const playing = s.winner === null;
    let next = -1;
    if (playing) {
      for (let k = 1; k < s.players.length; k++) {
        const j = (s.current + k) % s.players.length;
        if (!s.players[j].bankrupt) { next = j; break; }
      }
    }
    s.players.forEach((p, i) => {
      const card = this.cards[i];
      card.classList.toggle("active", playing && s.current === i);
      card.classList.toggle("next", playing && next === i && next !== s.current);
      card.classList.toggle("bankrupt", p.bankrupt);
      const meta: string[] = [`🏠 ${ownedTiles(s, i).length}`, `💎 ${fmt(netWorth(s, i))}`];
      if (p.shields) meta.push(`🛡️${p.shields}`);
      if (p.items.length) meta.push(`🎒${p.items.map((it) => ITEMS[it].icon).join("")}`);
      if (p.islandTurns) meta.push(`🏝️${p.islandTurns}`);
      if (p.pendingTour) meta.push("✈️");
      if (p.bankrupt) meta.splice(0, meta.length, Lang.hud.bankruptTag);
      card.querySelector(".meta")!.textContent = meta.join("  ");
    });
  }

  /** Animasi angka uang berjalan. */
  animateMoney(pid: number) {
    const target = this.state.players[pid].money;
    const el = this.cards[pid].querySelector(".money")!;
    const from = this.displayedMoney[pid];
    this.displayedMoney[pid] = target;
    const start = performance.now();
    const dur = 600;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = fmt(Math.round(from + (target - from) * t));
      if (t < 1 && this.displayedMoney[pid] === target) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  floatMoney(pid: number, delta: number) {
    const pos = this.screenPosOfPlayer?.(pid);
    const rect = this.cards[pid].getBoundingClientRect();
    const x = pos?.x ?? rect.left + rect.width / 2;
    const y = pos?.y ?? rect.top;
    const e = h(
      "div",
      { class: `float-money ${delta >= 0 ? "plus" : "minus"}`, style: `left:${x}px;top:${y}px` },
      `${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))}`,
    );
    uiRoot().append(e);
    setTimeout(() => e.remove(), 1500);
  }

  // ------------------------------------------------------------------ messages

  log(text: string, kind: MessageKind = "info") {
    const e = h("div", { class: `entry ${kind}` }, text);
    this.logBox.prepend(e);
    while (this.logBox.children.length > 60) this.logBox.lastChild!.remove();
  }

  toast(text: string, kind: MessageKind = "info") {
    const t = h("div", { class: `toast ${kind}` }, text);
    this.toasts.append(t);
    while (this.toasts.children.length > 3) this.toasts.firstChild!.remove();
    setTimeout(() => t.remove(), 3100);
  }

  private lastSpeech: number[] = [];

  /** Balon ucapan konyol di atas kepala pion. */
  speech(pid: number, text: string, force = false) {
    const now = performance.now();
    if (!force && now - (this.lastSpeech[pid] ?? 0) < 1800) return;
    this.lastSpeech[pid] = now;
    const pos = this.screenPosOfPlayer?.(pid);
    if (!pos) return;
    const e = h("div", { class: "speech", style: `left:${pos.x}px;top:${pos.y}px` }, text);
    uiRoot().append(e);
    setTimeout(() => e.remove(), 2200);
  }

  /** Spanduk besar di tengah layar (mis. set lengkap). */
  banner(title: string, sub: string, color: string) {
    const e = h(
      "div",
      { class: "set-banner", style: `--group:${color}` },
      h("div", { class: "set-title" }, title),
      h("div", { class: "set-sub" }, sub),
    );
    uiRoot().append(e);
    setTimeout(() => e.remove(), 2700);
  }

  showDiceResult(d1: number, d2: number) {
    const e = h("div", { class: "dice-result" }, `${d1} + ${d2} = ${d1 + d2}${d1 === d2 ? " 🎯" : ""}`);
    uiRoot().append(e);
    setTimeout(() => e.remove(), 1200);
  }

  private nameLabel(pid: number) {
    const p = this.state.players[pid];
    return (this.localPlayers?.includes(pid) ? "⭐ " : "") + p.name + (p.isBot ? " 🤖" : "");
  }

  /** Perbarui label nama (mis. pemain online terputus lalu diambil alih bot). */
  refreshName(pid: number) {
    const el = this.cards[pid]?.querySelector(".name");
    if (el) el.textContent = this.nameLabel(pid);
  }

  // ------------------------------------------------------------------ actions

  setTurnLabel(text: string | null) {
    this.actionBar.querySelector(".turn-label")?.remove();
    if (text) this.actionBar.prepend(h("div", { class: "turn-label" }, text));
  }

  waitRollButton(label = Lang.hud.roll): Promise<void> {
    return new Promise((resolve) => {
      const btn = h("button", { class: "btn roll-btn", "data-testid": "roll" }, label);
      const go = () => {
        window.removeEventListener("keydown", onKey);
        btn.remove();
        sfx.click();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if ((e.code === "Space" || e.code === "Enter") && !document.querySelector(".modal-backdrop")) {
          e.preventDefault();
          go();
        }
      };
      btn.addEventListener("click", go);
      window.addEventListener("keydown", onKey);
      this.actionBar.append(btn);
    });
  }

  /** Tombol lempar dadu + tombol buka kantong kartu simpanan. */
  waitRollOrItem(count: number): Promise<"roll" | "item"> {
    return new Promise((resolve) => {
      const roll = h("button", { class: "btn roll-btn", "data-testid": "roll" }, Lang.hud.roll);
      const item = h("button", { class: "btn pink item-btn", "data-testid": "use-item" }, Lang.hud.useCard(count));
      const row = h("div", { class: "roll-row" }, roll, item);
      const done = (v: "roll" | "item") => {
        window.removeEventListener("keydown", onKey);
        row.remove();
        sfx.click();
        resolve(v);
      };
      const onKey = (e: KeyboardEvent) => {
        if ((e.code === "Space" || e.code === "Enter") && !document.querySelector(".modal-backdrop")) {
          e.preventDefault();
          done("roll");
        }
      };
      roll.addEventListener("click", () => done("roll"));
      item.addEventListener("click", () => done("item"));
      window.addEventListener("keydown", onKey);
      this.actionBar.append(row);
    });
  }

  /** Menu awal giliran: lempar dadu, kantong, negosiasi, pasar. */
  waitTurnMenu(o: { items: number; tradesLeft: number; rollLabel: string }): Promise<"roll" | "item" | "trade" | "market"> {
    return new Promise((resolve) => {
      type A = "roll" | "item" | "trade" | "market";
      const roll = h("button", { class: "btn roll-btn", "data-testid": "roll" }, o.rollLabel);
      const extras = h("div", { class: "turn-extras" });
      const row = h("div", { class: "turn-menu" }, roll, extras);
      const done = (v: A) => {
        window.removeEventListener("keydown", onKey);
        row.remove();
        sfx.click();
        resolve(v);
      };
      const add = (label: string, cls: string, v: A, testid: string, disabled = false) => {
        const b = h("button", { class: `btn ${cls} turn-btn`, "data-testid": testid, disabled }, label);
        b.addEventListener("click", () => done(v));
        extras.append(b);
      };
      if (o.items > 0) add(Lang.hud.cards(o.items), "pink", "item", "use-item");
      add(o.tradesLeft > 0 ? Lang.hud.trade : Lang.hud.tradeUsed, "blue", "trade", "trade", o.tradesLeft <= 0);
      const listed = activeListings(this.state).length;
      add(listed ? Lang.hud.marketCount(listed) : Lang.hud.marketBtn, "orange", "market", "market-act");
      const onKey = (e: KeyboardEvent) => {
        if ((e.code === "Space" || e.code === "Enter") && !document.querySelector(".modal-backdrop")) {
          e.preventDefault();
          done("roll");
        }
      };
      roll.addEventListener("click", () => done("roll"));
      window.addEventListener("keydown", onKey);
      this.actionBar.append(row);
    });
  }

  showPickBanner(text: string) {
    this.hidePickBanner();
    this.pickBanner = h("div", { class: "pick-banner panel" }, `👆 ${text}`);
    uiRoot().append(this.pickBanner);
  }

  hidePickBanner() {
    this.pickBanner?.remove();
    this.pickBanner = null;
  }

  // ------------------------------------------------------------------ tile info

  async showTileInfo(index: number) {
    const s = this.state;
    const def = BOARD[index];
    const ts = s.tiles[index];
    const owner = ts.owner !== null ? s.players[ts.owner] : null;
    let body = `<p><b>${KIND_LABEL[def.kind]}</b></p>`;
    if (def.kind === "property") {
      const rows = [1, 2, 3, 4, 5]
        .map((l) => {
          const fake = structuredClone(s);
          fake.tiles[index] = { owner: ts.owner ?? 0, level: l as 1, festival: ts.festival };
          return Lang.hud.levelRow(ts.level === l ? "current" : "", LEVEL_NAMES[l], fmt(upgradeCost(index, l - 1, l)), fmt(rentFor(fake, index)));
        })
        .join("");
      body += `<table>${rows}</table>`;
    } else if (def.kind === "resort") {
      body += Lang.hud.resortInfo(fmt(def.price!), fmt(CONFIG.resortBaseRent));
    } else {
      body += `<p>${TILE_HELP[def.kind] ?? ""}</p>`;
    }
    if (owner) {
      body += Lang.hud.ownerInfo(owner.color, escapeHtml(owner.name), def.kind === "resort" ? Lang.hud.resortWord : LEVEL_NAMES[ts.level], fmt(rentFor(s, index)), ts.festival ? Lang.hud.festivalTag : "", fmt(investedValue(s, index)));
    } else if (def.kind === "property" || def.kind === "resort") {
      body += Lang.hud.unowned;
    }
    const listing = listingFor(s, index);
    if (listing) body += Lang.hud.listedInMarket(fmt(listing.price));
    await modal({
      title: def.name,
      bandColor: def.kind === "property" ? GROUP_COLORS[def.group!] : undefined,
      body,
      buttons: [{ label: Lang.common.close, value: 0, class: "white" }],
    });
  }

  // ------------------------------------------------------------------ game over

  async showGameOver() {
    const s = this.state;
    const winner = s.players[s.winner!];
    const ranking = [...s.players].sort((a, b) => netWorth(s, b.id) - netWorth(s, a.id));
    const list = h("div", { class: "ranking" });
    ranking.forEach((p, i) => {
      list.append(
        h(
          "div",
          { class: "rank" },
          h("span", {}, ["🥇", "🥈", "🥉", "4️⃣"][i]),
          h("span", {}, AVATARS[this.characterIdx[p.id]]),
          h("span", { style: "flex:1" }, p.name + (p.bankrupt ? Lang.hud.bankruptSuffix : "")),
          h("span", {}, `💎 ${fmt(netWorth(s, p.id))}`),
        ),
      );
    });
    const body = h("div", {}, h("p", {}, Lang.hud.winnerLine(AVATARS[this.characterIdx[winner.id]], winner.name, WIN_TEXT[s.winReason!])), list);
    await modal({
      title: Lang.hud.gameOver,
      body,
      className: "gameover",
      buttons: [{ label: Lang.hud.playAgain, value: 0, class: "green" }],
    });
  }
}

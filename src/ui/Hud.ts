import type { MessageKind } from "../core/interfaces";
import { CONFIG, investedValue, LEVEL_NAMES, netWorth, ownedTiles, rentFor, upgradeCost, WIN_TEXT } from "../core/rules";
import type { GameState } from "../core/types";
import { BOARD, GROUP_COLORS } from "../data/board";
import { ITEMS, SEASONS } from "../data/cards";
import { music } from "../scene/music";
import { sfx, Sound } from "../scene/sfx";
import { Speed } from "../scene/tween";
import { activeListings, listingFor } from "../core/trade";
import { escapeHtml, fmt, h, modal, uiRoot } from "./dom";
import { viewMarket } from "./TradeUi";

export const AVATARS = ["🥔", "👾", "🐔", "🍔"];

const KIND_LABEL: Record<string, string> = {
  start: "Petak Mulai",
  property: "Properti",
  resort: "Tempat Wisata",
  chance: "Paket Misterius",
  tax: "Pajak",
  island: "Penjara",
  festival: "Pesta Pejabat",
  tour: "Naik Pesawat Negara",
};

const TILE_HELP: Record<string, string> = {
  start: `Dapat ${fmt(CONFIG.salary)} setiap melewati petak ini.`,
  chance: "Paket datang tanpa pesan! Buka isinya — bisa duit, bisa kentut nuklir!",
  tax: `Ormas datang minta "uang keamanan". Bayar ${CONFIG.taxRate * 100}% dari uangmu (minimal ${fmt(50)}).`,
  island: `Dipenjara ${CONFIG.islandTurns} giliran. Keluar dengan dapat dadu kembar atau sogok sipir ${fmt(CONFIG.islandBail)}.`,
  festival: `Gelar pesta pejabat di satu propertimu — sewanya jadi x${CONFIG.festivalMultiplier}.`,
  tour: `Numpang pesawat negara: giliran berikutnya mendarat di petak mana saja (ongkos ${fmt(CONFIG.tourFee)}).`,
};

export class Hud {
  private cards: HTMLElement[] = [];
  private displayedMoney: number[] = [];
  private round = h("div", { class: "round-badge panel" });
  private logBox = h("div", { class: "entries" });
  private toasts = h("div", { class: "toasts" });
  private actionBar = h("div", { class: "action-bar" });
  private pickBanner: HTMLElement | null = null;
  private marketBtn = h("button", { class: "btn small white market-btn", title: "Pasar Terbuka", "data-testid": "market" }, "🏪");
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
    state.players.forEach((p, i) => {
      const card = h(
        "div",
        { class: `player-card panel p${i}`, "data-testid": `player-${i}` },
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

    const log = h("div", { class: "log panel" }, h("h4", {}, h("span", {}, "📜 Catatan"), h("span", {}, "▾")), this.logBox);
    log.querySelector("h4")!.addEventListener("click", () => log.classList.toggle("collapsed"));

    const speedBtn = h("button", { class: "btn small white", title: "Kecepatan animasi" }, `⏩ ${Speed.factor}x`);
    speedBtn.addEventListener("click", () => {
      const steps = [1, 2, 3];
      Speed.factor = steps[(steps.indexOf(Speed.factor) + 1) % steps.length] ?? 1;
      speedBtn.textContent = `⏩ ${Speed.factor}x`;
    });
    const muteBtn = h("button", { class: "btn small white", title: "Suara" }, Sound.muted ? "🔇" : "🔊");
    muteBtn.addEventListener("click", () => {
      Sound.muted = !Sound.muted;
      muteBtn.textContent = Sound.muted ? "🔇" : "🔊";
      music.sync();
    });
        const musicBtn = h("button", { class: "btn small white music-btn", title: "Musik latar (nyala/mati)" }, "🎵");
    musicBtn.classList.toggle("off", !music.enabled);
    musicBtn.addEventListener("click", () => {
      music.toggle();
      musicBtn.classList.toggle("off", !music.enabled);
    });
    const camBtn = h("button", { class: "btn small white", title: "Reset kamera" }, "🎥");
    camBtn.addEventListener("click", () => this.onResetCamera?.());
    this.marketBtn.addEventListener("click", () => {
      sfx.click();
      void viewMarket(this.state, this.localPlayers?.[0] ?? null);
    });
    const toolbar = h("div", { class: "toolbar" }, speedBtn, muteBtn, musicBtn, camBtn, this.marketBtn);

    root.append(this.round, toolbar, log, this.toasts, this.actionBar);
    this.refresh();
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
    this.round.textContent = `Ronde ${s.round} / ${CONFIG.roundLimit}` + (season ? `  ·  ${season.icon} ${season.badge} (${left} ronde)` : "");
    this.round.classList.toggle("season", !!season);
    const listed = activeListings(s).length;
    this.marketBtn.replaceChildren("🏪", listed ? h("span", { class: "badge" }, String(listed)) : "");
    s.players.forEach((p, i) => {
      const card = this.cards[i];
      card.classList.toggle("active", s.current === i && s.winner === null);
      card.classList.toggle("bankrupt", p.bankrupt);
      const meta: string[] = [`🏠 ${ownedTiles(s, i).length}`, `💎 ${fmt(netWorth(s, i))}`];
      if (p.shields) meta.push(`🛡️${p.shields}`);
      if (p.items.length) meta.push(`🎒${p.items.map((it) => ITEMS[it].icon).join("")}`);
      if (p.islandTurns) meta.push(`🏝️${p.islandTurns}`);
      if (p.pendingTour) meta.push("✈️");
      if (p.bankrupt) meta.splice(0, meta.length, "💀 Bangkrut");
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

  waitRollButton(label = "🎲 LEMPAR DADU"): Promise<void> {
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
      const roll = h("button", { class: "btn roll-btn", "data-testid": "roll" }, "🎲 LEMPAR DADU");
      const item = h("button", { class: "btn pink item-btn", "data-testid": "use-item" }, `🎒 Pakai Kartu (${count})`);
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
      if (o.items > 0) add(`🎒 Kartu (${o.items})`, "pink", "item", "use-item");
      add(o.tradesLeft > 0 ? "🤝 Negosiasi" : "🤝 Jatah habis", "blue", "trade", "trade", o.tradesLeft <= 0);
      const listed = activeListings(this.state).length;
      add(listed ? `🏪 Pasar · ${listed}` : "🏪 Pasar", "orange", "market", "market-act");
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
          return `<tr class="${ts.level === l ? "current" : ""}"><td>${LEVEL_NAMES[l]}</td><td>bangun ${fmt(upgradeCost(index, l - 1, l))}</td><td>sewa ${fmt(rentFor(fake, index))}</td></tr>`;
        })
        .join("");
      body += `<table>${rows}</table>`;
    } else if (def.kind === "resort") {
      body += `<p>Harga ${fmt(def.price!)}. Sewa ${fmt(CONFIG.resortBaseRent)} dan berlipat ganda untuk setiap tempat wisata yang dimiliki pemilik yang sama.</p>`;
    } else {
      body += `<p>${TILE_HELP[def.kind] ?? ""}</p>`;
    }
    if (owner) {
      body += `<p>Pemilik: <b style="color:${owner.color}">${escapeHtml(owner.name)}</b> — ${def.kind === "resort" ? "Wisata" : LEVEL_NAMES[ts.level]}<br/>Sewa saat ini: <b>${fmt(rentFor(s, index))}</b>${ts.festival ? " ⭐ Festival" : ""}<br/>Nilai investasi: ${fmt(investedValue(s, index))}</p>`;
    } else if (def.kind === "property" || def.kind === "resort") {
      body += `<p>Belum dimiliki.</p>`;
    }
    const listing = listingFor(s, index);
    if (listing) body += `<p class="listed">🏪 Dijual di Pasar Terbuka: <b>${fmt(listing.price)}</b></p>`;
    await modal({
      title: def.name,
      bandColor: def.kind === "property" ? GROUP_COLORS[def.group!] : undefined,
      body,
      buttons: [{ label: "Tutup", value: 0, class: "white" }],
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
          h("span", { style: "flex:1" }, p.name + (p.bankrupt ? " (bangkrut)" : "")),
          h("span", {}, `💎 ${fmt(netWorth(s, p.id))}`),
        ),
      );
    });
    const body = h("div", {}, h("p", {}, `${AVATARS[this.characterIdx[winner.id]]} ${winner.name} menang! ${WIN_TEXT[s.winReason!]}`), list);
    await modal({
      title: "🏆 Permainan Selesai!",
      body,
      className: "gameover",
      buttons: [{ label: "🔁 Main Lagi", value: 0, class: "green" }],
    });
  }
}

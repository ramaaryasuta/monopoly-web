import type { MessageKind } from "../core/interfaces";
import { CONFIG, investedValue, LEVEL_NAMES, netWorth, ownedTiles, rentFor, upgradeCost, WIN_TEXT } from "../core/rules";
import type { GameState } from "../core/types";
import { BOARD, GROUP_COLORS } from "../data/board";
import { sfx, Sound } from "../scene/sfx";
import { Speed } from "../scene/tween";
import { escapeHtml, fmt, h, modal, uiRoot } from "./dom";

export const AVATARS = ["🐱", "🐰", "🐻", "🐸"];

const KIND_LABEL: Record<string, string> = {
  start: "Petak Mulai",
  property: "Properti",
  resort: "Tempat Wisata",
  chance: "Kotak Kejutan",
  tax: "Pajak",
  island: "Pulau Terpencil",
  festival: "Festival",
  tour: "Wisata Dunia",
};

const TILE_HELP: Record<string, string> = {
  start: `Dapat ${CONFIG.salary} setiap melewati petak ini.`,
  chance: "Ambil kartu kejutan acak — bisa untung, bisa buntung!",
  tax: `Bayar ${CONFIG.taxRate * 100}% dari uangmu (minimal 50).`,
  island: `Terjebak ${CONFIG.islandTurns} giliran. Keluar dengan dadu kembar atau bayar ${CONFIG.islandBail}.`,
  festival: `Pilih satu propertimu — sewanya jadi x${CONFIG.festivalMultiplier}.`,
  tour: `Giliran berikutnya terbang ke petak mana saja (biaya ${CONFIG.tourFee}).`,
};

export class Hud {
  private cards: HTMLElement[] = [];
  private displayedMoney: number[] = [];
  private round = h("div", { class: "round-badge panel" });
  private logBox = h("div", { class: "entries" });
  private toasts = h("div", { class: "toasts" });
  private actionBar = h("div", { class: "action-bar" });
  private pickBanner: HTMLElement | null = null;
  /** Untuk memproyeksikan teks uang melayang di atas pion. */
  screenPosOfPlayer: ((pid: number) => { x: number; y: number } | null) | null = null;
  onResetCamera: (() => void) | null = null;

  constructor(
    private state: GameState,
    private characterIdx: number[],
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
          h("div", { class: "name" }, p.name + (p.isBot ? " 🤖" : "")),
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
    });
    const camBtn = h("button", { class: "btn small white", title: "Reset kamera" }, "🎥");
    camBtn.addEventListener("click", () => this.onResetCamera?.());
    const toolbar = h("div", { class: "toolbar" }, speedBtn, muteBtn, camBtn);

    root.append(this.round, toolbar, log, this.toasts, this.actionBar);
    this.refresh();
  }

  // ------------------------------------------------------------------ player cards

  refresh() {
    const s = this.state;
    this.round.textContent = `Ronde ${s.round} / ${CONFIG.roundLimit}`;
    s.players.forEach((p, i) => {
      const card = this.cards[i];
      card.classList.toggle("active", s.current === i && s.winner === null);
      card.classList.toggle("bankrupt", p.bankrupt);
      const meta: string[] = [`🏠 ${ownedTiles(s, i).length}`, `💎 ${fmt(netWorth(s, i))}`];
      if (p.shields) meta.push(`🛡️${p.shields}`);
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

  showDiceResult(d1: number, d2: number) {
    const e = h("div", { class: "dice-result" }, `${d1} + ${d2} = ${d1 + d2}${d1 === d2 ? " 🎯" : ""}`);
    uiRoot().append(e);
    setTimeout(() => e.remove(), 1200);
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
      body += `<p>Harga ${fmt(def.price!)}. Sewa ${CONFIG.resortBaseRent} dan berlipat ganda untuk setiap tempat wisata yang dimiliki pemilik yang sama.</p>`;
    } else {
      body += `<p>${TILE_HELP[def.kind] ?? ""}</p>`;
    }
    if (owner) {
      body += `<p>Pemilik: <b style="color:${owner.color}">${escapeHtml(owner.name)}</b> — ${def.kind === "resort" ? "Wisata" : LEVEL_NAMES[ts.level]}<br/>Sewa saat ini: <b>${fmt(rentFor(s, index))}</b>${ts.festival ? " ⭐ Festival" : ""}<br/>Nilai investasi: ${fmt(investedValue(s, index))}</p>`;
    } else if (def.kind === "property" || def.kind === "resort") {
      body += `<p>Belum dimiliki.</p>`;
    }
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

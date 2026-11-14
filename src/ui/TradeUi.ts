import type { DealAction, TradeOffer } from "../core/interfaces";
import { investedValue, LEVEL_NAMES } from "../core/rules";
import {
  activeListings,
  listingFor,
  MAX_MARKET_PRICE,
  MIN_MARKET_PRICE,
  offerGainFor,
  suggestedPrice,
  tradeableTiles,
  tradeError,
  validMarketPrice,
} from "../core/trade";
import type { GameState } from "../core/types";
import { BOARD, GROUP_COLORS } from "../data/board";
import { fmt, h, modal } from "./dom";

const tileColor = (t: number) => (BOARD[t].kind === "resort" ? "#36d1c4" : GROUP_COLORS[BOARD[t].group!]);
const levelText = (state: GameState, t: number) => (BOARD[t].kind === "resort" ? "Wisata" : LEVEL_NAMES[state.tiles[t].level]);

/** Satu wilayah sebagai "chip" kecil: warna grup, nama, level, nilai. */
function tileChip(state: GameState, t: number): HTMLElement {
  return h(
    "span",
    { class: "tile-chip", style: `--chip:${tileColor(t)}` },
    h("b", {}, BOARD[t].name),
    h("small", {}, `${levelText(state, t)} · ${fmt(investedValue(state, t))}`),
  );
}

function sideBox(state: GameState, title: string, tiles: number[], money: number): HTMLElement {
  const box = h("div", { class: "trade-col" }, h("h3", {}, title));
  const list = h("div", { class: "chips" });
  for (const t of tiles) list.append(tileChip(state, t));
  if (money > 0) list.append(h("span", { class: "tile-chip money" }, h("b", {}, `💰 ${fmt(money)}`)));
  if (!tiles.length && money <= 0) list.append(h("span", { class: "empty" }, "— tidak ada —"));
  box.append(list);
  return box;
}

/** Ringkasan tawaran dari sudut pandang penerima (`offer.to`). */
export function offerView(state: GameState, o: TradeOffer): HTMLElement {
  const gain = offerGainFor(state, o);
  const from = state.players[o.from];
  return h(
    "div",
    {},
    h(
      "div",
      { class: "trade-grid" },
      sideBox(state, "✅ Kamu dapat", o.giveTiles, o.giveMoney),
      sideBox(state, `📤 Kamu berikan ke ${from.name}`, o.takeTiles, o.takeMoney),
    ),
    h(
      "p",
      { class: `trade-net ${gain >= 0 ? "plus" : "minus"}` },
      `Selisih nilai buatmu: ${gain >= 0 ? "+" : "−"}${fmt(Math.abs(gain))}`,
      h("small", {}, " (berdasarkan nilai investasi, belum termasuk strategi monopoli)"),
    ),
  );
}

/** Pilih lawan negosiasi. */
export function pickTradeTarget(state: GameState, me: number): Promise<number | null> {
  const others = state.players.filter((p) => p.id !== me && !p.bankrupt);
  return modal<number | null>({
    title: "🤝 Negosiasi dengan siapa?",
    body: "<p>Tukar atau jual-beli wilayah. Lawan bisa menerima, menolak, atau menawar balik.</p>",
    buttons: [
      ...others.map((p) => ({
        label: p.name,
        sub: `${fmt(p.money)} · 🏠 ${tradeableTiles(state, p.id).length}`,
        value: p.id as number | null,
        class: "blue",
      })),
      { label: "Batal", value: null, class: "white" },
    ],
  });
}

/**
 * Editor tawaran: centang wilayah yang diberi/diminta dan isi uang.
 * `draft.from` = pemain di perangkat ini. Validasi langsung; tombol kirim nonaktif bila tidak sah.
 */
export async function editOffer(state: GameState, draft: TradeOffer, title: string): Promise<TradeOffer | null> {
  const me = state.players[draft.from];
  const them = state.players[draft.to];

  const checks: { tile: number; mine: boolean; input: HTMLInputElement }[] = [];
  const column = (mine: boolean) => {
    const owner = mine ? draft.from : draft.to;
    const selected = mine ? draft.giveTiles : draft.takeTiles;
    const col = h("div", { class: "trade-col" }, h("h3", {}, mine ? "📤 Kamu berikan" : `📥 Kamu minta dari ${them.name}`));
    const list = h("div", { class: "chips pick" });
    const tiles = tradeableTiles(state, owner);
    for (const t of tiles) {
      const input = h("input", { type: "checkbox" }) as HTMLInputElement;
      input.checked = selected.includes(t);
      checks.push({ tile: t, mine, input });
      const chip = tileChip(state, t);
      chip.prepend(input);
      list.append(h("label", {}, chip));
    }
    if (!tiles.length) list.append(h("span", { class: "empty" }, "— belum punya wilayah —"));
    const money = h("input", { type: "number", min: 0, step: 10, max: (mine ? me : them).money, value: mine ? draft.giveMoney || "" : draft.takeMoney || "", placeholder: "0" }) as HTMLInputElement;
    const preview = h("small", {});
    col.append(
      list,
      h("label", { class: "money-in" }, h("span", {}, mine ? "💰 + Uang" : "💰 + Minta uang"), money, h("span", { class: "unit" }, "jt"), preview),
      h("small", { class: "have" }, `Uang ${mine ? "kamu" : them.name}: ${fmt((mine ? me : them).money)}`),
    );
    return { col, money, preview };
  };
  const mine = column(true);
  const theirs = column(false);
  const error = h("p", { class: "trade-error" });
  const net = h("p", { class: "trade-net" });
  const body = h("div", { class: "trade-editor" }, h("div", { class: "trade-grid" }, mine.col, theirs.col), net, error);

  const read = (): TradeOffer => {
    const num = (i: HTMLInputElement) => Math.max(0, Math.floor(Number(i.value) || 0));
    return {
      from: draft.from,
      to: draft.to,
      giveTiles: checks.filter((c) => c.mine && c.input.checked).map((c) => c.tile),
      takeTiles: checks.filter((c) => !c.mine && c.input.checked).map((c) => c.tile),
      giveMoney: num(mine.money),
      takeMoney: num(theirs.money),
    };
  };

  let send: HTMLButtonElement | null = null;
  const done = modal<"send" | "cancel">({
    title,
    className: "trade-modal",
    body,
    row: true,
    buttons: [
      { label: "📨 Kirim Tawaran", value: "send", class: "green" },
      { label: "Batal", value: "cancel", class: "white" },
    ],
    bind: (_c, root) => (send = root.querySelector<HTMLButtonElement>(".buttons button")),
  });
  const update = () => {
    const o = read();
    mine.preview.textContent = o.giveMoney ? `= ${fmt(o.giveMoney)}` : "";
    theirs.preview.textContent = o.takeMoney ? `= ${fmt(o.takeMoney)}` : "";
    const err = tradeError(state, o);
    error.textContent = err ? `⚠️ ${err[0].toUpperCase()}${err.slice(1)}` : "";
    // Selisih nilai dari sisi pengirim = kebalikan keuntungan penerima
    const gain = -offerGainFor(state, o);
    net.textContent = err ? "" : `Selisih nilai buatmu: ${gain >= 0 ? "+" : "−"}${fmt(Math.abs(gain))}`;
    net.className = `trade-net ${gain >= 0 ? "plus" : "minus"}`;
    if (send) (send as HTMLButtonElement).disabled = !!err;
  };
  body.addEventListener("input", update);
  body.addEventListener("change", update);
  update();

  const v = await done;
  if (v !== "send") return null;
  const o = read();
  return tradeError(state, o) ? null : o;
}

/** Nama pemain sebagai pil berwarna. */
function playerPill(state: GameState, pid: number): HTMLElement {
  const p = state.players[pid];
  return h("span", { class: "player-pill", style: `--c:${p.color}` }, p.name);
}

/**
 * Daftar isi pasar: satu baris per wilayah. Bila `act` diberikan (giliran sendiri),
 * tiap baris punya tombol Beli / Tarik.
 */
function marketList(state: GameState, viewer: number | null, act?: (a: DealAction) => void): HTMLElement {
  const listings = activeListings(state);
  const box = h("div", { class: "market-list" });
  if (!listings.length) {
    box.append(h("div", { class: "market-empty" }, h("span", {}, "🦗"), "Pasar masih sepi. Belum ada wilayah yang dijual."));
    return box;
  }
  const money = viewer !== null ? state.players[viewer].money : 0;
  for (const l of listings) {
    const own = l.seller === viewer;
    const value = investedValue(state, l.tile);
    const deal = l.price < value ? "murah" : l.price > value * 1.5 ? "mahal" : "";
    const row = h(
      "div",
      { class: `market-row${own ? " own" : ""}`, style: `--chip:${tileColor(l.tile)}` },
      h(
        "div",
        { class: "mr-info" },
        h("b", {}, BOARD[l.tile].name),
        h("small", {}, `${levelText(state, l.tile)} · nilai ${fmt(value)}`),
        h("div", { class: "mr-seller" }, own ? h("span", { class: "player-pill you" }, "Milikmu") : playerPill(state, l.seller)),
      ),
      h("div", { class: "mr-price" }, h("b", {}, fmt(l.price)), deal ? h("small", { class: deal }, deal === "murah" ? "di bawah nilai" : "kemahalan") : null),
    );
    if (act) {
      const ok = own || money >= l.price;
      const btn = h(
        "button",
        { class: `btn small ${own ? "white" : "green"}`, disabled: !ok, title: ok ? "" : `Uang kurang ${fmt(l.price - money)}` },
        own ? "↩️ Tarik" : "🛒 Beli",
      );
      btn.addEventListener("click", () => act(own ? { type: "unlist", tile: l.tile } : { type: "buy", tile: l.tile }));
      row.append(btn);
    }
    box.append(row);
  }
  return box;
}

/** Lihat Pasar Terbuka tanpa bisa bertransaksi (bisa dibuka siapa saja kapan saja). */
export async function viewMarket(state: GameState, viewer: number | null): Promise<void> {
  await modal({
    title: "🏪 Pasar Terbuka",
    className: "market-modal",
    body: h("div", {}, marketList(state, viewer), h("p", { class: "hint" }, "Beli atau pajang wilayah saat giliranmu, sebelum lempar dadu.")),
    buttons: [{ label: "Tutup", value: 0, class: "white" }],
  });
}

/** Menu Pasar Terbuka di giliran sendiri: beli, tarik, atau pajang wilayah. */
export async function marketMenu(state: GameState, me: number): Promise<DealAction | null> {
  for (;;) {
    const mine = tradeableTiles(state, me);
    type V = DealAction | "sell" | null;
    let act: (a: DealAction) => void = () => {};
    const v = await modal<V>({
      title: "🏪 Pasar Terbuka",
      className: "market-modal",
      body: h(
        "div",
        {},
        h("div", { class: "market-wallet" }, "Uangmu ", h("b", {}, fmt(state.players[me].money))),
        marketList(state, me, (a) => act(a)),
        h("p", { class: "hint" }, "Semua pemain bisa melihat pasar. Wilayah yang dipajang tetap milikmu sampai ada yang membeli."),
      ),
      row: true,
      buttons: [
        { label: "➕ Pajang wilayah", value: "sell", class: "pink", disabled: !mine.length },
        { label: "Tutup", value: null, class: "white" },
      ],
      bind: (close) => (act = close),
    });
    if (v === null) return null;
    if (v !== "sell") {
      // Beli butuh konfirmasi supaya salah pencet tidak langsung menghabiskan uang
      if (v.type === "buy" && !(await confirmBuy(state, me, v.tile))) continue;
      return v;
    }
    const sold = await pickListing(state, me);
    if (sold) return sold;
  }
}

/** Dialog konfirmasi sebelum membeli wilayah dari Pasar Terbuka. */
async function confirmBuy(state: GameState, me: number, tile: number): Promise<boolean> {
  const l = listingFor(state, tile);
  if (!l) return false;
  const money = state.players[me].money;
  const value = investedValue(state, tile);
  const row = (label: string, val: HTMLElement | string, cls = "") => h("div", { class: `cb-row ${cls}` }, h("span", {}, label), typeof val === "string" ? h("b", {}, val) : val);
  const body = h(
    "div",
    { class: "confirm-buy" },
    h("p", {}, "Yakin mau membeli wilayah ini?"),
    h(
      "div",
      { class: "cb-table" },
      row("Wilayah", `${BOARD[tile].name} (${levelText(state, tile)})`),
      row("Penjual", playerPill(state, l.seller)),
      row("Nilai investasi", fmt(value)),
      row("Harga", fmt(l.price), "price"),
      row("Uangmu setelah beli", fmt(money - l.price), money - l.price < 200 ? "low" : ""),
    ),
    l.price > value * 1.5 ? h("p", { class: "cb-warn" }, "⚠️ Harga ini jauh di atas nilai investasinya.") : null,
  );
  return modal<boolean>({
    title: "🛒 Konfirmasi Pembelian",
    bandColor: tileColor(tile),
    body,
    row: true,
    // Tombol aman (Batal) diletakkan pertama
    buttons: [
      { label: "Batal", value: false, class: "white" },
      { label: `✅ Beli ${fmt(l.price)}`, value: true, class: "green" },
    ],
  });
}

async function pickListing(state: GameState, me: number): Promise<DealAction | null> {
  const tile = await modal<number | null>({
    title: "➕ Pajang wilayah mana?",
    body: "<p>Wilayah tetap milikmu (sewa tetap masuk) sampai ada yang membelinya.</p>",
    buttons: [
      ...tradeableTiles(state, me).map((t) => {
        const l = listingFor(state, t);
        return {
          label: `${BOARD[t].name}`,
          sub: `${levelText(state, t)} · nilai ${fmt(investedValue(state, t))}${l ? ` · sekarang ${fmt(l.price)}` : ""}`,
          value: t as number | null,
          class: "blue",
        };
      }),
      { label: "Batal", value: null, class: "white" },
    ],
  });
  if (tile === null) return null;

  const current = listingFor(state, tile)?.price ?? suggestedPrice(state, tile);
  const input = h("input", { type: "number", min: MIN_MARKET_PRICE, max: MAX_MARKET_PRICE, step: 10, value: current }) as HTMLInputElement;
  const preview = h("small", {});
  const body = h(
    "div",
    { class: "trade-editor" },
    h("p", {}, `Nilai investasi ${BOARD[tile].name}: `, h("b", {}, fmt(investedValue(state, tile)))),
    h("label", { class: "money-in big" }, h("span", {}, "💰 Harga"), input, h("span", { class: "unit" }, "jt"), preview),
  );
  let ok: HTMLButtonElement | null = null;
  const done = modal<boolean>({
    title: `🏷️ Harga ${BOARD[tile].name}`,
    bandColor: tileColor(tile),
    body,
    row: true,
    buttons: [
      { label: "🏪 Pajang", value: true, class: "green" },
      { label: "Batal", value: false, class: "white" },
    ],
    bind: (_c, root) => (ok = root.querySelector<HTMLButtonElement>(".buttons button")),
  });
  const update = () => {
    const price = Math.floor(Number(input.value));
    const valid = validMarketPrice(price);
    preview.textContent = valid ? `= ${fmt(price)}` : `min ${fmt(MIN_MARKET_PRICE)}`;
    if (ok) (ok as HTMLButtonElement).disabled = !valid;
  };
  input.addEventListener("input", update);
  update();
  if (!(await done)) return null;
  const price = Math.floor(Number(input.value));
  return validMarketPrice(price) ? { type: "list", tile, price } : null;
}

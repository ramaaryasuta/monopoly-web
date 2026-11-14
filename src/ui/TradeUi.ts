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
import { escapeHtml, fmt, h, modal } from "./dom";

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
      h("label", { class: "money-in" }, h("span", {}, "💰 Uang (juta)"), money, preview),
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

  const done = modal<"send" | "cancel">({
    title,
    className: "trade-modal",
    body,
    row: true,
    buttons: [
      { label: "📨 Kirim Tawaran", value: "send", class: "green" },
      { label: "Batal", value: "cancel", class: "white" },
    ],
  });
  const send = body.closest(".modal")?.querySelector<HTMLButtonElement>(".buttons button");
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
    if (send) send.disabled = !!err;
  };
  body.addEventListener("input", update);
  body.addEventListener("change", update);
  update();

  const v = await done;
  if (v !== "send") return null;
  const o = read();
  return tradeError(state, o) ? null : o;
}

/** Daftar isi pasar sebagai elemen (untuk mode lihat saja). */
function marketList(state: GameState, viewer: number | null): HTMLElement {
  const listings = activeListings(state);
  const box = h("div", { class: "market-list" });
  if (!listings.length) box.append(h("p", { class: "empty" }, "Pasar masih sepi. Belum ada wilayah yang dijual."));
  for (const l of listings) {
    const seller = state.players[l.seller];
    box.append(
      h(
        "div",
        { class: `market-row${l.seller === viewer ? " own" : ""}` },
        tileChip(state, l.tile),
        h("span", { class: "seller", style: `color:${seller.color}` }, escapeHtml(seller.name)),
        h("b", { class: "price" }, fmt(l.price)),
      ),
    );
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
    const money = state.players[me].money;
    const listings = activeListings(state);
    type V = DealAction | "sell" | null;
    const buttons: { label: string; sub?: string; value: V; class: string; disabled?: boolean }[] = [];
    for (const l of listings) {
      const name = BOARD[l.tile].name;
      if (l.seller === me) {
        buttons.push({ label: `↩️ Tarik ${name}`, sub: `dipajang ${fmt(l.price)}`, value: { type: "unlist", tile: l.tile }, class: "white" });
      } else {
        const ok = money >= l.price;
        buttons.push({
          label: `🛒 Beli ${name} — ${fmt(l.price)}`,
          sub: ok ? `dari ${state.players[l.seller].name} · nilai ${fmt(investedValue(state, l.tile))}` : `💸 uang kurang ${fmt(l.price - money)}`,
          value: { type: "buy", tile: l.tile },
          class: "green",
          disabled: !ok,
        });
      }
    }
    const mine = tradeableTiles(state, me);
    buttons.push({ label: "➕ Pajang wilayahku", sub: mine.length ? "" : "belum punya wilayah", value: "sell", class: "pink", disabled: !mine.length });
    buttons.push({ label: "Tutup", value: null, class: "white" });
    const v = await modal<V>({
      title: "🏪 Pasar Terbuka",
      className: "market-modal",
      body: h("div", {}, marketList(state, me), h("p", { class: "hint" }, `Uangmu: ${fmt(money)}. Semua pemain bisa melihat & membeli wilayah yang dipajang di gilirannya.`)),
      buttons,
    });
    if (v === null) return null;
    if (v !== "sell") return v;
    const sold = await pickListing(state, me);
    if (sold) return sold;
  }
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
    h("label", { class: "money-in big" }, h("span", {}, "💰 Harga (juta)"), input, preview),
  );
  const done = modal<boolean>({
    title: `🏷️ Harga ${BOARD[tile].name}`,
    body,
    row: true,
    buttons: [
      { label: "🏪 Pajang", value: true, class: "green" },
      { label: "Batal", value: false, class: "white" },
    ],
  });
  const ok = body.closest(".modal")?.querySelector<HTMLButtonElement>(".buttons button");
  const update = () => {
    const price = Math.floor(Number(input.value));
    const valid = validMarketPrice(price);
    preview.textContent = valid ? `= ${fmt(price)}` : `min ${fmt(MIN_MARKET_PRICE)}`;
    if (ok) ok.disabled = !valid;
  };
  input.addEventListener("input", update);
  update();
  if (!(await done)) return null;
  const price = Math.floor(Number(input.value));
  return validMarketPrice(price) ? { type: "list", tile, price } : null;
}

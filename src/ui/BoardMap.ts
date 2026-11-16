import { investedValue, LEVEL_NAMES } from "../core/rules";
import type { GameState } from "../core/types";
import { BOARD, GROUP_COLORS, GROUP_NAMES, SIDE_LEN } from "../data/board";
import { gridOf, HALF } from "../scene/layout";
import { fmt, h } from "./dom";
import { Lang } from "../lang/id";

/**
 * Peta mini papan (tampilan atas, arah sama dengan kamera awal: Mulai di kanan-bawah).
 * Dipakai di dialog nego / jual / turunkan bangunan supaya pemain bisa melihat
 * letak wilayah, siapa pemiliknya, dan grup warna di sekitarnya.
 *
 * Elemen lain di dialog yang punya atribut `data-tile` otomatis terhubung lewat
 * `linkMap`: arahkan kursor ke item daftar → petaknya menyala di peta, dan sebaliknya.
 */

/** Tanda pada petak: gain = kamu dapat, lose = kamu berikan, focus = sedang dibahas. */
export type MapMark = "gain" | "lose" | "focus";

export interface BoardMapOptions {
  /** Petak yang relevan; petak lain diredupkan. Kosong/undefined = semua normal. */
  relevant?: number[];
  /** Tanda awal per petak. */
  marks?: Map<number, MapMark>;
  /** Klik petak (mis. untuk mencentang wilayah di editor tawaran). */
  onPick?: (tile: number) => void;
  /** Keterangan warna tanda di bawah peta. */
  legend?: { mark: MapMark; text: string }[];
}

const SPECIAL_ICON: Record<string, string> = {
  start: "🏁",
  chance: "🎁",
  island: "⛓️",
  festival: "🎉",
  tour: "✈️",
  tax: "💸",
};
const LEVEL_GLYPH = ["", "🚩", "🏠", "🏘️", "🏡", "🗼"];
const KIND_NAME: Record<string, string> = Lang.boardMap.kindName;

const OPEN_KEY = "pk.boardMapOpen";
function loadOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}
function saveOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    /* penyimpanan diblokir: abaikan */
  }
}

export class BoardMap {
  readonly el: HTMLElement;
  private cells: HTMLElement[] = [];
  private info: HTMLElement;
  private hovered: number | null = null;
  /** Dipanggil saat petak di peta disorot (untuk menyalakan item daftar). */
  onHover: (tile: number | null, fromMap: boolean) => void = () => {};

  constructor(
    private state: GameState,
    opts: BoardMapOptions = {},
  ) {
    const grid = h("div", { class: "bm-grid" });
    const relevant = opts.relevant ? new Set(opts.relevant) : null;
    for (let t = 0; t < BOARD.length; t++) {
      const cell = this.buildCell(t);
      if (relevant && !relevant.has(t)) cell.classList.add("dim");
      if (opts.onPick && relevant?.has(t)) cell.classList.add("pickable");
      this.cells.push(cell);
      grid.append(cell);
    }
    this.info = h("div", { class: "bm-info" });
    grid.append(this.info);
    this.showInfo(null);
    if (opts.marks) this.setMarks(opts.marks);

    grid.addEventListener("mouseover", (e) => {
      const t = this.cellOf(e.target);
      if (t !== null) this.hover(t, true);
    });
    grid.addEventListener("mouseleave", () => this.hover(null, true));
    grid.addEventListener("click", (e) => {
      const t = this.cellOf(e.target);
      if (t === null) return;
      this.hover(t, true);
      if (opts.onPick && (!relevant || relevant.has(t))) opts.onPick(t);
    });

    const legend = opts.legend?.length
      ? h(
          "div",
          { class: "bm-legend" },
          ...opts.legend.map((l) => h("span", {}, h("i", { class: `bm-key ${l.mark}` }), l.text)),
        )
      : null;

    const details = h(
      "details",
      { class: "bm-wrap" },
      h("summary", {}, Lang.boardMap.title),
      h("div", { class: "bm" }, grid, legend),
    ) as HTMLDetailsElement;
    details.open = loadOpen();
    details.addEventListener("toggle", () => saveOpen(details.open));
    this.el = details;
  }

  private cellOf(target: EventTarget | null): number | null {
    const c = (target as HTMLElement | null)?.closest?.("[data-cell]");
    return c ? Number(c.getAttribute("data-cell")) : null;
  }

  private buildCell(t: number): HTMLElement {
    const def = BOARD[t];
    const ts = this.state.tiles[t];
    const g = gridOf(t);
    const side = Math.floor(t / SIDE_LEN);
    const corner = t % SIDE_LEN === 0;
    const owner = ts.owner !== null ? this.state.players[ts.owner] : null;
    const cell = h("div", {
      class: `bm-cell side${side}${corner ? " corner" : ""}${owner ? " owned" : ""}`,
      "data-cell": t,
      style: [
        `grid-column:${g.x + HALF + 1}`,
        `grid-row:${HALF - g.z + 1}`,
        def.group !== undefined ? `--grp:${GROUP_COLORS[def.group]}` : def.kind === "resort" ? "--grp:#36d1c4" : "",
        owner ? `--own:${owner.color}` : "",
      ]
        .filter(Boolean)
        .join(";"),
    });
    let glyph = SPECIAL_ICON[def.kind] ?? "";
    if (def.kind === "resort") glyph = owner ? "🌴" : "🏝️";
    else if (def.kind === "property") glyph = LEVEL_GLYPH[ts.level];
    if (glyph) cell.append(h("span", { class: "bm-glyph" }, glyph));
    if (ts.festival) cell.append(h("span", { class: "bm-fest" }, "🎉"));
    // Posisi pion pemain
    const here = this.state.players.filter((p) => !p.bankrupt && p.position === t);
    if (here.length) cell.append(h("span", { class: "bm-pawns" }, ...here.map((p) => h("i", { style: `background:${p.color}`, title: p.name }))));
    return cell;
  }

  private showInfo(t: number | null) {
    this.info.replaceChildren();
    if (t === null) {
      this.info.append(h("span", { class: "bm-hint" }, Lang.boardMap.hint));
      return;
    }
    const def = BOARD[t];
    const ts = this.state.tiles[t];
    const owner = ts.owner !== null ? this.state.players[ts.owner] : null;
    const color = def.group !== undefined ? GROUP_COLORS[def.group] : def.kind === "resort" ? "#36d1c4" : "#ddd";
    let kind = KIND_NAME[def.kind] ?? "";
    if (def.kind === "property") kind = owner ? Lang.boardMap.groupLevel(GROUP_NAMES[def.group!], LEVEL_NAMES[ts.level]) : Lang.boardMap.group(GROUP_NAMES[def.group!]);
    const value = owner ? investedValue(this.state, t) : (def.price ?? 0);
    this.info.append(
      h("b", { class: "bm-name", style: `--grp:${color}` }, def.name),
      kind ? h("small", {}, kind) : "",
      def.kind === "property" || def.kind === "resort"
        ? h(
            "small",
            {},
            owner ? h("span", { class: "player-pill", style: `--c:${owner.color}` }, owner.name) : Lang.boardMap.unowned,
            Lang.boardMap.valueLine(!!owner, fmt(value)),
          )
        : "",
    );
    if (ts.festival) this.info.append(h("small", {}, Lang.boardMap.party));
  }

  /** Sorot satu petak (null = hapus sorotan). */
  hover(t: number | null, fromMap = false) {
    if (t === this.hovered) return;
    if (this.hovered !== null) this.cells[this.hovered].classList.remove("hover");
    this.hovered = t;
    if (t !== null) this.cells[t].classList.add("hover");
    this.showInfo(t);
    this.onHover(t, fromMap);
  }

  setMarks(marks: Map<number, MapMark>) {
    this.cells.forEach((c, t) => {
      c.classList.remove("gain", "lose", "focus");
      const m = marks.get(t);
      if (m) c.classList.add(m);
    });
  }
}

/**
 * Hubungkan peta dengan elemen `[data-tile]` di dalam `root` (chip, baris pasar, tombol).
 * Hover/fokus pada elemen → petak menyala; hover petak → elemen ikut menyala.
 */
export function linkMap(root: HTMLElement, map: BoardMap) {
  const tileOf = (e: Event) => {
    const el = (e.target as HTMLElement | null)?.closest?.("[data-tile]");
    return el ? Number(el.getAttribute("data-tile")) : null;
  };
  const over = (e: Event) => {
    const t = tileOf(e);
    if (t !== null) map.hover(t);
  };
  root.addEventListener("mouseover", over);
  root.addEventListener("focusin", over);
  root.addEventListener("mouseout", (e) => {
    const from = tileOf(e);
    const to = (e as MouseEvent).relatedTarget as HTMLElement | null;
    if (from !== null && !to?.closest?.(`[data-tile="${from}"]`)) map.hover(null);
  });
  map.onHover = (t, fromMap) => {
    root.querySelectorAll(".map-hover").forEach((e) => e.classList.remove("map-hover"));
    if (t === null) return;
    const items = root.querySelectorAll<HTMLElement>(`[data-tile="${t}"]`);
    items.forEach((e) => e.classList.add("map-hover"));
    // Dari peta: gulir daftar supaya item yang cocok terlihat (tanpa menggulir modal utama)
    if (fromMap && items[0]) {
      const list = items[0].closest<HTMLElement>(".chips, .market-list");
      if (list) {
        const top = items[0].offsetTop - list.offsetTop;
        if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - items[0].offsetHeight) {
          list.scrollTo({ top: top - list.clientHeight / 2, behavior: "smooth" });
        }
      }
    }
  };
}

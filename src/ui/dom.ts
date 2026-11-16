import { sfx } from "../scene/sfx";

export const uiRoot = () => document.getElementById("ui")!;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "class") e.className = String(v);
    else if (k === "html") e.innerHTML = String(v);
    else e.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined) e.append(c);
  return e;
}

export { rp as fmt } from "../core/money";

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface ModalButton<T> {
  label: string;
  value: T;
  class?: string;
  sub?: string;
  disabled?: boolean;
  /** Wilayah terkait tombol ini (untuk peta mini: hover → petak menyala). */
  tile?: number;
  /** Warna strip di kiri tombol (mis. warna grup wilayah). */
  color?: string;
  /** Judul kelompok; judul ditampilkan tiap kali berganti dari tombol sebelumnya. */
  group?: string;
}

export interface ModalOptions<T> {
  title: string;
  bandColor?: string;
  body?: string | Node;
  buttons: ModalButton<T>[];
  row?: boolean;
  /** Tutup otomatis setelah ms dengan nilai tombol pertama (untuk giliran bot). */
  autoCloseMs?: number;
  className?: string;
  /** Akses ke elemen modal & fungsi tutup (untuk tombol/validasi di dalam body). */
  bind?: (close: (v: T) => void, root: HTMLElement) => void;
  /** Ringkasan yang selalu terlihat tepat di atas tombol baris (mis. selisih nilai tawaran). */
  footer?: Node;
  /** Ringkasan yang menempel di atas saat isi dialog digulir (mis. angka utang). */
  header?: Node;
}

/** Modal berbasis Promise: resolve dengan nilai tombol yang diklik. */
export function modal<T>(o: ModalOptions<T>): Promise<T> {
  return new Promise((resolve) => {
    const body = typeof o.body === "string" ? h("div", { html: o.body }) : (o.body ?? null);
    const btns = h("div", { class: `buttons${o.row ? " row" : ""}` });
    const main = h(
      "div",
      { class: "modal-main" },
      o.bandColor ? h("div", { class: "band", style: `background:${o.bandColor}` }) : null,
      h("h2", {}, o.title),
      o.header ? h("div", { class: "modal-sticky-head" }, o.header) : null,
      body,
    );
    // Tombol baris (Kirim/Batal) menempel di bawah supaya tidak tergulir hilang
    if (o.row || o.footer) main.append(h("div", { class: "modal-foot" }, o.footer ?? null, btns));
    else main.append(btns);
    const box = h("div", { class: `modal panel ${o.className ?? ""}` }, main);
    // Dialog dengan peta mini: peta dipisah ke kolom sendiri (kiri di layar lebar,
    // atas di HP) supaya tetap terlihat walau daftar wilayahnya panjang.
    const map = body instanceof Element ? body.querySelector(".bm-wrap") : null;
    if (map) {
      box.classList.add("split");
      box.prepend(h("div", { class: "modal-aside" }, map));
    }
    const backdrop = h("div", { class: "modal-backdrop", "data-testid": "modal" }, box);
    let done = false;
    const close = (v: T) => {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(v);
    };
    let group: string | undefined;
    for (const b of o.buttons) {
      if (b.group !== group) {
        group = b.group;
        if (group) btns.append(h("div", { class: "btn-group-title" }, group));
      }
      const btn = h(
        "button",
        {
          class: `btn ${b.class ?? ""} ${b.sub ? "opt" : ""} ${b.color ? "striped" : ""}`,
          disabled: b.disabled,
          "data-tile": b.tile,
          style: b.color ? `--chip:${b.color}` : undefined,
        },
        h("span", {}, b.label),
        b.sub ? h("small", {}, b.sub) : null,
      );
      btn.addEventListener("click", () => {
        sfx.click();
        close(b.value);
      });
      btns.append(btn);
    }
    o.bind?.(close, backdrop);
    if (o.autoCloseMs !== undefined) setTimeout(() => close(o.buttons[0].value), o.autoCloseMs);
    uiRoot().append(backdrop);
  });
}

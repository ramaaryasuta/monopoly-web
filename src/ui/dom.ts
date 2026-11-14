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
}

/** Modal berbasis Promise: resolve dengan nilai tombol yang diklik. */
export function modal<T>(o: ModalOptions<T>): Promise<T> {
  return new Promise((resolve) => {
    const body = typeof o.body === "string" ? h("div", { html: o.body }) : (o.body ?? null);
    const btns = h("div", { class: `buttons${o.row ? " row" : ""}` });
    const backdrop = h(
      "div",
      { class: "modal-backdrop", "data-testid": "modal" },
      h(
        "div",
        { class: `modal panel ${o.className ?? ""}` },
        o.bandColor ? h("div", { class: "band", style: `background:${o.bandColor}` }) : null,
        h("h2", {}, o.title),
        body,
        btns,
      ),
    );
    let done = false;
    const close = (v: T) => {
      if (done) return;
      done = true;
      backdrop.remove();
      resolve(v);
    };
    for (const b of o.buttons) {
      const btn = h(
        "button",
        { class: `btn ${b.class ?? ""} ${b.sub ? "opt" : ""}`, disabled: b.disabled },
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

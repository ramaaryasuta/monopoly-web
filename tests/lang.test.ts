import { describe, expect, it } from "vitest";
import { BOARD } from "../src/data/board";
import { CARDS, CHAOS_EVENTS, ITEMS, SEASONS } from "../src/data/cards";
import { Lang } from "../src/lang/id";

describe("file bahasa (src/lang/id.ts)", () => {
  it("setiap petak papan punya nama unik dari file bahasa", () => {
    const names = BOARD.map((t) => t.name);
    expect(names).toEqual(BOARD.map((t) => Lang.tiles[t.index]));
    expect(names.every((n) => n.trim().length > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it("kartu, event, item, dan musim semuanya punya teks", () => {
    for (const c of CARDS) expect(c.title && c.text, c.id).toBeTruthy();
    for (const e of CHAOS_EVENTS) expect(e.headline && e.text, e.id).toBeTruthy();
    for (const i of Object.values(ITEMS)) expect(i.name && i.text, i.id).toBeTruthy();
    for (const s of Object.values(SEASONS)) expect(s.headline && s.text && s.badge, s.id).toBeTruthy();
  });

  it("teks bervariabel menyisipkan semua nilai yang diberikan", () => {
    const msg = Lang.game.bayarSewa("Budi", "Rp400 jt", "Sari");
    expect(msg).toContain("Budi");
    expect(msg).toContain("Rp400 jt");
    expect(msg).toContain("Sari");
    expect(Lang.menu.winRoundLimit(62)).toContain("62");
    expect(Lang.trade.describe("A", "x", "B", "y")).toBe("A beri [x] ⇄ B beri [y]");
  });

  it("format uang memakai satuan dari file bahasa", async () => {
    const { rp } = await import("../src/core/money");
    expect(rp(300)).toBe("Rp300 jt");
    expect(rp(1250)).toBe("Rp1,25 M");
    expect(rp(0.5)).toBe("Rp500 rb");
  });
});

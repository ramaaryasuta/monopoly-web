import { describe, expect, it } from "vitest";
import { BotDecider } from "../src/core/bot";
import { Game } from "../src/core/game";
import { NullPresenter, type Decider } from "../src/core/interfaces";
import { acquirePrice, checkMonopolyWin, CONFIG, createGame, rentFor, salaryFor, seasonalCost, upgradeCost } from "../src/core/rules";
import type { PlayerSetup } from "../src/core/types";
import { BOARD, PROPERTY_GROUPS, RESORTS } from "../src/data/board";
import { CARDS, CHAOS_EVENTS } from "../src/data/cards";

const setups = (n: number): PlayerSetup[] =>
  Array.from({ length: n }, (_, i) => ({ name: `P${i}`, color: "#fff", isBot: true }));

function botGame(n: number, seed: number, maxTurns = 2000) {
  const g = new Game(setups(n), [], new NullPresenter(), { seed, maxTurns });
  const deciders = g.state.players.map(() => new BotDecider(g.state));
  (g as unknown as { deciders: Decider[] }).deciders = deciders;
  return g;
}

describe("board", () => {
  it("punya 32 petak dengan sudut di 0/8/16/24", () => {
    expect(BOARD).toHaveLength(32);
    expect(BOARD.map((t, i) => t.index === i).every(Boolean)).toBe(true);
    expect([0, 8, 16, 24].map((i) => BOARD[i].kind)).toEqual(["start", "island", "festival", "tour"]);
    expect(RESORTS).toHaveLength(4);
    expect(PROPERTY_GROUPS).toHaveLength(8);
  });
});

describe("rules", () => {
  it("menghitung biaya bangun bertahap", () => {
    // Desa Jamur harga 60: tanah 60, rumah 30, rumah 30, vila 50 (45 dibulatkan)
    expect(upgradeCost(1, 0, 1)).toBe(60);
    expect(upgradeCost(1, 0, 4)).toBe(60 + 30 + 30 + 50);
  });

  it("sewa naik sesuai level dan festival", () => {
    const s = createGame(setups(2));
    s.tiles[31] = { owner: 0, level: 1, festival: false };
    expect(rentFor(s, 31)).toBe(120);
    s.tiles[31].level = 5;
    expect(rentFor(s, 31)).toBe(2000);
    s.tiles[31].festival = true;
    expect(rentFor(s, 31)).toBe(4000);
  });

  it("sewa tanah x2 jika satu grup lengkap", () => {
    const s = createGame(setups(2));
    s.tiles[30] = { owner: 0, level: 1, festival: false };
    expect(rentFor(s, 30)).toBe(110);
    s.tiles[31] = { owner: 0, level: 1, festival: false };
    expect(rentFor(s, 30)).toBe(210);
  });

  it("sewa resort berlipat sesuai jumlah resort", () => {
    const s = createGame(setups(2));
    s.tiles[2] = { owner: 1, level: 1, festival: false };
    expect(rentFor(s, 2)).toBe(50);
    s.tiles[13] = { owner: 1, level: 1, festival: false };
    expect(rentFor(s, 2)).toBe(100);
  });

  it("harga akuisisi = 2x investasi", () => {
    const s = createGame(setups(2));
    s.tiles[1] = { owner: 0, level: 2, festival: false };
    expect(acquirePrice(s, 1)).toBe((60 + 30) * 2);
  });

  it("deteksi monopoli resort", () => {
    const s = createGame(setups(2));
    for (const r of RESORTS) s.tiles[r] = { owner: 1, level: 1, festival: false };
    expect(checkMonopolyWin(s, 1)).toBe("resortMonopoly");
    expect(checkMonopolyWin(s, 0)).toBeNull();
  });
});

describe("game flow", () => {
  it("melewati Mulai memberi gaji", async () => {
    const g = botGame(2, 1);
    g.state.players[0].position = 30;
    await g.moveSteps(0, 4);
    expect(g.state.players[0].position).toBe(2);
    expect(g.state.players[0].money).toBe(CONFIG.startMoney + CONFIG.salary);
  });

  it("dadu kembar 3x mengirim ke Nusakambangan", async () => {
    const g = botGame(2, 1);
    g.forcedDice = [[1, 1], [2, 2], [3, 3]];
    await g.playTurn();
    expect(g.state.players[0].position).toBe(8);
    expect(g.state.players[0].islandTurns).toBe(CONFIG.islandTurns);
  });

  it("pemain bangkrut ketika tidak mampu bayar", async () => {
    const g = botGame(2, 1);
    g.state.players[1].money = 10;
    await g.charge(1, 500, 0);
    expect(g.state.players[1].bankrupt).toBe(true);
    expect(g.state.winner).toBe(0);
    expect(g.state.winReason).toBe("lastStanding");
  });

  it("menjual properti sebelum bangkrut", async () => {
    const g = botGame(2, 1);
    g.state.tiles[31] = { owner: 1, level: 4, festival: false };
    g.state.players[1].money = 0;
    await g.charge(1, 100, 0);
    expect(g.state.players[1].bankrupt).toBe(false);
    expect(g.state.tiles[31].owner).toBeNull();
  });

  it("semua kartu konyol bisa dimainkan tanpa merusak state", async () => {
    for (const card of CARDS) {
      const g = botGame(4, 7);
      g.state.players[2].position = 8;
      g.state.players[2].islandTurns = 2;
      g.state.players[0].position = 5; // Paket Shopee
      g.forcedCard = card.id;
      await g.resolveTile(0);
      for (const p of g.state.players) {
        expect(p.money, card.id).toBeGreaterThanOrEqual(0);
        expect(p.position, card.id).toBeGreaterThanOrEqual(0);
        expect(p.position, card.id).toBeLessThan(BOARD.length);
        if (p.islandTurns > 0) expect(p.position, card.id).toBe(8);
      }
    }
  });

  it("kentut nuklir mendorong lawan mundur 2 petak", async () => {
    const g = botGame(3, 1);
    g.state.players[0].position = 5;
    g.state.players[1].position = 12;
    g.state.players[2].position = 1;
    g.forcedCard = "fart";
    await g.resolveTile(0);
    expect(g.state.players[1].position).toBe(10);
    expect(g.state.players[2].position).toBe(31);
  });

  it("semua event heboh bisa dijalankan", async () => {
    for (const ev of CHAOS_EVENTS) {
      const g = botGame(4, 3);
      g.state.players[1].money = 20;
      const before = g.state.players.reduce((s, p) => s + p.money, 0);
      await g.applyChaos(ev);
      for (const p of g.state.players) expect(p.money, ev.id).toBeGreaterThanOrEqual(0);
      const after = g.state.players.reduce((s, p) => s + p.money, 0);
      if (ev.effect.type === "robinHood") expect(after, ev.id).toBe(before);
    }
  });

  it("event heboh muncul di awal ronde baru", async () => {
    const g = botGame(2, 5);
    let shown = 0;
    g.presenter = Object.assign(new NullPresenter(), { showEvent: async () => void shown++ });
    await g.run();
    expect(shown).toBeGreaterThan(0);
  });

  it("simulasi bot 50 seed selalu selesai dengan pemenang", async () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = botGame(4, seed);
      const s = await g.run();
      expect(s.winner, `seed ${seed}`).not.toBeNull();
      for (const p of s.players) expect(p.money, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      for (const t of s.tiles) if (t.owner !== null) expect(s.players[t.owner].bankrupt).toBe(false);
    }
  });
});

describe("kartu simpanan & event musiman", () => {
  it("kartu item masuk kantong, maksimal 3 lalu dijual 50", async () => {
    const g = botGame(2, 1);
    const p = g.state.players[0];
    for (let i = 0; i < 4; i++) {
      g.forcedCard = "itemSandal";
      await (g as unknown as { drawCard(pid: number): Promise<void> }).drawCard(0);
    }
    expect(p.items).toEqual(["sandal", "sandal", "sandal"]);
    expect(p.money).toBe(CONFIG.startMoney + 50);
  });

  it("sendal memundurkan lawan, utang mengambil 100, kecoak menurunkan level", async () => {
    const g = botGame(2, 1);
    const [a, b] = g.state.players;
    b.position = 10;
    a.items = ["sandal", "utang", "kecoak"];
    await g.applyItem(0, { item: "sandal", target: 1 });
    expect(b.position).toBe(7);
    await g.applyItem(0, { item: "utang", target: 1 });
    expect(b.money).toBe(CONFIG.startMoney - 100);
    expect(a.money).toBe(CONFIG.startMoney + 100);
    g.state.tiles[1] = { owner: 1, level: 3, festival: false };
    await g.applyItem(0, { item: "kecoak", target: 1 });
    expect(g.state.tiles[1].level).toBe(2);
    expect(a.items).toEqual([]);
  });

  it("kartu tidak bisa dipakai ke sasaran tidak sah", async () => {
    const g = botGame(2, 1);
    g.state.players[0].items = ["kecoak"];
    g.state.tiles[1] = { owner: 1, level: 1, festival: false }; // tanah kebal
    expect(g.usableItems(0)).toEqual([]);
    await g.applyItem(0, { item: "kecoak", target: 1 });
    expect(g.state.players[0].items).toEqual(["kecoak"]);
  });

  it("musim turis menggandakan sewa, harbolnas mendiskon, THR gaji x2", () => {
    const s = createGame(setups(2));
    s.tiles[1] = { owner: 0, level: 2, festival: false };
    const normal = rentFor(s, 1);
    s.season = { id: "turis", untilRound: 2 };
    expect(rentFor(s, 1)).toBe(normal * 2);
    s.season = { id: "diskon", untilRound: 2 };
    expect(seasonalCost(s, 200)).toBe(100);
    s.season = { id: "thr", untilRound: 2 };
    expect(salaryFor(s)).toBe(CONFIG.salary * 2);
  });

  it("event musiman muncul lalu selesai setelah 2 ronde", async () => {
    const g = botGame(2, 3);
    const log: string[] = [];
    g.presenter = Object.assign(new NullPresenter(), {
      showSeason: async (d: { id: string }, ended: boolean) => void log.push(`${ended ? "end" : "start"}:${d.id}@${g.state.round}`),
    });
    g.forcedSeason = "banjir";
    await g.playTurn();
    expect(g.state.season).toEqual({ id: "banjir", untilRound: 2 });
    while (g.state.round < 3 && g.state.winner === null) await g.playTurn();
    await g.playTurn();
    expect(log[0]).toBe("start:banjir@1");
    expect(log).toContain("end:banjir@3");
  });
});

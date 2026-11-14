import { describe, expect, it } from "vitest";
import { BotDecider } from "../src/core/bot";
import { Game } from "../src/core/game";
import { NullPresenter, type Decider } from "../src/core/interfaces";
import { acquirePrice, checkMonopolyWin, CONFIG, createGame, rentFor, upgradeCost } from "../src/core/rules";
import type { PlayerSetup } from "../src/core/types";
import { BOARD, PROPERTY_GROUPS, RESORTS } from "../src/data/board";

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

  it("dadu kembar 3x mengirim ke pulau", async () => {
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

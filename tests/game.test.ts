import { describe, expect, it } from "vitest";
import { BotDecider } from "../src/core/bot";
import { Game } from "../src/core/game";
import { NullPresenter, type BuildChoice, type DebtAction, type DebtChoice, type Decider } from "../src/core/interfaces";
import { interruptibleDeals } from "../src/core/interject";
import { checkMonopolyWin, CONFIG, createGame, maxTargetLevel, rentFor, salaryFor, seasonalCost, upgradeCost } from "../src/core/rules";
import type { BuildLevel, PlayerSetup } from "../src/core/types";
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
  it("punya 40 petak (9 lokasi per sisi) dengan sudut di 0/10/20/30", () => {
    expect(BOARD).toHaveLength(40);
    expect(BOARD.map((t, i) => t.index === i).every(Boolean)).toBe(true);
    expect([0, 10, 20, 30].map((i) => BOARD[i].kind)).toEqual(["start", "island", "festival", "tour"]);
    expect(RESORTS).toHaveLength(4);
    expect(PROPERTY_GROUPS).toHaveLength(8);
    for (let side = 0; side < 4; side++) expect(BOARD.slice(side * 10 + 1, side * 10 + 10)).toHaveLength(9);
  });
});

describe("rules", () => {
  it("menghitung biaya bangun bertahap", () => {
    // Burjo SS Tembalang harga 50: tanah 50, rumah 30 (25 dibulatkan), rumah 30, vila 40 (37,5 dibulatkan)
    expect(upgradeCost(1, 0, 1)).toBe(50);
    expect(upgradeCost(1, 0, 4)).toBe(50 + 30 + 30 + 40);
  });

  it("sewa naik sesuai level dan festival", () => {
    const s = createGame(setups(2));
    s.tiles[39] = { owner: 0, level: 1, festival: false };
    expect(rentFor(s, 39)).toBe(230); // 65% × 360 = 234 → 230
    s.tiles[39].level = 5;
    // Landmark: 65% × (360 + 180 + 180 + 270 + 360 = 1.350) = 877,5 → 880
    expect(rentFor(s, 39)).toBe(880);
    s.tiles[39].festival = true;
    expect(rentFor(s, 39)).toBe(1760);
  });

  it("sewa = 65% nilai wilayah (total biaya yang sudah dikeluarkan)", () => {
    const s = createGame(setups(2));
    for (const tile of [1, 18, 39]) {
      for (let level = 1; level <= 5; level++) {
        s.tiles[tile] = { owner: 0, level: level as BuildLevel, festival: false };
        expect(rentFor(s, tile), `petak ${tile} level ${level}`).toBe(Math.round((upgradeCost(tile, 0, level) * 0.65) / 10) * 10);
      }
    }
  });

  it("sewa +30% di semua level jika satu grup lengkap", () => {
    const s = createGame(setups(2));
    s.tiles[37] = { owner: 0, level: 1, festival: false };
    expect(rentFor(s, 37)).toBe(210);
    s.tiles[38] = { owner: 0, level: 1, festival: false };
    expect(rentFor(s, 37)).toBe(210);
    s.tiles[39] = { owner: 0, level: 1, festival: false };
    expect(rentFor(s, 37)).toBe(270); // 210 × 1,3 = 273 → 270
    s.tiles[39].level = 5;
    expect(rentFor(s, 39)).toBe(1140); // 880 × 1,3 = 1.144 → 1.140
    s.tiles[38].owner = 1; // set pecah → bonus hilang
    expect(rentFor(s, 39)).toBe(880);
  });

  it("sewa resort berlipat sesuai jumlah resort", () => {
    const s = createGame(setups(2));
    s.tiles[2] = { owner: 1, level: 1, festival: false };
    expect(rentFor(s, 2)).toBe(20);
    s.tiles[16] = { owner: 1, level: 1, festival: false };
    expect(rentFor(s, 2)).toBe(30);
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
    g.state.players[0].position = 38;
    await g.moveSteps(0, 4);
    expect(g.state.players[0].position).toBe(2);
    expect(g.state.players[0].money).toBe(CONFIG.startMoney + CONFIG.salary);
  });

  it("dadu kembar 3x mengirim ke Nusakambangan", async () => {
    const g = botGame(2, 1);
    g.forcedDice = [[1, 1], [2, 2], [3, 3]];
    await g.playTurn();
    expect(g.state.players[0].position).toBe(10);
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
    g.state.tiles[39] = { owner: 1, level: 4, festival: false };
    g.state.players[1].money = 0;
    await g.charge(1, 100, 0);
    expect(g.state.players[1].bankrupt).toBe(false);
    expect(g.state.tiles[39].owner).toBeNull();
  });

  it("pemain pertama diacak dari seed, ronde naik saat giliran kembali ke dia", () => {
    const firsts = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const g = new Game(setups(4), [], new NullPresenter(), { seed, randomStart: true });
      const again = new Game(setups(4), [], new NullPresenter(), { seed, randomStart: true });
      expect(again.state.current).toBe(g.state.current); // sama di semua peer online
      expect(g.state.firstPlayer).toBe(g.state.current);
      firsts.add(g.state.current);
    }
    expect(firsts.size).toBe(4);

    const g = new Game(setups(3), [], new NullPresenter(), { seed: 1, randomStart: true });
    g.state.current = g.state.firstPlayer = 2;
    const end = () => (g as unknown as { endTurn(): void }).endTurn();
    end(); // 2 → 0
    expect(g.state.round).toBe(1);
    end(); // 0 → 1
    end(); // 1 → 2: kembali ke pembuka
    expect(g.state.round).toBe(2);
  });

  it("putaran pertama hanya bisa beli tanah, setelah lewat Mulai boleh bangun", async () => {
    const g = botGame(2, 1);
    expect(maxTargetLevel(g.state, 39, 0)).toBe(1);
    let seen: BuildChoice | null = null;
    g.deciders[0] = Object.assign(Object.create(g.deciders[0]), {
      chooseBuild: async (c: BuildChoice) => {
        seen = c;
        return c.currentLevel;
      },
    });
    g.state.players[0].money = 5000;
    g.state.players[0].position = 39;
    await g.resolveTile(0);
    expect(seen!.options.map((o) => o.level)).toEqual([1]);
    expect(seen!.firstLap).toBe(true);

    g.state.players[0].position = 37;
    await g.moveSteps(0, 5); // 37 → 2, melewati Mulai
    expect(g.state.players[0].laps).toBe(1);
    expect(maxTargetLevel(g.state, 39, 0)).toBe(4);
  });

  it("pemain memilih sendiri wilayah yang dijual saat uang kurang", async () => {
    const g = botGame(2, 1);
    g.state.tiles[1] = { owner: 1, level: 1, festival: false };
    g.state.tiles[39] = { owner: 1, level: 4, festival: false };
    g.state.players[1].money = 0;
    const seen: DebtChoice[] = [];
    g.deciders[1] = Object.assign(Object.create(g.deciders[1]), {
      chooseDebt: async (c: DebtChoice): Promise<DebtAction> => {
        seen.push(c);
        return { type: "sell", tile: 39 }; // bukan yang termurah
      },
    });
    await g.charge(1, 100, 0);
    expect(seen[0].tiles.map((t) => t.tile)).toEqual([1, 39]);
    expect(g.state.tiles[39].owner).toBeNull();
    expect(g.state.tiles[1].owner).toBe(1);
    expect(g.state.players[1].bankrupt).toBe(false);
  });

  it("menyerah saat utang langsung bangkrut, wilayah kembali ke bank", async () => {
    const g = botGame(3, 1);
    g.state.tiles[39] = { owner: 1, level: 4, festival: false };
    g.state.players[1].money = 0;
    g.deciders[1] = Object.assign(Object.create(g.deciders[1]), { chooseDebt: async () => ({ type: "giveUp" }) });
    await g.charge(1, 100, 0);
    expect(g.state.players[1].bankrupt).toBe(true);
    expect(g.state.tiles[39].owner).toBeNull();
  });

  it("bisa nego jual ke pemain lain saat utang", async () => {
    const g = botGame(2, 1);
    g.state.tiles[39] = { owner: 1, level: 1, festival: false };
    g.state.players[1].money = 0;
    let asked = 0;
    g.deciders[1] = Object.assign(Object.create(g.deciders[1]), {
      chooseDebt: async (): Promise<DebtAction> =>
        asked++ === 0
          ? { type: "trade", offer: { from: 1, to: 0, giveTiles: [39], giveMoney: 0, takeTiles: [], takeMoney: 300 } }
          : { type: "giveUp" },
    });
    g.deciders[0] = Object.assign(Object.create(g.deciders[0]), { respondTrade: async () => ({ type: "accept" }) });
    await g.charge(1, 250, 0);
    expect(asked).toBe(1);
    expect(g.state.tiles[39].owner).toBe(0);
    expect(g.state.players[1].bankrupt).toBe(false);
    expect(g.state.players[1].money).toBe(50);
  });

  it("tawaran kapan saja diproses di checkpoint giliran pemain lain", async () => {
    const g = botGame(2, 1);
    g.state.tiles[39] = { owner: 0, level: 1, festival: false };
    g.forcedDice.push([1, 2]);
    g.deciders[0] = Object.assign(Object.create(g.deciders[0]), { respondTrade: async () => ({ type: "accept" }) });
    g.pool.add({ id: "x", player: 1, act: { type: "trade", offer: { from: 1, to: 0, giveTiles: [], giveMoney: 100, takeTiles: [39], takeMoney: 0 } } });
    await g.playTurn(); // giliran pemain 0
    expect(g.state.tiles[39].owner).toBe(1);
    expect(g.pool.size).toBe(0);
  });

  it("menu giliran manusia disela tawaran kapan saja lalu lanjut", async () => {
    const g = botGame(2, 1);
    g.state.tiles[39] = { owner: 1, level: 1, festival: false };
    g.forcedDice.push([1, 2]);
    let release: (v: null) => void = () => {};
    let menus = 0;
    const human = Object.assign(Object.create(g.deciders[0]), {
      chooseDeal: () => {
        menus++;
        return new Promise<null>((r) => (release = r));
      },
    });
    g.deciders[0] = interruptibleDeals(human, g.pool);
    g.deciders[1] = Object.assign(Object.create(g.deciders[1]), { respondTrade: async () => ({ type: "accept" }) });
    const turn = g.playTurn();
    await new Promise((r) => setTimeout(r, 0));
    g.pool.add({ id: "y", player: 0, act: { type: "trade", offer: { from: 0, to: 1, giveTiles: [], giveMoney: 100, takeTiles: [39], takeMoney: 0 } } });
    await new Promise((r) => setTimeout(r, 0));
    expect(g.state.tiles[39].owner).toBe(0); // diproses walau menu masih terbuka
    release(null);
    await turn;
    expect(menus).toBe(1); // menu yang sama dipakai lagi, tidak dibuka ulang
  });

  it("semua kartu konyol bisa dimainkan tanpa merusak state", async () => {
    for (const card of CARDS) {
      const g = botGame(4, 7);
      g.state.players[2].position = 10;
      g.state.players[2].islandTurns = 2;
      g.state.players[0].position = 6; // Paket Shopee
      g.forcedCard = card.id;
      await g.resolveTile(0);
      for (const p of g.state.players) {
        expect(p.money, card.id).toBeGreaterThanOrEqual(0);
        expect(p.position, card.id).toBeGreaterThanOrEqual(0);
        expect(p.position, card.id).toBeLessThan(BOARD.length);
        if (p.islandTurns > 0) expect(p.position, card.id).toBe(10);
      }
    }
  });

  it("kentut nuklir mendorong lawan mundur 2 petak", async () => {
    const g = botGame(3, 1);
    g.state.players[0].position = 6;
    g.state.players[1].position = 12;
    g.state.players[2].position = 1;
    g.forcedCard = "fart";
    await g.resolveTile(0);
    expect(g.state.players[1].position).toBe(10);
    expect(g.state.players[2].position).toBe(39);
  });

  it("mendarat di properti lawan hanya bayar sewa, tidak bisa direbut", async () => {
    const g = botGame(2, 1);
    g.state.players[0].money = 100000;
    g.state.players[0].position = 3;
    g.state.tiles[3] = { owner: 1, level: 3, festival: false };
    const rent = rentFor(g.state, 3);
    await g.resolveTile(0);
    expect(g.state.tiles[3].owner).toBe(1);
    expect(g.state.tiles[3].level).toBe(3);
    expect(g.state.players[0].money).toBe(100000 - rent);
  });

  it("kartu 'pergi ke' tidak memberi gaji kecuali tujuannya Mulai", async () => {
    const g = botGame(2, 1);
    g.state.players[0].position = 22; // Paket Blibli, Polri ada di belakang
    g.forcedCard = "ronda";
    await g.resolveTile(0);
    expect(g.state.players[0].position).toBe(11);
    expect(g.state.players[0].money).toBeLessThanOrEqual(CONFIG.startMoney);

    const h = botGame(2, 1);
    h.state.players[0].position = 35;
    h.forcedCard = "toStart";
    await h.resolveTile(0);
    expect(h.state.players[0].position).toBe(0);
    expect(h.state.players[0].money).toBe(CONFIG.startMoney + CONFIG.salary);
  });

  it("Atap Bocor hanya menagih bangunan, bukan tanah kosong / wisata", async () => {
    const g = botGame(2, 1);
    g.state.players[0].position = 6;
    g.state.tiles[1] = { owner: 0, level: 1, festival: false }; // tanah
    g.state.tiles[2] = { owner: 0, level: 1, festival: false }; // wisata
    g.state.tiles[3] = { owner: 0, level: 3, festival: false }; // rumah 2 = 2 bangunan
    g.forcedCard = "repair";
    await g.resolveTile(0);
    expect(g.state.players[0].money).toBe(CONFIG.startMoney - 2 * 20);
  });

  it("helikopter (kartu & event) selalu mendarat di petak lokasi", async () => {
    const isLocation = (i: number) => BOARD[i].kind === "property" || BOARD[i].kind === "resort";
    for (let seed = 1; seed <= 40; seed++) {
      const g = botGame(2, seed);
      g.state.players[0].position = 6;
      g.forcedCard = "heli";
      await g.resolveTile(0);
      expect(isLocation(g.state.players[0].position), `kartu seed ${seed}`).toBe(true);
      expect(g.state.players[0].islandTurns).toBe(0);

      const h = botGame(2, seed);
      const before = h.state.players.map((p) => p.position);
      await h.applyChaos(CHAOS_EVENTS.find((e) => e.id === "heli")!);
      const moved = h.state.players.findIndex((p, i) => p.position !== before[i]);
      expect(moved, `event seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(isLocation(h.state.players[moved].position), `event seed ${seed}`).toBe(true);
    }
  });

  it("Tukar Jiwa tidak memilih pemain di Nusakambangan", async () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = botGame(3, seed);
      g.state.players[0].position = 6;
      g.state.players[1].position = 10;
      g.state.players[1].islandTurns = 2;
      g.state.players[2].position = 25;
      g.forcedCard = "swap";
      await g.resolveTile(0);
      expect(g.state.players[1].position).toBe(10);
      expect(g.state.players[1].islandTurns).toBe(2);
      expect(g.state.players[2].position).toBe(6);
      expect(g.state.players[0].position).toBe(25);
    }
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
    s.tiles[29] = { owner: 0, level: 2, festival: false }; // harga 250 → sewa bulat, tanpa efek pembulatan
    const normal = rentFor(s, 29);
    s.season = { id: "turis", untilRound: 2 };
    expect(rentFor(s, 29)).toBe(normal * 2);
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

describe("negosiasi & pasar terbuka", () => {
  const scripted = (g: Game, replies: Record<number, import("../src/core/interfaces").TradeReply[]>) => {
    const bots = g.state.players.map(() => new BotDecider(g.state));
    g.deciders = bots.map((b, pid) => {
      const d = Object.create(b) as Decider;
      d.respondTrade = async () => replies[pid]?.shift() ?? { type: "reject" };
      return d;
    });
  };

  it("tukar wilayah + uang bila diterima", async () => {
    const g = botGame(2, 1);
    g.state.tiles[1] = { owner: 0, level: 2, festival: false };
    g.state.tiles[39] = { owner: 1, level: 1, festival: false };
    scripted(g, { 1: [{ type: "accept" }] });
    await g.applyDeal(0, { type: "trade", offer: { from: 0, to: 1, giveTiles: [1], giveMoney: 100, takeTiles: [39], takeMoney: 0 } });
    expect(g.state.tiles[1].owner).toBe(1);
    expect(g.state.tiles[39].owner).toBe(0);
    expect(g.state.players[0].money).toBe(CONFIG.startMoney - 100);
    expect(g.state.players[1].money).toBe(CONFIG.startMoney + 100);
  });

  it("ditolak → tidak ada yang berubah", async () => {
    const g = botGame(2, 1);
    g.state.tiles[39] = { owner: 1, level: 1, festival: false };
    scripted(g, { 1: [{ type: "reject" }] });
    await g.applyDeal(0, { type: "trade", offer: { from: 0, to: 1, giveTiles: [], giveMoney: 100, takeTiles: [39], takeMoney: 0 } });
    expect(g.state.tiles[39].owner).toBe(1);
    expect(g.state.players[0].money).toBe(CONFIG.startMoney);
  });

  it("tawar balik lalu diterima pengirim awal", async () => {
    const g = botGame(2, 1);
    g.state.tiles[39] = { owner: 1, level: 1, festival: false };
    scripted(g, {
      1: [{ type: "counter", offer: { from: 1, to: 0, giveTiles: [39], giveMoney: 0, takeTiles: [], takeMoney: 300 } }],
      0: [{ type: "accept" }],
    });
    await g.applyDeal(0, { type: "trade", offer: { from: 0, to: 1, giveTiles: [], giveMoney: 100, takeTiles: [39], takeMoney: 0 } });
    expect(g.state.tiles[39].owner).toBe(0);
    expect(g.state.players[0].money).toBe(CONFIG.startMoney - 300);
  });

  it("tawaran tidak sah diabaikan (wilayah bukan milik lawan)", async () => {
    const g = botGame(2, 1);
    scripted(g, { 1: [{ type: "accept" }] });
    await g.applyDeal(0, { type: "trade", offer: { from: 0, to: 1, giveTiles: [], giveMoney: 100, takeTiles: [39], takeMoney: 0 } });
    expect(g.state.tiles[39].owner).toBeNull();
    expect(g.state.players[0].money).toBe(CONFIG.startMoney);
  });

  it("pajang, beli, dan listing hilang saat pindah tangan", async () => {
    const g = botGame(3, 1);
    g.state.tiles[39] = { owner: 1, level: 1, festival: false };
    await g.applyDeal(1, { type: "list", tile: 39, price: 250 });
    expect(g.state.market).toEqual([{ tile: 39, seller: 1, price: 250 }]);
    await g.applyDeal(1, { type: "buy", tile: 39 }); // tidak bisa beli milik sendiri
    expect(g.state.tiles[39].owner).toBe(1);
    await g.applyDeal(2, { type: "buy", tile: 39 });
    expect(g.state.tiles[39].owner).toBe(2);
    expect(g.state.players[2].money).toBe(CONFIG.startMoney - 250);
    expect(g.state.players[1].money).toBe(CONFIG.startMoney + 250);
    expect(g.state.market).toEqual([]);
  });

  it("bot menolak tawaran yang membubarkan monopolinya", async () => {
    const g = botGame(2, 1);
    for (const t of PROPERTY_GROUPS[7]) g.state.tiles[t] = { owner: 1, level: 1, festival: false };
    const reply = await new BotDecider(g.state).respondTrade({
      player: 1,
      round: 0,
      canCounter: true,
      offer: { from: 0, to: 1, giveTiles: [], giveMoney: 900, takeTiles: [PROPERTY_GROUPS[7][0]], takeMoney: 0 },
    });
    expect(reply.type).toBe("reject");
  });
});

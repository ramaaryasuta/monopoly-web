import { describe, expect, it } from "vitest";
import { BotDecider } from "../src/core/bot";
import { Game } from "../src/core/game";
import {
  NullPresenter,
  type BuildChoice,
  type DealAction,
  type DealChoice,
  type DebtAction,
  type DebtChoice,
  type Decider,
  type IslandChoice,
  type ItemChoice,
  type TileChoice,
  type TradeReply,
  type TradeReplyChoice,
} from "../src/core/interfaces";
import { activeListings, flipOffer, tradeableTiles } from "../src/core/trade";
import type { GameState } from "../src/core/types";
import type { PlayerSetup } from "../src/core/types";
import { BroadcastDecider, RemoteDecider } from "../src/net/NetDecider";
import { interruptibleDeals, type Interjection } from "../src/core/interject";
import { normalizeCode } from "../src/net/Room";

/** "Manusia" yang pilihannya tidak bisa ditebak (Math.random) — hanya pesan jaringan yang menyamakan peer lain. */
class RandomHuman implements Decider {
  constructor(private state: GameState) {}
  async waitForRoll() {}
  async chooseDeal(c: DealChoice): Promise<DealAction | null> {
    const r = Math.random();
    if (r < 0.6) return null;
    const s = this.state;
    const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const mine = tradeableTiles(s, c.player);
    if (r < 0.75 && mine.length) return { type: "list", tile: pick(mine), price: 10 + Math.floor(Math.random() * 30) * 10 };
    const listings = activeListings(s).filter((l) => l.seller !== c.player);
    if (r < 0.85 && listings.length) return { type: "buy", tile: pick(listings).tile };
    const others = s.players.filter((p) => p.id !== c.player && !p.bankrupt);
    if (!others.length) return null;
    const to = pick(others).id;
    const theirs = tradeableTiles(s, to);
    return {
      type: "trade",
      offer: {
        from: c.player,
        to,
        giveTiles: mine.length && Math.random() < 0.5 ? [pick(mine)] : [],
        giveMoney: Math.random() < 0.5 ? Math.floor(Math.random() * Math.min(30, s.players[c.player].money / 10)) * 10 : 0,
        takeTiles: theirs.length ? [pick(theirs)] : [],
        takeMoney: 0,
      },
    };
  }
  async respondTrade(c: TradeReplyChoice): Promise<TradeReply> {
    const r = Math.random();
    if (r < 0.4) return { type: "accept" };
    if (r < 0.7 || !c.canCounter) return { type: "reject" };
    const counter = flipOffer(c.offer);
    counter.giveMoney = 0;
    return { type: "counter", offer: counter };
  }
  async chooseBuild(c: BuildChoice) {
    const all = [c.currentLevel, ...c.options.map((o) => o.level)];
    return all[Math.floor(Math.random() * all.length)];
  }
  async chooseDebt(c: DebtChoice): Promise<DebtAction> {
    const r = Math.random();
    if (r < 0.1) return { type: "giveUp" };
    if (r < 0.25 && c.tradesLeft > 0) {
      const others = this.state.players.filter((p) => p.id !== c.player && !p.bankrupt);
      const mine = tradeableTiles(this.state, c.player);
      if (others.length && mine.length) {
        const to = others[Math.floor(Math.random() * others.length)].id;
        return { type: "trade", offer: { from: c.player, to, giveTiles: [mine[0]], giveMoney: 0, takeTiles: [], takeMoney: 10 } };
      }
    }
    return { type: "sell", tile: c.tiles[Math.floor(Math.random() * c.tiles.length)].tile };
  }
  /** Tawaran acak di luar giliran (atau null). */
  randomOffer(me: number): DealAction | null {
    const s = this.state;
    if (s.players[me].bankrupt) return null;
    const others = s.players.filter((p) => p.id !== me && !p.bankrupt);
    if (!others.length) return null;
    const to = others[Math.floor(Math.random() * others.length)].id;
    const theirs = tradeableTiles(s, to);
    if (!theirs.length) return null;
    const money = Math.min(s.players[me].money, 10 * (1 + Math.floor(Math.random() * 20)));
    return { type: "trade", offer: { from: me, to, giveTiles: [], giveMoney: money, takeTiles: [theirs[0]], takeMoney: 0 } };
  }
  async chooseShield() {
    return Math.random() < 0.5;
  }
  async chooseIslandAction(c: IslandChoice) {
    return c.canPay && Math.random() < 0.5 ? ("pay" as const) : ("roll" as const);
  }
  async chooseTile(c: TileChoice) {
    return c.options[Math.floor(Math.random() * c.options.length)];
  }
  async chooseItem(c: ItemChoice) {
    if (Math.random() < 0.4) return null;
    const u = c.usable[Math.floor(Math.random() * c.usable.length)];
    return { item: u.item, target: u.targets.length ? u.targets[Math.floor(Math.random() * u.targets.length)] : null };
  }
}

type Owner = "A" | "B" | "C";
const PEERS: Owner[] = ["A", "B", "C"];
const HOST: Owner = "A";

/**
 * Simulasi 3 perangkat. Kursi: 0 = manusia di A (host), 1 = manusia di B, 2 = bot (dijalankan host), 3 = manusia di C.
 * Pesan dikirim asinkron dengan jeda acak agar urutan eksekusi antar peer berbeda-beda.
 * `rejoinBAfter`: setelah terputus, B masuk lagi (perangkat "baru") setelah host mencatat n aksi lagi —
 * host mengirim riwayat aksinya, B memutar ulang lalu melanjutkan sebagai manusia.
 */
function simulate(seed: number, opts: { dropBAfterActs?: number; anytime?: boolean; rejoinBAfter?: number } = {}) {
  const owners: Owner[] = ["A", "B", HOST, "C"];
  const kinds = ["human", "human", "bot", "human"] as const;
  const setups: PlayerSetup[] = owners.map((_, i) => ({ name: `P${i}`, color: "#fff", isBot: kinds[i] === "bot" }));
  const remotes: Record<Owner, (RemoteDecider | null)[]> = { A: [], B: [], C: [] };
  const games = {} as Record<Owner, Game>;
  const alive = new Set<Owner>(PEERS);
  let bActs = 0;
  /** Riwayat aksi menurut urutan host (seperti `Room.log`). */
  const hostLog: { p: number; k: string; v: unknown }[] = [];
  let tookOver = false;
  let afterDrop = 0;
  let rejoined: Promise<void> | null = null;
  /** B sudah masuk lagi: seperti Room asli, B menerima aksi peer lain lewat host (topologi bintang). */
  let bBack = false;
  const logAtHost = (p: number, k: string, v: unknown) => {
    hostLog.push({ p, k, v });
    if (tookOver && opts.rejoinBAfter !== undefined && !rejoined && ++afterDrop >= opts.rejoinBAfter) {
      rejoined = new Promise<void>((r) => queueMicrotask(() => r(rejoinB())));
    }
  };

  // Kanal andal & berurutan (seperti data channel WebRTC), tapi dengan jeda acak per tujuan
  const lane: Record<Owner, Promise<void>> = { A: Promise.resolve(), B: Promise.resolve(), C: Promise.resolve() };
  const deliver = (from: Owner, p: number, k: string, v: unknown) => {
    if (from === HOST) logAtHost(p, k, v);
    for (const to of PEERS) {
      if (to !== from && alive.has(to) && !(to === "B" && bBack && from !== HOST)) send(to, p, k, v, from);
    }
  };
  function send(to: Owner, p: number, k: string, v: unknown, from: Owner = HOST) {
    // Tujuan diikat saat dikirim (perangkat B lama ≠ perangkat B baru)
    const g = games[to];
    const r = remotes[to];
    lane[to] = lane[to]
      .then(() => (Math.random() < 0.2 ? new Promise<void>((res) => setTimeout(res, 0)) : undefined))
      .then(() => {
        if (to === HOST) {
          logAtHost(p, k, v);
          if (bBack && from !== "B") send("B", p, k, v);
        }
        if (k === "offer") g.pool.add(v as Interjection);
        else r[p]?.push(k, v);
      });
  }

  let offerSeq = 0;
  const makePeer = (peer: Owner, resume?: { p: number; from: number }) => {
    const g = new Game(setups, [], new NullPresenter(), { seed, maxTurns: 300 });
    const bot = new BotDecider(g.state);
    const mine: (RemoteDecider | null)[] = [];
    /** Perangkat ini sudah terputus (B lama tidak boleh mengirim lagi walau B baru masuk). */
    let dead = false;
    const online = () => !dead && alive.has(peer);
    const decideHere = async (cur: number) => {
      const list = g.pool.drain();
      if (online()) deliver(peer, cur, "sync", list);
      return list;
    };
    g.syncInterjections = async (cur) => {
      const r = mine[cur];
      if (!r) return decideHere(cur);
      const list = await r.sync(() => decideHere(cur));
      g.pool.markApplied(list);
      return list;
    };
    g.deciders = owners.map((o, pid) => {
      if (o === peer) {
        const human = new RandomHuman(g.state);
        const inner = kinds[pid] === "bot" ? bot : interruptibleDeals(human, g.pool);
        const local = new BroadcastDecider(inner, (k, v) => {
          // Manusia kadang mengirim tawaran kapan saja (di luar gilirannya)
          if (kinds[pid] === "human" && opts.anytime && online() && Math.random() < 0.15) {
            const act = human.randomOffer(pid);
            if (act) {
              const it: Interjection = { id: `${peer}${resume ? "2" : ""}:${++offerSeq}`, player: pid, act };
              g.pool.add(it);
              deliver(peer, pid, "offer", it);
            }
          }
          if (peer === "B" && !resume && opts.dropBAfterActs !== undefined) {
            if (dead) return;
            if (++bActs > opts.dropBAfterActs) {
              // B terputus: pesan ini tidak terkirim; host mengambil alih kursi 1 dengan bot
              dead = true;
              alive.delete("B");
              g.stop();
              const r = remotes.A[1]!;
              const hostGame = games.A;
              // Seperti WebRTC: pesan B yang sudah terkirim tiba dulu sebelum host tahu B terputus
              lane.A = lane.A.then(() => {
                r.takeover(new BroadcastDecider(new BotDecider(hostGame.state), (k2, v2) => deliver("A", 1, k2, v2)));
                tookOver = true;
              });
              return;
            }
          }
          deliver(peer, pid, k, v);
        });
        if (!resume) {
          mine.push(null);
          return local;
        }
        // Perangkat yang masuk lagi: kursinya sendiri diputar ulang dulu dari riwayat
        const r = new RemoteDecider();
        if (pid === resume.p) r.handover(resume.from, local);
        mine.push(r);
        return r;
      }
      const r = new RemoteDecider();
      mine.push(r);
      return r;
    });
    remotes[peer] = mine;
    games[peer] = g;
    return g;
  };

  /** Host menerima "hello" dari B yang kembali (atomik, seperti `Room.rejoin`). */
  const rejoinB = () => {
    const from = remotes.A[1]!.release();
    const g = makePeer("B", { p: 1, from });
    for (const a of hostLog) {
      if (a.k === "offer") g.pool.add(a.v as Interjection);
      else remotes.B[a.p]?.push(a.k, a.v);
    }
    alive.add("B");
    bBack = true;
    return g.run().then(() => {});
  };

  for (const peer of PEERS) makePeer(peer);
  return {
    games,
    run: async (only: Owner[] = PEERS) => {
      await Promise.all(PEERS.map((p) => { const r = games[p].run(); return only.includes(p) ? r : null; }));
      await rejoined;
    },
    get rejoined() {
      return !!rejoined;
    },
  };
}

const snapshot = (g: Game) => JSON.stringify(g.state);

describe("online lockstep", { timeout: 60000 }, () => {
  it("semua peer berakhir dengan state yang identik", async () => {
    for (const seed of [1, 42, 777]) {
      const { games, run } = simulate(seed);
      await run();
      expect(snapshot(games.B)).toBe(snapshot(games.A));
      expect(snapshot(games.C)).toBe(snapshot(games.A));
    }
  });

  it("tawaran kapan saja & jual aset saat utang tetap sinkron di semua peer", async () => {
    for (const seed of [3, 99, 2024, 31337]) {
      const { games, run } = simulate(seed, { anytime: true });
      await run();
      expect(snapshot(games.B)).toBe(snapshot(games.A));
      expect(snapshot(games.C)).toBe(snapshot(games.A));
    }
  });

  it("tawaran kapan saja + pemain terputus tetap sinkron", async () => {
    const { games, run } = simulate(8, { dropBAfterActs: 25, anytime: true });
    await run(["A", "C"]);
    expect(games.A.state.winner).not.toBeNull();
    expect(snapshot(games.C)).toBe(snapshot(games.A));
  });

  it("pemain terputus diambil alih bot oleh host, peer lain tetap sinkron", async () => {
    const { games, run } = simulate(5, { dropBAfterActs: 6 });
    await run(["A", "C"]);
    expect(games.A.state.winner).not.toBeNull();
    expect(snapshot(games.C)).toBe(snapshot(games.A));
  });

  it("pemain yang terputus bisa masuk lagi: riwayat diputar ulang & semua peer tetap sinkron", async () => {
    // Simulasinya acak: kadang B sudah bangkrut / game selesai sebelum sempat terputus → coba seed lain
    let rejoins = 0;
    for (let seed = 1; seed <= 40 && rejoins < 4; seed++) {
      const sim = simulate(seed, { dropBAfterActs: 3 + (seed % 4) * 6, rejoinBAfter: 1 + (seed % 3) * 8, anytime: seed % 2 === 0 });
      await sim.run(["A", "C"]);
      expect(sim.games.A.state.winner).not.toBeNull();
      expect(snapshot(sim.games.C)).toBe(snapshot(sim.games.A));
      if (!sim.rejoined) continue;
      rejoins++;
      expect(snapshot(sim.games.B)).toBe(snapshot(sim.games.A));
    }
    expect(rejoins).toBe(4);
  });

  it("menormalkan kode room", () => {
    expect(normalizeCode(" ab-c d9xyz")).toBe("ABCD9");
  });
});

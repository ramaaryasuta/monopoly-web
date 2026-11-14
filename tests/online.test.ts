import { describe, expect, it } from "vitest";
import { BotDecider } from "../src/core/bot";
import { Game } from "../src/core/game";
import {
  NullPresenter,
  type AcquireChoice,
  type BuildChoice,
  type DealAction,
  type DealChoice,
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
  async chooseAcquire(_c: AcquireChoice) {
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
 */
function simulate(seed: number, opts: { dropBAfterActs?: number } = {}) {
  const owners: Owner[] = ["A", "B", HOST, "C"];
  const kinds = ["human", "human", "bot", "human"] as const;
  const setups: PlayerSetup[] = owners.map((_, i) => ({ name: `P${i}`, color: "#fff", isBot: kinds[i] === "bot" }));
  const remotes: Record<Owner, (RemoteDecider | null)[]> = { A: [], B: [], C: [] };
  const games = {} as Record<Owner, Game>;
  const alive = new Set<Owner>(PEERS);
  let bActs = 0;

  // Kanal andal & berurutan (seperti data channel WebRTC), tapi dengan jeda acak per tujuan
  const lane: Record<Owner, Promise<void>> = { A: Promise.resolve(), B: Promise.resolve(), C: Promise.resolve() };
  const deliver = (from: Owner, p: number, k: string, v: unknown) => {
    for (const to of PEERS) {
      if (to === from || !alive.has(to)) continue;
      lane[to] = lane[to]
        .then(() => (Math.random() < 0.2 ? new Promise<void>((r) => setTimeout(r, 0)) : undefined))
        .then(() => remotes[to][p]?.push(k, v));
    }
  };

  for (const peer of PEERS) {
    const g = new Game(setups, [], new NullPresenter(), { seed, maxTurns: 300 });
    const bot = new BotDecider(g.state);
    g.deciders = owners.map((o, pid) => {
      if (o === peer) {
        remotes[peer].push(null);
        const inner = kinds[pid] === "bot" ? bot : new RandomHuman(g.state);
        return new BroadcastDecider(inner, (k, v) => {
          if (peer === "B" && opts.dropBAfterActs !== undefined) {
            if (!alive.has("B")) return;
            if (++bActs > opts.dropBAfterActs) {
              // B terputus: pesan ini tidak terkirim; host mengambil alih kursi 1 dengan bot
              alive.delete("B");
              g.stop();
              const r = remotes.A[1]!;
              const hostGame = games.A;
              // Seperti WebRTC: pesan B yang sudah terkirim tiba dulu sebelum host tahu B terputus
              lane.A = lane.A.then(() =>
                r.takeover(new BroadcastDecider(new BotDecider(hostGame.state), (k2, v2) => deliver("A", 1, k2, v2))),
              );
              return;
            }
          }
          deliver(peer, pid, k, v);
        });
      }
      const r = new RemoteDecider();
      remotes[peer].push(r);
      return r;
    });
    games[peer] = g;
  }
  return { games, run: (only: Owner[] = PEERS) => Promise.all(PEERS.map((p) => { const r = games[p].run(); return only.includes(p) ? r : null; })) };
}

const snapshot = (g: Game) => JSON.stringify(g.state);

describe("online lockstep", () => {
  it("semua peer berakhir dengan state yang identik", async () => {
    for (const seed of [1, 42, 777]) {
      const { games, run } = simulate(seed);
      await run();
      expect(snapshot(games.B)).toBe(snapshot(games.A));
      expect(snapshot(games.C)).toBe(snapshot(games.A));
    }
  });

  it("pemain terputus diambil alih bot oleh host, peer lain tetap sinkron", async () => {
    const { games, run } = simulate(5, { dropBAfterActs: 6 });
    await run(["A", "C"]);
    expect(games.A.state.winner).not.toBeNull();
    expect(snapshot(games.C)).toBe(snapshot(games.A));
  });

  it("menormalkan kode room", () => {
    expect(normalizeCode(" ab-c d9xyz")).toBe("ABCD9");
  });
});

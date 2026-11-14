import { BOARD } from "../data/board";
import type { AcquireChoice, BuildChoice, Decider, IslandChoice, ItemChoice, ItemUse, TileChoice } from "./interfaces";
import { ownsGroup, rentFor } from "./rules";
import type { GameState } from "./types";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Bot sederhana: menjaga cadangan uang, lebih agresif bila hampir monopoli. */
export class BotDecider implements Decider {
  constructor(
    private state: GameState,
    /** Fungsi delay agar bot terlihat "berpikir" di UI. 0 untuk test. */
    private thinkMs: () => number = () => 0,
  ) {}

  private async think() {
    const ms = this.thinkMs();
    if (ms > 0) await sleep(ms);
  }

  private reserve(player: number) {
    // Cadangan naik seiring ronde, karena sewa makin mahal
    return 150 + this.state.round * 15 + (this.state.players[player].money > 2500 ? 0 : 50);
  }

  async waitForRoll() {
    await this.think();
  }

  async chooseBuild(c: BuildChoice): Promise<number> {
    await this.think();
    const reserve = this.reserve(c.player);
    const affordable = c.options.filter((o) => c.money - o.cost >= reserve);
    // Landmark selalu diambil bila terjangkau
    const landmark = c.options.find((o) => o.level === 5);
    if (landmark) return landmark.level;
    if (affordable.length > 0) return affordable[affordable.length - 1].level;
    // Tanah murah tetap dibeli walau mepet, asal tidak habis total
    const first = c.options[0];
    if (c.currentLevel === 0 && c.money - first.cost >= 50) return first.level;
    return c.currentLevel;
  }

  async chooseAcquire(c: AcquireChoice): Promise<boolean> {
    await this.think();
    const def = BOARD[c.tile];
    const after = c.money - c.price;
    if (after < 100) return false;
    if (def.group !== undefined) {
      // Cek apakah akuisisi ini melengkapi grup
      const prevOwner = this.state.tiles[c.tile].owner;
      this.state.tiles[c.tile].owner = c.player;
      const completes = ownsGroup(this.state, c.player, def.group);
      this.state.tiles[c.tile].owner = prevOwner;
      if (completes) return true;
    }
    return after >= this.reserve(c.player) * 2;
  }

  async chooseIslandAction(c: IslandChoice): Promise<"pay" | "roll"> {
    await this.think();
    return c.canPay && this.state.players[c.player].money > 600 ? "pay" : "roll";
  }

  async chooseItem(c: ItemChoice): Promise<ItemUse | null> {
    await this.think();
    const s = this.state;
    const richest = (ids: number[]) => ids.reduce((a, b) => (s.players[b].money > s.players[a].money ? b : a));
    // Prioritas: kecoak di bangunan termahal lawan > tagih utang > sendal > turbo
    for (const u of c.usable) {
      if (u.item === "kecoak") {
        const t = u.targets.reduce((a, b) => (rentFor(s, b) > rentFor(s, a) ? b : a));
        return { item: u.item, target: t };
      }
    }
    for (const u of c.usable) {
      if (u.item === "utang") return { item: u.item, target: richest(u.targets) };
    }
    for (const u of c.usable) {
      if (u.item === "sandal") return { item: u.item, target: richest(u.targets) };
    }
    const turbo = c.usable.find((u) => u.item === "turbo");
    if (turbo) return { item: "turbo", target: null };
    return null;
  }

  async chooseTile(c: TileChoice): Promise<number> {
    await this.think();
    const me = this.state.players[c.player];
    if (c.purpose === "festival") {
      return c.options.reduce((best, t) => (rentFor(this.state, t) > rentFor(this.state, best) ? t : best));
    }
    // Wisata: cari properti kosong termahal yang terjangkau, atau milik sendiri untuk upgrade, atau Mulai
    const scored = c.options.map((t) => {
      const def = BOARD[t];
      const ts = this.state.tiles[t];
      let score = 0;
      if ((def.kind === "property" || def.kind === "resort") && ts.owner === null && (def.price ?? 0) <= me.money - 100)
        score = 100 + (def.price ?? 0) / 10;
      else if (ts.owner === c.player && ts.level < 5) score = 80 + ts.level;
      else if (def.kind === "start") score = 60;
      else if (ts.owner !== null && ts.owner !== c.player) score = -rentFor(this.state, t);
      return { t, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].t;
  }
}

import { BOARD, PROPERTY_GROUPS } from "../data/board";
import type {
  BuildChoice,
  DealAction,
  DealChoice,
  Decider,
  IslandChoice,
  ItemChoice,
  ItemUse,
  TileChoice,
  TradeOffer,
  TradeReply,
  TradeReplyChoice,
} from "./interfaces";
import { investedValue, ownsGroup, rentFor } from "./rules";
import { activeListings, flipOffer, MAX_TRADES_PER_TURN, offerGainFor, tradeError } from "./trade";
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
    if (c.options.length === 0) return c.currentLevel;
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

  // ---------------------------------------------------------------- negosiasi & pasar

  /** Apakah `player` memiliki seluruh grup bila kepemilikan petak diubah sementara. */
  private wouldOwnGroup(player: number, group: number, changes: [number, number][]) {
    const tiles = this.state.tiles;
    const prev = changes.map(([t]) => tiles[t].owner);
    changes.forEach(([t, o]) => (tiles[t].owner = o));
    const yes = ownsGroup(this.state, player, group);
    changes.forEach(([t], i) => (tiles[t].owner = prev[i]));
    return yes;
  }

  async chooseDeal(c: DealChoice): Promise<DealAction | null> {
    const s = this.state;
    const me = s.players[c.player];
    const reserve = this.reserve(c.player);

    // 1) Borong wilayah murah (atau pelengkap grup) di Pasar Terbuka
    for (const l of activeListings(s)) {
      if (l.seller === c.player || me.money - l.price < reserve) continue;
      const value = investedValue(s, l.tile);
      const g = BOARD[l.tile].group;
      const completes = g !== undefined && this.wouldOwnGroup(c.player, g, [[l.tile, c.player]]);
      if (l.price <= value * 1.2 || (completes && l.price <= value * 2.5)) {
        await this.think();
        return { type: "buy", tile: l.tile };
      }
    }

    // 2) Sesekali (deterministik, ±tiap 3 ronde) tawar beli petak terakhir untuk melengkapi grup
    if (c.tradesLeft === MAX_TRADES_PER_TURN && (s.round + c.player) % 3 === 0) {
      for (let g = 0; g < PROPERTY_GROUPS.length; g++) {
        const group = PROPERTY_GROUPS[g];
        const missing = group.filter((t) => s.tiles[t].owner !== c.player);
        if (missing.length !== 1) continue;
        const t = missing[0];
        const owner = s.tiles[t].owner;
        if (owner === null || s.players[owner].bankrupt) continue;
        const price = Math.ceil((investedValue(s, t) * 1.6 + 40) / 10) * 10;
        if (me.money - price < reserve) continue;
        const offer: TradeOffer = { from: c.player, to: owner, giveTiles: [], giveMoney: price, takeTiles: [t], takeMoney: 0 };
        if (tradeError(s, offer)) continue;
        await this.think();
        return { type: "trade", offer };
      }
    }
    return null;
  }

  /** Skor tawaran bagi `me` (= offer.to): nilai bersih + bonus/penalti strategis. */
  private scoreOffer(o: TradeOffer): number {
    const s = this.state;
    const me = o.to;
    let score = offerGainFor(s, o);
    const changes: [number, number][] = [...o.giveTiles.map((t): [number, number] => [t, me]), ...o.takeTiles.map((t): [number, number] => [t, o.from])];
    const groups = new Set([...o.giveTiles, ...o.takeTiles].flatMap((t) => (BOARD[t].group !== undefined ? [BOARD[t].group!] : [])));
    for (const g of groups) {
      const mineBefore = ownsGroup(s, me, g);
      const mineAfter = this.wouldOwnGroup(me, g, changes);
      const theirsBefore = ownsGroup(s, o.from, g);
      const theirsAfter = this.wouldOwnGroup(o.from, g, changes);
      if (mineBefore && !mineAfter) score -= 100000; // jangan pernah bubarkan monopoli sendiri
      if (!mineBefore && mineAfter) score += 300;
      if (!theirsBefore && theirsAfter) score -= 450; // jangan kasih lawan monopoli
    }
    return score;
  }

  async respondTrade(c: TradeReplyChoice): Promise<TradeReply> {
    await this.think();
    const s = this.state;
    const o = c.offer;
    const me = s.players[c.player];
    const given = o.takeTiles.reduce((sum, t) => sum + investedValue(s, t), 0) + o.takeMoney;
    const need = Math.max(20, Math.round(given * 0.1));
    const score = this.scoreOffer(o);
    const reserveOk = me.money - o.takeMoney >= Math.min(this.reserve(c.player), me.money);
    if (score >= need && reserveOk) return { type: "accept" };
    if (score < -5000 || !c.canCounter || c.round > 2) return { type: "reject" };

    // Tawar balik: minta tambahan uang supaya skornya pas
    const extra = Math.ceil((need - score + 10) / 10) * 10;
    const counter = flipOffer(o); // sudut pandang bot: give = yang bot beri, take = yang bot minta
    if (counter.giveMoney > 0) {
      const less = counter.giveMoney - extra;
      if (less >= 0) counter.giveMoney = less;
      else {
        counter.giveMoney = 0;
        counter.takeMoney = -less;
      }
    } else {
      counter.takeMoney += extra;
    }
    if (tradeError(s, counter) || counter.takeMoney > s.players[o.from].money) return { type: "reject" };
    return { type: "counter", offer: counter };
  }
}

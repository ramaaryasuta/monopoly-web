import type {
  BuildChoice,
  DealAction,
  DealChoice,
  Decider,
  IslandChoice,
  ItemChoice,
  ItemUse,
  TileChoice,
  TradeReply,
  TradeReplyChoice,
} from "../core/interfaces";

export type Kind = "roll" | "build" | "island" | "tile" | "item" | "deal" | "trade";

/** Membungkus decider lokal (manusia/bot) dan menyiarkan setiap keputusannya ke jaringan. */
export class BroadcastDecider implements Decider {
  constructor(
    private inner: Decider,
    private send: (k: Kind, v: unknown) => void,
  ) {}

  async waitForRoll(player: number) {
    await this.inner.waitForRoll(player);
    this.send("roll", null);
  }
  async chooseBuild(c: BuildChoice) {
    const v = await this.inner.chooseBuild(c);
    this.send("build", v);
    return v;
  }
  async chooseIslandAction(c: IslandChoice) {
    const v = await this.inner.chooseIslandAction(c);
    this.send("island", v);
    return v;
  }
  async chooseTile(c: TileChoice) {
    const v = await this.inner.chooseTile(c);
    this.send("tile", v);
    return v;
  }
  async chooseItem(c: ItemChoice) {
    const v = await this.inner.chooseItem(c);
    this.send("item", v);
    return v;
  }
  async chooseDeal(c: DealChoice) {
    const v = await this.inner.chooseDeal(c);
    this.send("deal", v);
    return v;
  }
  async respondTrade(c: TradeReplyChoice) {
    const v = await this.inner.respondTrade(c);
    this.send("trade", v);
    return v;
  }
}

interface Pending {
  kind: Kind;
  resolve: (v: unknown) => void;
  viaFallback: (d: Decider) => Promise<unknown>;
}

/**
 * Keputusan pemain di perangkat lain: menunggu pesan dari jaringan (antrian FIFO).
 * Bila pemainnya terputus, host bisa `takeover()` dengan bot.
 */
export class RemoteDecider implements Decider {
  private queue: { kind: string; v: unknown }[] = [];
  private pending: Pending | null = null;
  private fallback: Decider | null = null;

  constructor(
    /** Dipanggil saat mulai/berhenti menunggu pemain ini (untuk label "sedang mikir"). */
    private onWaiting: (waiting: boolean, kind: Kind) => void = () => {},
  ) {}

  push(kind: string, v: unknown) {
    const p = this.pending;
    if (p) {
      this.pending = null;
      this.check(p.kind, kind);
      this.onWaiting(false, p.kind);
      p.resolve(v);
    } else {
      this.queue.push({ kind, v });
    }
  }

  takeover(bot: Decider) {
    this.fallback = bot;
    const p = this.pending;
    if (p) {
      this.pending = null;
      this.onWaiting(false, p.kind);
      void p.viaFallback(bot).then(p.resolve);
    }
  }

  private check(expected: Kind, got: string) {
    if (expected !== got) console.warn(`[online] desync? menunggu "${expected}" tapi dapat "${got}"`);
  }

  private next<T>(kind: Kind, viaFallback: (d: Decider) => Promise<T>): Promise<T> {
    const q = this.queue.shift();
    if (q) {
      this.check(kind, q.kind);
      return Promise.resolve(q.v as T);
    }
    if (this.fallback) return viaFallback(this.fallback);
    this.onWaiting(true, kind);
    return new Promise<T>((resolve) => {
      this.pending = { kind, resolve: resolve as (v: unknown) => void, viaFallback };
    });
  }

  async waitForRoll(player: number) {
    await this.next("roll", (d) => d.waitForRoll(player));
  }
  chooseBuild(c: BuildChoice) {
    return this.next("build", (d) => d.chooseBuild(c));
  }
  chooseIslandAction(c: IslandChoice) {
    return this.next("island", (d) => d.chooseIslandAction(c));
  }
  chooseTile(c: TileChoice) {
    return this.next("tile", (d) => d.chooseTile(c));
  }
  chooseItem(c: ItemChoice) {
    return this.next<ItemUse | null>("item", (d) => d.chooseItem(c));
  }
  chooseDeal(c: DealChoice) {
    return this.next<DealAction | null>("deal", (d) => d.chooseDeal(c));
  }
  respondTrade(c: TradeReplyChoice) {
    return this.next<TradeReply>("trade", (d) => d.respondTrade(c));
  }
}

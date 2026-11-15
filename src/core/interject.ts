import type { DealAction, Decider, DealChoice } from "./interfaces";

/**
 * Aksi "kapan saja": negosiasi / transaksi pasar yang dikirim pemain di luar gilirannya.
 *
 * Aksi masuk ke `InterjectionPool` di setiap perangkat, lalu diterapkan di titik
 * sinkron (checkpoint) dalam game. Yang menentukan aksi mana yang diterapkan di
 * checkpoint adalah pemilik keputusan pemain yang sedang giliran (lihat `Game.checkpoint`),
 * sehingga semua perangkat menerapkan aksi yang sama di titik yang sama (lockstep).
 */
export interface Interjection {
  /** Id unik (pengirim + nomor urut). */
  id: string;
  player: number;
  act: DealAction;
}

export function isInterjection(v: unknown, player: number): v is Interjection {
  const i = v as Interjection | null;
  return !!i && typeof i.id === "string" && i.player === player && !!i.act && typeof i.act === "object";
}

export class InterjectionPool {
  private items: Interjection[] = [];
  private applied = new Set<string>();
  private listeners = new Set<() => void>();

  get size() {
    return this.items.length;
  }

  has(player: number) {
    return this.items.some((i) => i.player === player);
  }

  add(it: Interjection) {
    if (this.applied.has(it.id) || this.items.some((i) => i.id === it.id)) return;
    this.items.push(it);
    for (const fn of [...this.listeners]) fn();
  }

  /** Ambil semua aksi yang menunggu (dipakai oleh penentu urutan di checkpoint). */
  drain(): Interjection[] {
    const out = this.items;
    this.items = [];
    for (const i of out) this.applied.add(i.id);
    return out;
  }

  /** Tandai aksi yang sudah diterapkan oleh penentu urutan di perangkat lain. */
  markApplied(list: Interjection[]) {
    for (const i of list) this.applied.add(i.id);
    this.items = this.items.filter((i) => !this.applied.has(i.id));
  }

  /** Resolve saat ada aksi baru (atau langsung bila sudah ada). Return: fungsi batal. */
  whenAny(fn: () => void): () => void {
    if (this.items.length) {
      fn();
      return () => {};
    }
    const once = () => {
      this.listeners.delete(once);
      fn();
    };
    this.listeners.add(once);
    return () => this.listeners.delete(once);
  }
}

/**
 * Bungkus decider manusia: menu awal giliran (chooseDeal) bisa "disela" oleh aksi kapan saja
 * yang masuk ke pool. Hasilnya `{ type: "sync" }` → game memproses pool, lalu bertanya lagi;
 * menu yang sedang terbuka tetap dipakai (tidak dibuka ulang).
 */
export function interruptibleDeals(inner: Decider, pool: InterjectionPool): Decider {
  let pending: Promise<DealAction | null> | null = null;
  return {
    waitForRoll: (p) => inner.waitForRoll(p),
    chooseBuild: (c) => inner.chooseBuild(c),
    chooseIslandAction: (c) => inner.chooseIslandAction(c),
    chooseTile: (c) => inner.chooseTile(c),
    chooseItem: (c) => inner.chooseItem(c),
    respondTrade: (c) => inner.respondTrade(c),
    chooseDebt: (c) => inner.chooseDebt(c),
    chooseDeal: async (c: DealChoice) => {
      if (pool.size > 0) return { type: "sync" };
      pending ??= inner.chooseDeal(c);
      const mine = pending;
      let cancel = () => {};
      const interrupted = new Promise<"sync">((r) => (cancel = pool.whenAny(() => r("sync"))));
      const v = await Promise.race([mine, interrupted]);
      cancel();
      if (v === "sync") return { type: "sync" };
      pending = null;
      return v;
    },
  };
}

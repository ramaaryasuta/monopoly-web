import { rp } from "./money";
import { BOARD, BOARD_SIZE, ISLAND_INDEX, TOUR_INDEX } from "../data/board";
import {
  CARDS,
  CHAOS_CHANCE,
  CHAOS_EVENTS,
  ITEMS,
  MAX_ITEMS,
  SANDAL_STEPS,
  SEASON_CHANCE,
  SEASON_IDS,
  SEASON_ROUNDS,
  SEASONS,
  TURBO_STEPS,
  UTANG_AMOUNT,
  type Card,
  type ChaosEvent,
  type ItemId,
  type SeasonId,
} from "../data/cards";
import type { DealAction, Decider, ItemChoice, ItemUse, Presenter, TradeOffer } from "./interfaces";
import { InterjectionPool, type Interjection } from "./interject";
import { createRng, rollDie, type Rng } from "./rng";
import {
  activePlayers,
  checkMonopolyWin,
  CONFIG,
  createGame,
  inFirstLap,
  LEVEL_NAMES,
  maxTargetLevel,
  ownedTiles,
  rentFor,
  richestPlayer,
  salaryFor,
  seasonalCost,
  sellValue,
  upgradeCost,
} from "./rules";
import {
  activeListings,
  describeOffer,
  MAX_COUNTERS,
  MAX_TRADES_PER_TURN,
  tradeError,
  validMarketPrice,
} from "./trade";
import type { BuildLevel, GameState, PlayerSetup, WinReason } from "./types";

export interface GameOptions {
  seed?: number;
  /** Pengaman untuk test/simulasi agar tidak loop selamanya. */
  maxTurns?: number;
  /** Acak pemain yang jalan duluan (memakai RNG game, jadi sama di semua peer online). */
  randomStart?: boolean;
}

const fmt = rp;

export class Game {
  readonly state: GameState;
  readonly rng: Rng;
  readonly seed: number;
  /** Antrian dadu paksa (fitur QA): setiap entri [d1, d2]. */
  forcedDice: [number, number][] = [];
  /** Kartu paksa (fitur QA): id kartu berikutnya. */
  forcedCard: string | null = null;
  /** Event konyol paksa (fitur QA): id event di awal giliran berikutnya. */
  forcedChaos: string | null = null;
  /** Event musiman paksa (fitur QA): mulai di awal giliran berikutnya. */
  forcedSeason: SeasonId | null = null;
  /** Aksi kapan saja (nego / pasar di luar giliran) yang menunggu diterapkan. */
  readonly pool = new InterjectionPool();
  /**
   * Ambil aksi kapan saja untuk satu checkpoint. Default (main lokal): kuras pool.
   * Online: pemilik keputusan pemain giliran (`current`) yang menentukan, lalu disiarkan.
   */
  syncInterjections: (current: number) => Promise<Interjection[]> = async () => this.pool.drain();
  /** Jumlah tawaran kapan saja per pemain di giliran ini (dibatasi seperti jatah giliran). */
  private interjectTrades = new Map<number, number>();
  private chaosRound = 1;
  private turns = 0;
  private stopped = false;

  constructor(
    setups: PlayerSetup[],
    public deciders: Decider[],
    public presenter: Presenter,
    private options: GameOptions = {},
  ) {
    this.seed = options.seed ?? Math.floor(Math.random() * 1e9);
    this.rng = createRng(this.seed);
    this.state = createGame(setups);
    if (options.randomStart) {
      const first = Math.floor(this.rng() * setups.length);
      this.state.current = first;
      this.state.firstPlayer = first;
    }
  }

  stop() {
    this.stopped = true;
  }

  get currentPlayer() {
    return this.state.players[this.state.current];
  }

  async run(): Promise<GameState> {
    const max = this.options.maxTurns ?? Infinity;
    if (this.options.randomStart && this.turns === 0) {
      this.presenter.message(`🎲 Diundi: ${this.currentPlayer.name} jalan duluan!`, "good");
    }
    while (this.state.winner === null && !this.stopped && this.turns < max) {
      await this.playTurn();
      this.turns++;
    }
    if (this.state.winner !== null) await this.presenter.gameOver(this.state);
    return this.state;
  }

  // ---------------------------------------------------------------- turn flow

  async playTurn(): Promise<void> {
    const p = this.currentPlayer;
    const decider = this.deciders[p.id];
    await this.maybeChaos();
    if (this.state.winner !== null) return;
    if (p.bankrupt) {
      this.endTurn();
      return;
    }
    await this.presenter.turnStart(this.state, p.id);
    this.interjectTrades.clear();
    await this.checkpoint();
    if (this.state.winner !== null) return;

    if (p.pendingTour) {
      p.pendingTour = false;
      await this.doTour(p.id);
      await this.checkpoint();
      this.endTurn();
      return;
    }

    // Negosiasi & Pasar Terbuka sebelum lempar dadu
    await this.dealPhase(p.id);
    if (this.state.winner !== null || p.bankrupt || this.stopped) {
      this.endTurn();
      return;
    }

    // Kartu simpanan boleh dipakai sekali sebelum lempar dadu pertama
    let bonus = await this.maybeUseItem(p.id);
    if (this.state.winner !== null || p.bankrupt) {
      this.endTurn();
      return;
    }

    let doubles = 0;
    while (!this.stopped) {
      if (p.islandTurns > 0) {
        await this.islandTurn(p.id);
        break;
      }

      await decider.waitForRoll(p.id);
      const [d1, d2] = this.roll();
      await this.presenter.diceRolled(p.id, d1, d2);
      const isDouble = d1 === d2;

      if (isDouble) {
        doubles++;
        if (doubles === 3) {
          this.presenter.message(`${p.name} melempar dadu kembar 3x — dijebloskan ke Nusakambangan!`, "bad");
          await this.sendToIsland(p.id);
          break;
        }
      }

      await this.moveSteps(p.id, d1 + d2 + bonus);
      bonus = 0;
      await this.resolveTile(p.id);

      if (this.state.winner !== null || p.bankrupt) break;
      if (!isDouble || p.islandTurns > 0 || p.pendingTour) break;
      await this.checkpoint();
      if (this.state.winner !== null) break;
      this.presenter.message(`Dadu kembar! ${p.name} melempar lagi.`, "good");
    }

    await this.checkpoint();
    this.endTurn();
  }

  private roll(): [number, number] {
    const forced = this.forcedDice.shift();
    if (forced) return forced;
    return [rollDie(this.rng), rollDie(this.rng)];
  }

  private async islandTurn(pid: number) {
    const p = this.state.players[pid];
    const decider = this.deciders[pid];
    const canPay = p.money >= CONFIG.islandBail;
    const action = await decider.chooseIslandAction({
      player: pid,
      bail: CONFIG.islandBail,
      canPay,
      turnsLeft: p.islandTurns,
    });

    if (action === "pay" && canPay) {
      this.addMoney(pid, -CONFIG.islandBail);
      p.islandTurns = 0;
      this.presenter.message(`${p.name} nyogok sipir ${fmt(CONFIG.islandBail)} dan keluar lewat pintu belakang. Bebas!`);
      await decider.waitForRoll(pid);
      const [d1, d2] = this.roll();
      await this.presenter.diceRolled(pid, d1, d2);
      await this.moveSteps(pid, d1 + d2);
      await this.resolveTile(pid);
      return;
    }

    await decider.waitForRoll(pid);
    const [d1, d2] = this.roll();
    await this.presenter.diceRolled(pid, d1, d2);
    if (d1 === d2) {
      p.islandTurns = 0;
      this.presenter.message(`${p.name} dapat dadu kembar dan kabur dari Nusakambangan!`, "good");
      await this.moveSteps(pid, d1 + d2);
      await this.resolveTile(pid);
    } else {
      p.islandTurns--;
      this.presenter.message(
        p.islandTurns > 0
          ? `${p.name} masih terjebak (${p.islandTurns} giliran lagi).`
          : `${p.name} akan bebas di giliran berikutnya.`,
      );
    }
  }

  private async doTour(pid: number) {
    const p = this.state.players[pid];
    const options = BOARD.map((t) => t.index).filter((i) => i !== TOUR_INDEX);
    const dest = await this.deciders[pid].chooseTile({ player: pid, purpose: "tour", options });
    if (p.money >= CONFIG.tourFee) {
      this.addMoney(pid, -CONFIG.tourFee);
    }
    this.presenter.message(`${p.name} terbang ke ${BOARD[dest].name}.`);
    const steps = (dest - p.position + BOARD_SIZE) % BOARD_SIZE;
    await this.moveSteps(pid, steps, "fly");
    await this.resolveTile(pid);
  }

  private endTurn() {
    if (this.state.winner !== null) return;
    const alive = activePlayers(this.state);
    if (alive.length <= 1) {
      this.declareWinner(alive[0], "lastStanding");
      return;
    }
    let next = this.state.current;
    do {
      next = (next + 1) % this.state.players.length;
      if (next === this.state.firstPlayer) this.state.round++;
    } while (this.state.players[next].bankrupt);
    // Ronde naik setiap pemain pertama yang masih hidup memulai lagi
    this.state.current = next;
    if (this.state.round > CONFIG.roundLimit) {
      this.state.round = CONFIG.roundLimit;
      this.declareWinner(richestPlayer(this.state), "roundLimit");
    }
  }

  // ---------------------------------------------------------------- movement

  /** `salary = false`: lewat Mulai tidak memberi gaji (dipakai kartu "pergi ke"). */
  async moveSteps(pid: number, steps: number, mode: "walk" | "fly" = "walk", salary = true) {
    const p = this.state.players[pid];
    const path: number[] = [];
    let passedStart = false;
    for (let i = 1; i <= steps; i++) {
      const idx = (p.position + i) % BOARD_SIZE;
      path.push(idx);
      if (idx === 0) passedStart = true;
    }
    if (path.length === 0) return;
    await this.presenter.movePawn(pid, path, mode);
    p.position = path[path.length - 1];
    if (passedStart) p.laps++;
    if (passedStart && salary) {
      const amount = salaryFor(this.state);
      this.addMoney(pid, amount);
      this.presenter.message(`${p.name} melewati Mulai: +${fmt(amount)}`, "good");
    }
  }

  private async moveBack(pid: number, steps: number) {
    const p = this.state.players[pid];
    const path: number[] = [];
    for (let i = 1; i <= steps; i++) path.push((p.position - i + BOARD_SIZE) % BOARD_SIZE);
    await this.presenter.movePawn(pid, path, "walk");
    p.position = path[path.length - 1];
  }

  private async sendToIsland(pid: number) {
    const p = this.state.players[pid];
    if (p.position !== ISLAND_INDEX) {
      await this.presenter.movePawn(pid, [ISLAND_INDEX], "fly");
      p.position = ISLAND_INDEX;
    }
    p.islandTurns = CONFIG.islandTurns;
  }

  // ---------------------------------------------------------------- tiles

  async resolveTile(pid: number): Promise<void> {
    const p = this.state.players[pid];
    const def = BOARD[p.position];
    switch (def.kind) {
      case "start":
        return;
      case "property":
      case "resort":
        return this.resolveOwnable(pid, p.position);
      case "chance":
        return this.drawCard(pid);
      case "tax": {
        const tax = Math.max(50, Math.round((p.money * CONFIG.taxRate) / 10) * 10);
        this.presenter.message(`${p.name} membayar uang ormas ${fmt(tax)}.`, "bad");
        await this.charge(pid, tax, null);
        return;
      }
      case "island":
        this.presenter.message(`${p.name} dijebloskan ke Nusakambangan! Kasihan...`, "bad");
        await this.sendToIsland(pid);
        return;
      case "festival":
        return this.hostFestival(pid);
      case "tour":
        p.pendingTour = true;
        this.presenter.message(`${p.name} naik Pesawat Negara! Giliran berikutnya pilih mau mendarat di mana.`);
        return;
    }
  }

  private async resolveOwnable(pid: number, tile: number) {
    const ts = this.state.tiles[tile];
    const p = this.state.players[pid];

    if (ts.owner === null) {
      await this.offerBuild(pid, tile);
      return;
    }
    if (ts.owner === pid) {
      await this.offerBuild(pid, tile);
      return;
    }

    // Milik lawan: bayar sewa
    const owner = this.state.players[ts.owner];
    const rent = rentFor(this.state, tile);
    if (p.shields > 0) {
      p.shields--;
      this.presenter.message(`Kartu pelindung menyelamatkan ${p.name} dari sewa ${fmt(rent)}!`, "good");
    } else {
      this.presenter.message(`${p.name} membayar sewa ${fmt(rent)} ke ${owner.name}.`, "bad");
      await this.charge(pid, rent, owner.id);
    }
  }

  private async offerBuild(pid: number, tile: number) {
    const ts = this.state.tiles[tile];
    const p = this.state.players[pid];
    if (this.state.season?.id === "banjir") {
      this.presenter.message(`Lagi banjir! ${p.name} tidak bisa beli/bangun di ${BOARD[tile].name}.`);
      return;
    }
    const max = maxTargetLevel(this.state, tile, pid);
    const options: { level: number; cost: number }[] = [];
    const unaffordable: { level: number; cost: number }[] = [];
    for (let l = ts.level + 1; l <= max; l++) {
      // Landmark hanya bisa sendiri (tidak dari level < 4)
      const cost = seasonalCost(this.state, upgradeCost(tile, ts.level, l));
      (cost <= p.money ? options : unaffordable).push({ level: l, cost });
    }
    if (options.length === 0 && unaffordable.length === 0) return;
    if (options.length === 0 && ts.owner === null) {
      this.presenter.message(`${p.name} tidak punya cukup uang untuk membeli ${BOARD[tile].name}.`);
    }
    // Tetap tanya walau semua tidak terjangkau: pemain manusia melihat tombol nonaktif.
    const target = await this.deciders[pid].chooseBuild({
      player: pid,
      tile,
      currentLevel: ts.level,
      options,
      unaffordable,
      money: p.money,
      firstLap: inFirstLap(this.state, pid) && BOARD[tile].kind === "property",
    });
    const chosen = options.find((o) => o.level === target);
    if (!chosen) return;
    this.addMoney(pid, -chosen.cost);
    const wasUnowned = ts.owner === null;
    ts.owner = pid;
    ts.level = chosen.level as BuildLevel;
    const what = BOARD[tile].kind === "resort" ? "tempat wisata" : LEVEL_NAMES[ts.level];
    this.presenter.message(
      wasUnowned
        ? `${p.name} membeli ${BOARD[tile].name} (${what}) seharga ${fmt(chosen.cost)}.`
        : `${p.name} membangun ${what} di ${BOARD[tile].name} (${fmt(chosen.cost)}).`,
      "good",
    );
    await this.presenter.tileChanged(this.state, tile);
    this.checkMonopoly(pid);
  }

  private async hostFestival(pid: number) {
    const p = this.state.players[pid];
    const options = ownedTiles(this.state, pid);
    if (options.length === 0) {
      this.presenter.message(`${p.name} datang ke Pesta Pejabat tapi belum punya properti buat dijadikan tempat pesta.`);
      return;
    }
    const tile = await this.deciders[pid].chooseTile({ player: pid, purpose: "festival", options });
    const prev = this.state.festivalTile;
    if (prev !== null) {
      this.state.tiles[prev].festival = false;
      await this.presenter.tileChanged(this.state, prev);
    }
    this.state.festivalTile = tile;
    this.state.tiles[tile].festival = true;
    this.presenter.message(`Pesta Pejabat di ${BOARD[tile].name}! Sewa jadi x${CONFIG.festivalMultiplier}.`, "good");
    await this.presenter.tileChanged(this.state, tile);
  }

  private async drawCard(pid: number) {
    const p = this.state.players[pid];
    let card: Card;
    if (this.forcedCard) {
      card = CARDS.find((c) => c.id === this.forcedCard) ?? CARDS[0];
      this.forcedCard = null;
    } else {
      card = CARDS[Math.floor(this.rng() * CARDS.length)];
    }
    await this.presenter.showCard(pid, card);
    const e = card.effect;
    switch (e.type) {
      case "gain":
        this.addMoney(pid, e.amount);
        return;
      case "pay":
        await this.charge(pid, e.amount, null);
        return;
      case "repair": {
        // Hanya bangunan yang dihitung: tanah kosong & tempat wisata tidak kena biaya.
        const levels = ownedTiles(this.state, pid).reduce(
          (s, i) => s + (BOARD[i].kind === "property" ? Math.max(0, this.state.tiles[i].level - 1) : 0),
          0,
        );
        const cost = levels * e.perLevel;
        if (cost > 0) await this.charge(pid, cost, null);
        return;
      }
      case "shield":
        p.shields++;
        return;
      case "goto": {
        const steps = (e.tile - p.position + BOARD_SIZE) % BOARD_SIZE;
        // Dipanggil langsung ke tujuan: hanya dapat gaji kalau tujuannya memang petak Mulai.
        await this.moveSteps(pid, steps, "fly", e.tile === 0);
        await this.resolveTile(pid);
        return;
      }
      case "island":
        await this.sendToIsland(pid);
        return;
      case "collectFromAll":
        for (const other of this.state.players) {
          if (other.id === pid || other.bankrupt) continue;
          await this.charge(other.id, e.amount, pid);
          if (this.state.winner !== null) return;
        }
        return;
      case "back":
        await this.moveBack(pid, e.steps);
        await this.resolveTile(pid);
        return;
      case "forward":
        await this.moveSteps(pid, e.steps);
        await this.resolveTile(pid);
        return;
      case "payAll":
        for (const other of this.state.players) {
          if (other.id === pid || other.bankrupt) continue;
          await this.charge(pid, e.amount, other.id);
          if (p.bankrupt || this.state.winner !== null) return;
        }
        return;
      case "stealRichest": {
        const others = activePlayers(this.state).filter((i) => i !== pid);
        if (others.length === 0) return;
        const victim = others.reduce((a, b) => (this.state.players[b].money > this.state.players[a].money ? b : a));
        const amt = Math.min(e.amount, this.state.players[victim].money);
        if (amt <= 0) return;
        this.presenter.message(`${p.name} "pinjam" ${fmt(amt)} dari ${this.state.players[victim].name}.`, "good");
        this.addMoney(victim, -amt);
        this.addMoney(pid, amt);
        return;
      }
      case "gacha": {
        const steps = (e.max - e.min) / 10;
        const amt = e.min + Math.floor(this.rng() * (steps + 1)) * 10;
        if (amt >= 0) {
          this.presenter.message(`Mesin capit dapat boneka! ${p.name} +${fmt(amt)}`, "good");
          this.addMoney(pid, amt);
        } else {
          this.presenter.message(`Mesin capit makan koin! ${p.name} −${fmt(-amt)}`, "bad");
          await this.charge(pid, -amt, null);
        }
        return;
      }
      case "pushOthers":
        for (const other of this.state.players) {
          // Yang terjebak di pulau aman dari kentut (angin laut)
          if (other.id === pid || other.bankrupt || other.islandTurns > 0) continue;
          await this.moveBack(other.id, e.steps);
        }
        return;
      case "swap": {
        // Pemain di Nusakambangan dijaga ketat: tidak bisa diajak tukar posisi.
        const others = activePlayers(this.state).filter((i) => i !== pid && this.state.players[i].islandTurns === 0);
        if (others.length === 0) return;
        const o = this.state.players[others[Math.floor(this.rng() * others.length)]];
        const a = p.position;
        const b = o.position;
        this.presenter.message(`${p.name} dan ${o.name} tukar tempat!`);
        if (a === b) return;
        await this.presenter.movePawn(p.id, [b], "fly");
        p.position = b;
        await this.presenter.movePawn(o.id, [a], "fly");
        o.position = a;
        return;
      }
      case "randomTile": {
        const dest = this.heliDestination(p.position);
        this.presenter.message(`Helikopter menurunkan ${p.name} di ${BOARD[dest].name}.`);
        if (dest !== p.position) {
          await this.presenter.movePawn(pid, [dest], "fly");
          p.position = dest;
        }
        await this.resolveTile(pid);
        return;
      }
      case "item": {
        const def = ITEMS[e.item];
        if (p.items.length >= MAX_ITEMS) {
          this.presenter.message(`Kantong ${p.name} penuh! ${def.name} dijual ke tukang loak: +${fmt(50)}.`);
          this.addMoney(pid, 50);
        } else {
          p.items.push(e.item);
          this.presenter.message(`${p.name} menyimpan ${def.icon} ${def.name} di kantong.`, "good");
        }
        return;
      }
    }
  }

  // ---------------------------------------------------------------- items

  /** Kartu simpanan yang bisa dipakai pemain saat ini, beserta sasaran sahnya. */
  usableItems(pid: number): ItemChoice["usable"] {
    const p = this.state.players[pid];
    const others = activePlayers(this.state).filter((i) => i !== pid);
    const seen = new Set<ItemId>();
    const out: ItemChoice["usable"] = [];
    for (const item of p.items) {
      if (seen.has(item)) continue;
      seen.add(item);
      let targets: number[] = [];
      switch (item) {
        case "sandal":
          targets = others.filter((i) => this.state.players[i].islandTurns === 0);
          break;
        case "utang":
          targets = others.filter((i) => this.state.players[i].money > 0);
          break;
        case "turbo":
          if (p.islandTurns > 0) continue;
          break;
        case "kecoak":
          // Tanah (level 1) dan landmark kebal kecoak
          targets = this.state.tiles.flatMap((t, i) =>
            t.owner !== null && t.owner !== pid && BOARD[i].kind === "property" && t.level >= 2 && t.level <= 4 ? [i] : [],
          );
          break;
      }
      if (ITEMS[item].target !== null && targets.length === 0) continue;
      out.push({ item, targets });
    }
    return out;
  }

  /** Tawarkan kartu simpanan sebelum lempar dadu. Mengembalikan langkah bonus (Sepatu Roda Turbo). */
  private async maybeUseItem(pid: number): Promise<number> {
    const usable = this.usableItems(pid);
    if (usable.length === 0) return 0;
    const use = await this.deciders[pid].chooseItem({ player: pid, usable });
    if (!use) return 0;
    return this.applyItem(pid, use);
  }

  async applyItem(pid: number, use: ItemUse): Promise<number> {
    const p = this.state.players[pid];
    const option = this.usableItems(pid).find((u) => u.item === use.item);
    if (!option) return 0;
    const def = ITEMS[use.item];
    if (def.target !== null && (use.target === null || !option.targets.includes(use.target))) return 0;
    p.items.splice(p.items.indexOf(use.item), 1);
    await this.presenter.itemUsed(pid, use);

    switch (use.item) {
      case "sandal": {
        const v = this.state.players[use.target!];
        this.presenter.message(`${p.name} melempar Sendal Terbang ke ${v.name}! Mundur ${SANDAL_STEPS} petak.`, "bad");
        await this.moveBack(v.id, SANDAL_STEPS);
        return 0;
      }
      case "utang": {
        const v = this.state.players[use.target!];
        const amt = Math.min(UTANG_AMOUNT, v.money);
        this.presenter.message(`${p.name} menagih surat utang palsu ke ${v.name}: ${fmt(amt)}!`, "bad");
        this.addMoney(v.id, -amt);
        this.addMoney(pid, amt);
        return 0;
      }
      case "turbo":
        this.presenter.message(`${p.name} pakai Sepatu Roda Turbo: lemparan ini +${TURBO_STEPS} langkah!`, "good");
        return TURBO_STEPS;
      case "kecoak": {
        const tile = use.target!;
        const ts = this.state.tiles[tile];
        const owner = this.state.players[ts.owner!];
        ts.level = (ts.level - 1) as BuildLevel;
        this.presenter.message(
          `Karyawan ${owner.name} di ${BOARD[tile].name} resign! Terjadi efisiensi, bangunan turun jadi ${LEVEL_NAMES[ts.level]}.`,
          "bad",
        );
        await this.presenter.tileChanged(this.state, tile);
        return 0;
      }
    }
  }

  // ---------------------------------------------------------------- negosiasi & pasar

  /** Sebelum lempar dadu, pemain giliran boleh bernegosiasi / berdagang di Pasar Terbuka berkali-kali. */
  private async dealPhase(pid: number) {
    const p = this.state.players[pid];
    let trades = 0;
    for (let n = 0; n < 20 && !this.stopped; n++) {
      this.cleanMarket();
      const act = await this.deciders[pid].chooseDeal({
        player: pid,
        tradesLeft: Math.max(0, MAX_TRADES_PER_TURN - trades),
        hasItems: this.usableItems(pid).length > 0,
        inIsland: p.islandTurns > 0,
      });
      if (!act) return;
      if (act.type === "sync") {
        n--; // bukan aksi pemain giliran: tidak memakan jatah putaran
        await this.checkpoint();
        if (this.state.winner !== null || p.bankrupt) return;
        continue;
      }
      if (act.type === "trade") {
        if (trades >= MAX_TRADES_PER_TURN) {
          this.presenter.message(`${p.name} sudah ${MAX_TRADES_PER_TURN}x menawar di giliran ini.`);
          continue;
        }
        trades++;
      }
      await this.applyDeal(pid, act);
      if (this.state.winner !== null || p.bankrupt) return;
    }
  }

  async applyDeal(pid: number, act: DealAction): Promise<void> {
    const p = this.state.players[pid];
    switch (act?.type) {
      case "trade":
        if (act.offer?.from !== pid) return;
        return this.negotiate(act.offer);
      case "list": {
        const ts = this.state.tiles[act.tile];
        if (!ts || ts.owner !== pid || !validMarketPrice(act.price)) return;
        const def = BOARD[act.tile];
        if (def.kind !== "property" && def.kind !== "resort") return;
        this.state.market = this.state.market.filter((l) => l.tile !== act.tile);
        this.state.market.push({ tile: act.tile, seller: pid, price: act.price });
        this.presenter.message(`🏪 ${p.name} memajang ${def.name} di Pasar Terbuka seharga ${fmt(act.price)}.`);
        await this.presenter.marketChanged(this.state);
        return;
      }
      case "unlist": {
        const before = this.state.market.length;
        this.state.market = this.state.market.filter((l) => !(l.tile === act.tile && l.seller === pid));
        if (this.state.market.length === before) return;
        this.presenter.message(`🏪 ${p.name} menarik ${BOARD[act.tile].name} dari Pasar Terbuka.`);
        await this.presenter.marketChanged(this.state);
        return;
      }
      case "buy": {
        const l = activeListings(this.state).find((x) => x.tile === act.tile);
        if (!l || l.seller === pid || p.money < l.price) return;
        const seller = this.state.players[l.seller];
        this.addMoney(pid, -l.price);
        this.addMoney(seller.id, l.price);
        this.state.tiles[l.tile].owner = pid;
        this.cleanMarket();
        this.presenter.message(`🏪 ${p.name} membeli ${BOARD[l.tile].name} dari ${seller.name} di Pasar Terbuka seharga ${fmt(l.price)}!`, "good");
        await this.presenter.tileChanged(this.state, l.tile);
        await this.presenter.marketChanged(this.state);
        this.checkMonopoly(pid);
        return;
      }
    }
  }

  /** Tawar-menawar: pihak penerima menerima, menolak, atau menawar balik (bergantian). */
  private async negotiate(first: TradeOffer) {
    let o = first;
    for (let round = 0; !this.stopped; round++) {
      const err = tradeError(this.state, o);
      if (err) {
        this.presenter.message(`🤝 Tawaran batal: ${err}.`, "bad");
        return;
      }
      const from = this.state.players[o.from];
      const to = this.state.players[o.to];
      this.presenter.message(`🤝 ${from.name} ${round === 0 ? "menawarkan" : "menawar balik"} ke ${to.name}: ${describeOffer(this.state, o)}`);
      const canCounter = round < MAX_COUNTERS;
      await this.presenter.tradeProposed(this.state, o, round);
      const reply = await this.deciders[o.to].respondTrade({ player: o.to, offer: o, round, canCounter });
      if (reply?.type === "accept") {
        await this.executeTrade(o);
        return;
      }
      if (reply?.type === "counter" && canCounter && reply.offer?.from === o.to && reply.offer?.to === o.from) {
        o = reply.offer;
        continue;
      }
      this.presenter.message(`🙅 ${to.name} menolak tawaran ${from.name}.`, "bad");
      await this.presenter.tradeResolved(this.state, o, false);
      return;
    }
  }

  private async executeTrade(o: TradeOffer) {
    const from = this.state.players[o.from];
    const to = this.state.players[o.to];
    if (o.giveMoney > 0) {
      this.addMoney(o.from, -o.giveMoney);
      this.addMoney(o.to, o.giveMoney);
    }
    if (o.takeMoney > 0) {
      this.addMoney(o.to, -o.takeMoney);
      this.addMoney(o.from, o.takeMoney);
    }
    for (const t of o.giveTiles) this.state.tiles[t].owner = o.to;
    for (const t of o.takeTiles) this.state.tiles[t].owner = o.from;
    this.cleanMarket();
    this.presenter.message(`🤝 Deal! ${to.name} menerima tawaran ${from.name}.`, "good");
    for (const t of [...o.giveTiles, ...o.takeTiles]) await this.presenter.tileChanged(this.state, t);
    await this.presenter.tradeResolved(this.state, o, true);
    // Pemain giliran dicek dulu, lalu lawannya
    const order = o.from === this.state.current ? [o.from, o.to] : [o.to, o.from];
    for (const pid of order) if (this.checkMonopoly(pid)) return;
  }

  /**
   * Titik sinkron untuk aksi kapan saja. Dipanggil di titik yang sama di semua perangkat;
   * isinya ditentukan oleh `syncInterjections` (pemilik keputusan pemain giliran).
   */
  private async checkpoint() {
    if (this.state.winner !== null || this.stopped) return;
    const list = await this.syncInterjections(this.state.current);
    for (const it of list) {
      await this.applyInterjection(it);
      if (this.state.winner !== null || this.stopped) return;
    }
  }

  async applyInterjection(it: Interjection) {
    const p = this.state.players[it.player];
    if (!p || p.bankrupt || !it.act || it.act.type === "sync") return;
    this.cleanMarket();
    if (it.act.type === "trade") {
      const used = this.interjectTrades.get(it.player) ?? 0;
      if (used >= MAX_TRADES_PER_TURN) {
        this.presenter.message(`${p.name} sudah ${MAX_TRADES_PER_TURN}x menawar di giliran ini. Tunggu giliran berikutnya ya.`);
        return;
      }
      this.interjectTrades.set(it.player, used + 1);
    }
    await this.applyDeal(it.player, it.act);
  }

  /** Buang listing yang sudah tidak sah (wilayah pindah tangan / penjual bangkrut). */
  private cleanMarket() {
    if (this.state.market.length === 0) return;
    const valid = activeListings(this.state);
    if (valid.length !== this.state.market.length) this.state.market = valid;
  }

  // ---------------------------------------------------------------- chaos

  /** Di awal ronde baru, kadang muncul event konyol untuk seluruh pulau. */
  private async maybeChaos() {
    let ev: ChaosEvent | undefined;
    if (this.forcedChaos) {
      ev = CHAOS_EVENTS.find((c) => c.id === this.forcedChaos);
      this.forcedChaos = null;
    } else if (this.state.round !== this.chaosRound) {
      if (this.rng() < CHAOS_CHANCE) ev = CHAOS_EVENTS[Math.floor(this.rng() * CHAOS_EVENTS.length)];
    }
    const newRound = this.state.round !== this.chaosRound;
    if (newRound) this.chaosRound = this.state.round;

    // Event musiman: selesai bila lewat masanya, lalu mungkin mulai yang baru
    const season = this.state.season;
    if (newRound && season && this.state.round > season.untilRound) {
      this.state.season = null;
      await this.presenter.showSeason(SEASONS[season.id], true);
    }
    if (ev) await this.applyChaos(ev);
    if (this.state.winner !== null) return;

    let next: SeasonId | null = null;
    if (this.forcedSeason) {
      next = this.forcedSeason;
      this.forcedSeason = null;
    } else if (newRound && !this.state.season && this.rng() < SEASON_CHANCE) {
      next = SEASON_IDS[Math.floor(this.rng() * SEASON_IDS.length)];
    }
    if (next) {
      this.state.season = { id: next, untilRound: this.state.round + SEASON_ROUNDS - 1 };
      await this.presenter.showSeason(SEASONS[next], false);
    }
  }

  async applyChaos(ev: ChaosEvent) {
    const alive = activePlayers(this.state);
    const money = (i: number) => this.state.players[i].money;
    const e = ev.effect;
    let targets: number[] = alive;
    if (e.type === "randomGain" || e.type === "randomPay" || e.type === "heliAbduct")
      targets = [alive[Math.floor(this.rng() * alive.length)]];
    else if (e.type === "poorestGain") targets = [alive.reduce((a, b) => (money(b) < money(a) ? b : a))];
    else if (e.type === "robinHood") targets = [alive.reduce((a, b) => (money(b) > money(a) ? b : a))];

    await this.presenter.showEvent(ev, targets);
    const name = this.state.players[targets[0]].name;

    switch (e.type) {
      case "allGain":
        for (const id of alive) this.addMoney(id, e.amount);
        return;
      case "allPay":
        for (const id of alive) {
          await this.charge(id, e.amount, null);
          if (this.state.winner !== null) return;
        }
        return;
      case "randomGain":
      case "poorestGain":
        this.presenter.message(`${name} kecipratan rezeki +${fmt(e.amount)}!`, "good");
        this.addMoney(targets[0], e.amount);
        return;
      case "randomPay":
        this.presenter.message(`${name} apes, −${fmt(e.amount)}.`, "bad");
        await this.charge(targets[0], e.amount, null);
        return;
      case "robinHood": {
        const rich = targets[0];
        const others = alive.filter((i) => i !== rich);
        const share = Math.floor(Math.min(e.amount, money(rich)) / Math.max(1, others.length) / 10) * 10;
        if (share <= 0) return;
        this.presenter.message(`Maling budiman merampok ${name} dan bagi-bagi ${fmt(share)} per orang!`);
        this.addMoney(rich, -share * others.length);
        for (const o of others) this.addMoney(o, share);
        return;
      }
      case "heliAbduct": {
        const v = this.state.players[targets[0]];
        // Yang sedang di pulau tetap di pulau supaya aturan pulau konsisten
        if (v.islandTurns > 0) {
          this.presenter.message(`Helikopter mau jemput ${v.name}, tapi penjagaan Nusakambangan terlalu ketat. Batal!`);
          return;
        }
        const dest = this.heliDestination(v.position);
        this.presenter.message(`${v.name} diangkut helikopter pejabat ke ${BOARD[dest].name}!`);
        if (dest !== v.position) {
          await this.presenter.movePawn(v.id, [dest], "fly");
          v.position = dest;
        }
        return;
      }
      case "nothing":
        return;
    }
  }

  // ---------------------------------------------------------------- money

  /**
   * Tujuan helikopter (kartu & event): petak lokasi acak (properti/wisata) selain posisi sekarang.
   * Tidak pernah sudut atau petak Paket, jadi tidak bisa menjebloskan ke penjara atau memicu kartu berantai.
   */
  private heliDestination(from: number): number {
    const options = BOARD.filter((t) => (t.kind === "property" || t.kind === "resort") && t.index !== from).map((t) => t.index);
    return options[Math.floor(this.rng() * options.length)];
  }

  private addMoney(pid: number, delta: number) {
    if (delta === 0) return;
    this.state.players[pid].money += delta;
    this.presenter.moneyChanged(this.state, pid, delta);
  }

  /** Tagih pemain. Jika kurang, pemain mencari uang dulu (jual aset / nego); jika masih kurang → bangkrut. */
  async charge(pid: number, amount: number, creditor: number | null) {
    const p = this.state.players[pid];
    if (p.money < amount) await this.raiseFunds(pid, amount, creditor);

    if (p.money >= amount) {
      this.addMoney(pid, -amount);
      if (creditor !== null) this.addMoney(creditor, amount);
      return;
    }

    // Bangkrut
    const paid = p.money;
    this.addMoney(pid, -paid);
    if (creditor !== null) this.addMoney(creditor, paid);
    p.bankrupt = true;
    this.presenter.message(`${p.name} BANGKRUT!`, "bad");
    for (const t of ownedTiles(this.state, pid)) await this.releaseTile(t);
    await this.presenter.playerBankrupt(this.state, pid);

    const alive = activePlayers(this.state);
    if (alive.length === 1) this.declareWinner(alive[0], "lastStanding");
  }

  /** Uang kurang: pemain memilih wilayah yang dijual ke bank, menawar ke pemain lain, atau menyerah. */
  private async raiseFunds(pid: number, needed: number, creditor: number | null) {
    const p = this.state.players[pid];
    let trades = 0;
    let announced = false;
    for (let n = 0; n < 80 && p.money < needed && !this.stopped && this.state.winner === null; n++) {
      const tiles = ownedTiles(this.state, pid)
        .map((tile) => ({ tile, value: sellValue(this.state, tile) }))
        .sort((a, b) => a.value - b.value);
      if (tiles.length === 0) return;
      if (!announced) {
        announced = true;
        this.presenter.message(`💸 Uang ${p.name} kurang ${fmt(needed - p.money)}! Jual aset atau nego dulu...`, "bad");
      }
      const act = await this.deciders[pid].chooseDebt({
        player: pid,
        amount: needed,
        money: p.money,
        creditor,
        tiles,
        tradesLeft: Math.max(0, MAX_TRADES_PER_TURN - trades),
      });
      if (act?.type === "giveUp") return;
      if (act?.type === "sell") {
        const t = tiles.find((x) => x.tile === act.tile);
        if (!t) continue;
        this.presenter.message(`${p.name} menjual ${BOARD[t.tile].name} ke bank seharga ${fmt(t.value)}.`, "bad");
        this.addMoney(pid, t.value);
        await this.releaseTile(t.tile);
        continue;
      }
      if (act?.type === "trade" && trades < MAX_TRADES_PER_TURN && act.offer?.from === pid) {
        trades++;
        await this.negotiate(act.offer);
      }
    }
  }

  private async releaseTile(tile: number) {
    const ts = this.state.tiles[tile];
    ts.owner = null;
    ts.level = 0;
    this.cleanMarket();
    if (ts.festival) {
      ts.festival = false;
      this.state.festivalTile = null;
    }
    await this.presenter.tileChanged(this.state, tile);
  }

  // ---------------------------------------------------------------- win

  private checkMonopoly(pid: number): boolean {
    const reason = checkMonopolyWin(this.state, pid);
    if (reason) {
      this.declareWinner(pid, reason);
      return true;
    }
    return false;
  }

  private declareWinner(pid: number, reason: WinReason) {
    if (this.state.winner !== null) return;
    this.state.winner = pid;
    this.state.winReason = reason;
  }
}


import { BOARD, BOARD_SIZE, ISLAND_INDEX, TOUR_INDEX } from "../data/board";
import { CARDS, type Card } from "../data/cards";
import type { Decider, Presenter } from "./interfaces";
import { createRng, rollDie, type Rng } from "./rng";
import {
  acquirePrice,
  activePlayers,
  canAcquire,
  checkMonopolyWin,
  CONFIG,
  createGame,
  LEVEL_NAMES,
  maxTargetLevel,
  ownedTiles,
  rentFor,
  richestPlayer,
  sellValue,
  upgradeCost,
} from "./rules";
import type { BuildLevel, GameState, PlayerSetup, WinReason } from "./types";

export interface GameOptions {
  seed?: number;
  /** Pengaman untuk test/simulasi agar tidak loop selamanya. */
  maxTurns?: number;
}

const fmt = (n: number) => n.toLocaleString("id-ID");

export class Game {
  readonly state: GameState;
  readonly rng: Rng;
  readonly seed: number;
  /** Antrian dadu paksa (fitur QA): setiap entri [d1, d2]. */
  forcedDice: [number, number][] = [];
  /** Kartu paksa (fitur QA): id kartu berikutnya. */
  forcedCard: string | null = null;
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
  }

  stop() {
    this.stopped = true;
  }

  get currentPlayer() {
    return this.state.players[this.state.current];
  }

  async run(): Promise<GameState> {
    const max = this.options.maxTurns ?? Infinity;
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
    await this.presenter.turnStart(this.state, p.id);

    if (p.pendingTour) {
      p.pendingTour = false;
      await this.doTour(p.id);
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
          this.presenter.message(`${p.name} melempar dadu kembar 3x — terdampar di pulau!`, "bad");
          await this.sendToIsland(p.id);
          break;
        }
      }

      await this.moveSteps(p.id, d1 + d2);
      await this.resolveTile(p.id);

      if (this.state.winner !== null || p.bankrupt) break;
      if (!isDouble || p.islandTurns > 0 || p.pendingTour) break;
      this.presenter.message(`Dadu kembar! ${p.name} melempar lagi.`, "good");
    }

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
      this.presenter.message(`${p.name} membayar ${fmt(CONFIG.islandBail)} untuk kapal penyelamat.`);
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
      this.presenter.message(`${p.name} dapat dadu kembar dan kabur dari pulau!`, "good");
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
      if (next === 0) this.state.round++;
    } while (this.state.players[next].bankrupt);
    // Ronde naik setiap pemain pertama yang masih hidup memulai lagi
    this.state.current = next;
    if (this.state.round > CONFIG.roundLimit) {
      this.state.round = CONFIG.roundLimit;
      this.declareWinner(richestPlayer(this.state), "roundLimit");
    }
  }

  // ---------------------------------------------------------------- movement

  async moveSteps(pid: number, steps: number, mode: "walk" | "fly" = "walk") {
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
    if (passedStart) {
      this.addMoney(pid, CONFIG.salary);
      this.presenter.message(`${p.name} melewati Mulai: +${fmt(CONFIG.salary)}`, "good");
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
        this.presenter.message(`${p.name} membayar pajak ${fmt(tax)}.`, "bad");
        await this.charge(pid, tax, null);
        return;
      }
      case "island":
        this.presenter.message(`${p.name} terdampar di Pulau Terpencil!`, "bad");
        await this.sendToIsland(pid);
        return;
      case "festival":
        return this.hostFestival(pid);
      case "tour":
        p.pendingTour = true;
        this.presenter.message(`${p.name} akan memilih tujuan Wisata Dunia di giliran berikutnya.`);
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
      this.presenter.message(`Perisai Ajaib melindungi ${p.name} dari sewa ${fmt(rent)}!`, "good");
    } else {
      this.presenter.message(`${p.name} membayar sewa ${fmt(rent)} ke ${owner.name}.`, "bad");
      await this.charge(pid, rent, owner.id);
    }
    if (p.bankrupt || this.state.winner !== null) return;

    // Akuisisi
    if (canAcquire(this.state, tile, pid)) {
      const price = acquirePrice(this.state, tile);
      const yes = await this.deciders[pid].chooseAcquire({
        player: pid,
        tile,
        price,
        owner: owner.id,
        money: p.money,
      });
      if (yes) {
        this.addMoney(pid, -price);
        this.addMoney(owner.id, price);
        ts.owner = pid;
        this.presenter.message(`${p.name} mengakuisisi ${BOARD[tile].name} dari ${owner.name} seharga ${fmt(price)}!`, "good");
        await this.presenter.tileChanged(this.state, tile);
        if (this.checkMonopoly(pid)) return;
        await this.offerBuild(pid, tile);
      }
    }
  }

  private async offerBuild(pid: number, tile: number) {
    const ts = this.state.tiles[tile];
    const p = this.state.players[pid];
    const max = maxTargetLevel(this.state, tile);
    const options: { level: number; cost: number }[] = [];
    for (let l = ts.level + 1; l <= max; l++) {
      // Landmark hanya bisa sendiri (tidak dari level < 4)
      const cost = upgradeCost(tile, ts.level, l);
      if (cost <= p.money) options.push({ level: l, cost });
    }
    if (options.length === 0) {
      if (ts.owner === null) this.presenter.message(`${p.name} tidak punya cukup uang untuk membeli ${BOARD[tile].name}.`);
      return;
    }
    const target = await this.deciders[pid].chooseBuild({
      player: pid,
      tile,
      currentLevel: ts.level,
      options,
      money: p.money,
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
      this.presenter.message(`${p.name} menikmati Festival Bintang. Belum ada properti untuk dimeriahkan.`);
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
    this.presenter.message(`Festival di ${BOARD[tile].name}! Sewa jadi x${CONFIG.festivalMultiplier}.`, "good");
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
        const levels = ownedTiles(this.state, pid).reduce((s, i) => s + this.state.tiles[i].level, 0);
        const cost = levels * e.perLevel;
        if (cost > 0) await this.charge(pid, cost, null);
        return;
      }
      case "shield":
        p.shields++;
        return;
      case "goto": {
        const steps = (e.tile - p.position + BOARD_SIZE) % BOARD_SIZE;
        await this.moveSteps(pid, steps, "fly");
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
    }
  }

  // ---------------------------------------------------------------- money

  private addMoney(pid: number, delta: number) {
    if (delta === 0) return;
    this.state.players[pid].money += delta;
    this.presenter.moneyChanged(this.state, pid, delta);
  }

  /** Tagih pemain. Jika kurang, properti dijual otomatis; jika masih kurang → bangkrut. */
  async charge(pid: number, amount: number, creditor: number | null) {
    const p = this.state.players[pid];
    if (p.money < amount) await this.liquidate(pid, amount);

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

  private async liquidate(pid: number, needed: number) {
    const p = this.state.players[pid];
    const tiles = ownedTiles(this.state, pid).sort((a, b) => sellValue(this.state, a) - sellValue(this.state, b));
    for (const t of tiles) {
      if (p.money >= needed) break;
      const value = sellValue(this.state, t);
      this.presenter.message(`${p.name} menjual ${BOARD[t].name} seharga ${fmt(value)}.`, "bad");
      this.addMoney(pid, value);
      await this.releaseTile(t);
    }
  }

  private async releaseTile(tile: number) {
    const ts = this.state.tiles[tile];
    ts.owner = null;
    ts.level = 0;
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


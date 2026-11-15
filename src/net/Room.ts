import Peer, { type DataConnection, type MediaConnection } from "peerjs";

/**
 * Room online peer-to-peer (WebRTC via PeerJS).
 *
 * Topologi bintang: semua tamu tersambung ke host; host meneruskan pesan.
 * Server PeerJS publik hanya dipakai untuk "jabat tangan" (signaling) —
 * data permainan mengalir langsung antar browser.
 *
 * Model sinkronisasi: lockstep deterministik. Semua peer menjalankan `Game`
 * dengan seed yang sama; yang dikirim hanya KEPUTUSAN pemain (lempar dadu,
 * beli, pilih petak, negosiasi...). Bot dijalankan oleh host.
 */

export const PROTOCOL = 3;
const PREFIX = "pulaukaya-v1-";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I biar tidak salah baca
export const CODE_LEN = 5;
export const MAX_SEATS = 4;

export type SeatKind = "host" | "guest" | "bot";
export interface Seat {
  /** Peer id pemilik kursi (bot: peer id host + "#bot<n>"). */
  id: string;
  name: string;
  char: number;
  kind: SeatKind;
}

/** Status voice chat satu peer (disiarkan ke semua lewat host). */
export interface VoiceState {
  on: boolean;
  mute: boolean;
  deaf: boolean;
}

export interface StartInfo {
  seed: number;
  seats: Seat[];
}

/** Tamu yang masuk lagi ke game yang sedang berjalan. */
export interface ResumeInfo {
  /** Kursi milik perangkat ini. */
  p: number;
  /** Indeks keputusan kursi `p` yang pertama kali dibuat lagi oleh perangkat ini. */
  from: number;
}

type Act = { p: number; k: string; v: unknown };

type Msg =
  | { t: "hello"; v: number; name: string; token?: string }
  | { t: "lobby"; seats: Seat[] }
  | { t: "setMe"; name?: string; char?: number }
  | { t: "reject"; reason: string }
  | { t: "start"; seed: number; seats: Seat[] }
  | { t: "act"; p: number; k: string; v: unknown }
  | { t: "left"; p: number }
  | { t: "resume"; seed: number; seats: Seat[]; log: Act[]; p: number; from: number }
  | { t: "back"; p: number; id: string }
  | { t: "voice"; id: string; on: boolean; mute: boolean; deaf: boolean }
  | { t: "ping" }
  | { t: "pong" };

/** Satu nama bawaan per karakter (urutannya sama dengan CRITTERS). */
const BOT_NAMES = ["Kentang", "Om Mata", "Cabai", "Timun", "Paus", "Kucing"];

const PING_EVERY_MS = 3000;
const DEAD_AFTER_MS = 10000;

/**
 * Heartbeat: WebRTC bisa butuh >30 detik untuk sadar lawannya menutup tab.
 * Dianggap mati bila ping terakhir tidak dibalas dalam 10 detik. Dibandingkan dengan
 * waktu kirim ping (bukan "terakhir dengar") supaya tab di latar belakang yang
 * timer-nya diperlambat browser tidak salah memutus koneksi.
 */
function watchConn(conn: DataConnection, onDead: () => void) {
  let pingSentAt = 0;
  let pongAt = 0;
  const timer = setInterval(() => {
    const now = Date.now();
    if (pingSentAt && pongAt < pingSentAt && now - pingSentAt > DEAD_AFTER_MS) {
      stop();
      onDead();
      return;
    }
    if (!pingSentAt || pongAt >= pingSentAt) {
      pingSentAt = now;
      if (conn.open) conn.send({ t: "ping" } satisfies Msg);
    }
  }, PING_EVERY_MS);
  const stop = () => clearInterval(timer);
  const pc = conn.peerConnection;
  if (pc) {
    pc.addEventListener("iceconnectionstatechange", () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
        stop();
        onDead();
      }
    });
  }
  conn.on("close", stop);
  /** Tangani ping/pong; true bila pesan sudah ditangani. */
  return (m: Msg): boolean => {
    if (m.t === "ping") {
      if (conn.open) conn.send({ t: "pong" } satisfies Msg);
      return true;
    }
    if (m.t === "pong") {
      pongAt = Date.now();
      return true;
    }
    return false;
  };
}

export function genCode(): string {
  let s = "";
  const buf = new Uint32Array(CODE_LEN);
  crypto.getRandomValues(buf);
  for (const n of buf) s += ALPHABET[n % ALPHABET.length];
  return s;
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN);
}

// ------------------------------------------------------------------ sesi (untuk reconnect)

/**
 * Identitas perangkat untuk sambung ulang. Bukan IP: browser tidak bisa membaca IP-nya
 * sendiri, satu Wi-Fi bisa berbagi IP, dan IP HP berubah saat pindah jaringan.
 * Token acak di localStorage tetap sama walau halaman dimuat ulang.
 */
const SESSION_KEY = "pulaukaya-session";
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export interface SavedSession {
  code: string;
  token: string;
  name: string;
  at: number;
}

export function loadSession(): SavedSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as SavedSession | null;
    if (!s || typeof s.code !== "string" || typeof s.token !== "string") return null;
    if (Date.now() - s.at > SESSION_TTL_MS) return null;
    return s;
  } catch {
    return null;
  }
}

function newToken(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : genCode() + genCode() + Date.now();
}

function saveSession(code: string, name: string): string {
  const old = loadSession();
  const token = old?.code === code ? old.token : newToken();
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ code, token, name, at: Date.now() } satisfies SavedSession));
  } catch {
    /* mode privat: reconnect tidak tersedia */
  }
  return token;
}

/** Perbarui waktu sesi (dipanggil berkala selama game) supaya tidak kedaluwarsa. */
export function touchSession() {
  const s = loadSession();
  if (!s) return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, at: Date.now() }));
  } catch {
    /* abaikan */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* abaikan */
  }
}

const cleanName = (n: unknown) => (typeof n === "string" ? n.trim().slice(0, 12) : "") || "Pemain";

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, { debug: 1 }) : new Peer({ debug: 1 });
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new Error("Server penghubung tidak merespons. Cek koneksi internet."));
    }, 12000);
    const onError = (e: Error) => {
      clearTimeout(timer);
      peer.destroy();
      reject(e);
    };
    peer.once("open", () => {
      clearTimeout(timer);
      // Error setelah terbuka (mis. panggilan suara ke peer yang sudah pergi) tidak boleh menghancurkan peer
      peer.off("error", onError);
      resolve(peer);
    });
    peer.once("error", onError);
  });
}

export class Room {
  seats: Seat[] = [];
  started = false;
  private conns = new Map<string, DataConnection>();
  private hostConn: DataConnection | null = null;
  private actBuffer: Act[] = [];
  /** Host: semua aksi sejak game dimulai, urut — dikirim ke tamu yang tersambung kembali. */
  private log: Act[] = [];
  private seed = 0;
  /** Host: token sambung ulang per peer id (lobi) dan per kursi (setelah mulai). */
  private tokenOf = new Map<string, string>();
  private seatTokens: (string | undefined)[] = [];
  /** Tamu: terisi bila perangkat ini masuk lagi ke game yang sedang berjalan. */
  resume: ResumeInfo | null = null;
  /** Seed game (dari pesan resume). */
  resumeSeed = 0;
  private _onAct: ((p: number, k: string, v: unknown) => void) | null = null;
  private closed = false;
  private seatListeners = new Set<(seats: Seat[]) => void>();
  /** Status voice per peer id (tidak termasuk diri sendiri). */
  readonly voice = new Map<string, VoiceState>();
  /** Dipanggil saat status voice peer lain berubah. */
  onVoice: (() => void) | null = null;

  onLobby: ((seats: Seat[]) => void) | null = null;
  onStart: ((info: StartInfo) => void) | null = null;
  /** Pemain p (manusia) terputus di tengah game — host mengambil alih sebagai bot. */
  onPlayerLeft: ((p: number) => void) | null = null;
  /**
   * Pemain p tersambung kembali. Host mengembalikan indeks keputusan pertama yang
   * kembali dibuat pemain itu (lihat `RemoteDecider.release`); di tamu nilai return diabaikan.
   */
  onPlayerBack: ((p: number) => number) | null = null;
  onClosed: ((reason: string) => void) | null = null;

  private constructor(
    private peer: Peer,
    readonly code: string,
    readonly isHost: boolean,
  ) {
    peer.on("disconnected", () => {
      // Putus dari server signaling; koneksi P2P yang sudah ada tetap jalan.
      // Tetap sambung ulang selama game: panggilan suara baru butuh signaling.
      if (!this.closed && !peer.destroyed) peer.reconnect();
    });
  }

  get me(): string {
    return this.peer.id;
  }

  /** Peer id host (pemilik bot). */
  get hostId(): string {
    return PREFIX + this.code;
  }

  // ------------------------------------------------------------------ buat / gabung

  static async host(name: string, char: number): Promise<Room> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = genCode();
      try {
        const peer = await openPeer(PREFIX + code);
        const room = new Room(peer, code, true);
        room.seats = [{ id: peer.id, name: cleanName(name), char, kind: "host" }];
        peer.on("connection", (c) => room.acceptGuest(c));
        return room;
      } catch (e) {
        // Kode kebetulan sudah dipakai: coba kode lain
        if ((e as { type?: string }).type === "unavailable-id") continue;
        throw e;
      }
    }
    throw new Error("Gagal membuat room. Coba lagi.");
  }

  static async join(code: string, name: string): Promise<Room> {
    const peer = await openPeer();
    const room = new Room(peer, code, false);
    const token = saveSession(code, cleanName(name));
    await new Promise<void>((resolve, reject) => {
      const fail = (msg: string) => {
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(msg));
      };
      const timer = setTimeout(() => fail("Tidak bisa tersambung ke host. Mungkin jaringan memblokir koneksi P2P."), 15000);
      const onError = (e: Error) => {
        const t = (e as { type?: string }).type;
        fail(t === "peer-unavailable" ? `Room ${code} tidak ditemukan. Cek kodenya ya!` : String(e.message ?? e));
      };
      peer.once("error", onError);
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: "json" });
      room.hostConn = conn;
      let heartbeat: ((m: Msg) => boolean) | null = null;
      conn.once("open", () => {
        conn.send({ t: "hello", v: PROTOCOL, name: cleanName(name), token } satisfies Msg);
        heartbeat = watchConn(conn, () => {
          conn.close();
          room.close("Koneksi ke host terputus 📡");
        });
      });
      // Tunggu daftar lobi pertama sebagai tanda diterima (atau ditolak)
      conn.on("data", (raw) => {
        const m = raw as Msg;
        if (heartbeat?.(m)) return;
        if (m.t === "reject") {
          if (!room.seats.length) clearSession();
          fail(m.reason);
          return;
        }
        if ((m.t === "lobby" || m.t === "resume") && !room.seats.length) {
          clearTimeout(timer);
          peer.off("error", onError);
          room.seats = m.seats;
          resolve();
        }
        room.handleFromHost(m);
      });
      conn.on("close", () => {
        fail("Koneksi ke host terputus.");
        room.close("Koneksi ke host terputus 😢");
      });
    });
    return room;
  }

  // ------------------------------------------------------------------ sisi host

  private acceptGuest(conn: DataConnection) {
    let heartbeat: ((m: Msg) => boolean) | null = null;
    const gone = () => {
      this.guestGone(conn.peer);
      conn.close();
    };
    conn.on("open", () => (heartbeat = watchConn(conn, gone)));
    conn.on("data", (raw) => {
      const m = raw as Msg;
      if (heartbeat?.(m)) return;
      if (m.t === "hello") {
        const reject = (reason: string) => {
          conn.send({ t: "reject", reason } satisfies Msg);
          setTimeout(() => conn.close(), 300);
        };
        if (m.v !== PROTOCOL) return reject("Versi game berbeda. Muat ulang halaman (Ctrl+F5).");
        const token = typeof m.token === "string" && m.token ? m.token.slice(0, 64) : undefined;
        if (this.started) {
          const idx = token ? this.seatTokens.indexOf(token) : -1;
          if (idx < 0) return reject("Permainan di room ini sudah dimulai.");
          return this.rejoin(conn, idx);
        }
        // Tamu yang memuat ulang halaman di lobi: buang kursi lamanya dulu
        if (token) for (const [id, t] of [...this.tokenOf]) if (t === token && id !== conn.peer) this.dropGuest(id);
        if (this.seats.length >= MAX_SEATS) return reject("Room sudah penuh (maks 4).");
        if (token) this.tokenOf.set(conn.peer, token);
        this.conns.set(conn.peer, conn);
        this.seats.push({ id: conn.peer, name: cleanName(m.name), char: this.freeChar(), kind: "guest" });
        this.broadcastLobby();
        // Kabari tamu baru siapa saja yang sedang di voice
        if (this.myVoice.on) conn.send({ t: "voice", id: this.me, ...this.myVoice } satisfies Msg);
        for (const [id, v] of this.voice) conn.send({ t: "voice", id, ...v } satisfies Msg);
        return;
      }
      if (!this.conns.has(conn.peer)) return;
      if (m.t === "voice") {
        if (m.id !== conn.peer) return;
        this.storeVoice(m);
        for (const [id, c] of this.conns) if (id !== conn.peer && c.open) c.send(m);
      } else if (m.t === "setMe" && !this.started) {
        const seat = this.seats.find((s) => s.id === conn.peer);
        if (seat) this.applySetMe(seat, m);
      } else if (m.t === "act" && this.started) {
        // Hanya pemilik kursi yang boleh memutuskan untuk kursi itu
        if (this.seats[m.p]?.id !== conn.peer) return;
        for (const [id, c] of this.conns) if (id !== conn.peer) c.send(m);
        this.emitAct(m.p, m.k, m.v);
      }
    });
    conn.on("close", () => this.guestGone(conn.peer));
    conn.on("error", () => this.guestGone(conn.peer));
  }

  /** Host: tamu kembali ke game yang sedang berjalan → kursinya dikembalikan & riwayat dikirim. */
  private rejoin(conn: DataConnection, idx: number) {
    const old = this.seats[idx];
    // Koneksi lama belum terdeteksi putus (mis. halaman dimuat ulang): anggap putus sekarang
    if (old.kind === "guest" && old.id !== conn.peer) this.dropGuest(old.id);
    const from = this.onPlayerBack?.(idx) ?? 0;
    this.seats[idx] = { ...this.seats[idx], kind: "guest", id: conn.peer };
    this.conns.set(conn.peer, conn);
    // Kirim riwayat lalu (secara sinkron) mulai teruskan aksi baru → urutannya terjaga
    conn.send({ t: "resume", seed: this.seed, seats: this.seats, log: this.log, p: idx, from } satisfies Msg);
    for (const [id, c] of this.conns) if (id !== conn.peer && c.open) c.send({ t: "back", p: idx, id: conn.peer } satisfies Msg);
    if (this.myVoice.on) conn.send({ t: "voice", id: this.me, ...this.myVoice } satisfies Msg);
    for (const [id, v] of this.voice) conn.send({ t: "voice", id, ...v } satisfies Msg);
    this.emitSeats();
  }

  /** Host: putuskan koneksi tamu lama secara paksa. */
  private dropGuest(id: string) {
    const c = this.conns.get(id);
    this.guestGone(id);
    c?.close();
  }

  private guestGone(id: string) {
    if (!this.conns.delete(id)) return;
    if (!this.started) this.tokenOf.delete(id);
    this.dropVoice(id);
    const idx = this.seats.findIndex((s) => s.id === id);
    if (idx < 0) return;
    if (!this.started) {
      this.seats.splice(idx, 1);
      this.broadcastLobby();
    } else {
      this.seats[idx] = { ...this.seats[idx], kind: "bot", id: `${this.me}#left${idx}` };
      this.broadcast({ t: "left", p: idx });
      this.onPlayerLeft?.(idx);
      this.emitSeats();
    }
  }

  private freeChar(): number {
    for (let c = 0; c < BOT_NAMES.length; c++) if (!this.seats.some((s) => s.char === c)) return c;
    return 0;
  }

  private applySetMe(seat: Seat, m: { name?: string; char?: number }) {
    if (m.name !== undefined) seat.name = cleanName(m.name);
    if (m.char !== undefined && Number.isInteger(m.char) && m.char >= 0 && m.char < BOT_NAMES.length && !this.seats.some((s) => s !== seat && s.char === m.char)) {
      if (seat.kind === "bot" && BOT_NAMES.includes(seat.name)) seat.name = BOT_NAMES[m.char];
      seat.char = m.char;
    }
    this.broadcastLobby();
  }

  private broadcast(m: Msg) {
    for (const c of this.conns.values()) if (c.open) c.send(m);
  }

  private broadcastLobby() {
    this.broadcast({ t: "lobby", seats: this.seats });
    this.onLobby?.(this.seats);
    this.emitSeats();
  }

  private emitSeats() {
    for (const fn of this.seatListeners) fn(this.seats);
  }

  /** Dengarkan perubahan daftar kursi (lobi, mulai, pemain keluar). Return: fungsi untuk berhenti. */
  watchSeats(fn: (seats: Seat[]) => void): () => void {
    this.seatListeners.add(fn);
    return () => this.seatListeners.delete(fn);
  }

  addBot() {
    if (!this.isHost || this.started || this.seats.length >= MAX_SEATS) return;
    const char = this.freeChar();
    this.seats.push({ id: `${this.me}#bot${Date.now()}`, name: BOT_NAMES[char], char, kind: "bot" });
    this.broadcastLobby();
  }

  /** Hapus bot atau keluarkan tamu. */
  removeSeat(i: number) {
    if (!this.isHost || this.started) return;
    const s = this.seats[i];
    if (!s || s.kind === "host") return;
    if (s.kind === "guest") {
      const c = this.conns.get(s.id);
      c?.send({ t: "reject", reason: "Kamu dikeluarkan dari room oleh host." } satisfies Msg);
      this.conns.delete(s.id);
      this.dropVoice(s.id);
      setTimeout(() => c?.close(), 300);
    }
    this.seats.splice(i, 1);
    this.broadcastLobby();
  }

  /** Ubah nama/karakter kursi sendiri (host juga bisa mengatur bot). */
  setSeat(i: number, patch: { name?: string; char?: number }) {
    const seat = this.seats[i];
    if (!seat) return;
    if (this.isHost) {
      if (seat.kind === "guest") return;
      this.applySetMe(seat, patch);
    } else if (seat.id === this.me) {
      this.hostConn?.send({ t: "setMe", ...patch } satisfies Msg);
    }
  }

  start() {
    if (!this.isHost || this.started || this.seats.length < 2) return;
    const seed = Math.floor(Math.random() * 1e9);
    this.started = true;
    this.seed = seed;
    this.seatTokens = this.seats.map((s) => this.tokenOf.get(s.id));
    this.broadcast({ t: "start", seed, seats: this.seats });
    this.onStart?.({ seed, seats: structuredClone(this.seats) });
  }

  // ------------------------------------------------------------------ sisi tamu

  private handleFromHost(m: Msg) {
    switch (m.t) {
      case "lobby":
        this.seats = m.seats;
        this.onLobby?.(m.seats);
        this.emitSeats();
        break;
      case "resume":
        this.started = true;
        this.seats = m.seats;
        this.resumeSeed = m.seed;
        this.resume = { p: m.p, from: m.from };
        for (const a of m.log) this.emitAct(a.p, a.k, a.v);
        this.emitSeats();
        break;
      case "back":
        if (this.seats[m.p]) this.seats[m.p] = { ...this.seats[m.p], kind: "guest", id: m.id };
        this.onPlayerBack?.(m.p);
        this.emitSeats();
        break;
      case "start":
        this.started = true;
        this.seats = m.seats;
        this.onStart?.({ seed: m.seed, seats: m.seats });
        this.emitSeats();
        break;
      case "voice":
        if (m.id !== this.me) this.storeVoice(m);
        break;
      case "act":
        this.emitAct(m.p, m.k, m.v);
        break;
      case "left":
        if (this.seats[m.p]) this.seats[m.p] = { ...this.seats[m.p], kind: "bot", id: `${this.hostId}#left${m.p}` };
        this.onPlayerLeft?.(m.p);
        this.emitSeats();
        break;
      case "reject":
        this.close(m.reason);
        break;
    }
  }

  // ------------------------------------------------------------------ voice

  private myVoice: VoiceState = { on: false, mute: false, deaf: false };

  private storeVoice(m: { id: string } & VoiceState) {
    const v: VoiceState = { on: !!m.on, mute: !!m.mute, deaf: !!m.deaf };
    if (v.on) this.voice.set(m.id, v);
    else this.voice.delete(m.id);
    this.onVoice?.();
  }

  /** Host: peer pergi → beri tahu semua bahwa ia keluar dari voice. */
  private dropVoice(id: string) {
    if (!this.voice.has(id)) return;
    this.voice.delete(id);
    this.broadcast({ t: "voice", id, on: false, mute: false, deaf: false });
    this.onVoice?.();
  }

  /** Umumkan status voice diri sendiri ke semua peer. */
  setMyVoice(v: VoiceState) {
    this.myVoice = { ...v };
    const m: Msg = { t: "voice", id: this.me, ...v };
    if (this.isHost) this.broadcast(m);
    else if (this.hostConn?.open) this.hostConn.send(m);
  }

  /** Panggil peer lain dengan stream audio (voice chat mesh antar semua peer). */
  call(id: string, stream: MediaStream): MediaConnection | null {
    if (this.closed || this.peer.destroyed) return null;
    return this.peer.call(id, stream);
  }

  /** Terima panggilan suara masuk. */
  set onCall(fn: ((c: MediaConnection) => void) | null) {
    this.peer.removeAllListeners("call");
    if (fn) this.peer.on("call", fn);
  }

  get isClosed(): boolean {
    return this.closed;
  }

  // ------------------------------------------------------------------ dalam game

  set onAct(fn: ((p: number, k: string, v: unknown) => void) | null) {
    this._onAct = fn;
    if (fn) for (const a of this.actBuffer.splice(0)) fn(a.p, a.k, a.v);
  }

  private emitAct(p: number, k: string, v: unknown) {
    if (this.isHost) this.log.push({ p, k, v });
    if (this._onAct) this._onAct(p, k, v);
    else this.actBuffer.push({ p, k, v });
  }

  /** Kirim keputusan untuk pemain p (milik peer ini) ke semua peer lain. */
  sendAct(p: number, k: string, v: unknown) {
    const m: Msg = { t: "act", p, k, v };
    if (this.isHost) {
      this.log.push({ p, k, v });
      this.broadcast(m);
    }
    else this.hostConn?.send(m);
  }

  private close(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.peer.destroy();
    this.onClosed?.(reason);
  }

  leave() {
    if (this.closed) return;
    this.closed = true;
    this.onClosed = null;
    this.peer.destroy();
  }
}

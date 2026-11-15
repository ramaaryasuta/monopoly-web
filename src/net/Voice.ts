import type { MediaConnection } from "peerjs";
import type { Room, Seat, VoiceState } from "./Room";
import { onSoundChange, Sound } from "../scene/sfx";

/**
 * Voice chat ala Discord untuk room online.
 *
 * Topologi mesh: setiap peer yang "gabung suara" tersambung langsung (WebRTC audio)
 * ke setiap peer lain yang juga gabung — maks 4 orang, jadi maks 3 panggilan per peer.
 * Status (gabung / mute / deafen) disiarkan lewat data channel room (via host).
 *
 * Yang dikirim selalu stream dari AudioContext (mikrofon → gain → tujuan), sehingga:
 *  - mute = gain 0, tanpa negosiasi ulang;
 *  - tanpa mikrofon (ditolak / http non-localhost) tetap bisa ikut mendengar.
 *
 * "Mute orang lain" bersifat lokal seperti Discord: hanya kamu yang tidak mendengar dia.
 */

export interface VoiceMember {
  id: string;
  seat: Seat;
  isMe: boolean;
  /** Ikut voice? (untuk diri sendiri: `joined`) */
  state: VoiceState | null;
  /** Tersambung audio langsung dengan kita. */
  connected: boolean;
  speaking: boolean;
  /** Kita bisukan secara lokal. */
  localMuted: boolean;
  /** 0..1 */
  volume: number;
}

const CALL_TIMEOUT_MS = 12000;
const SPEAK_THRESHOLD = 0.035;
const STORE_KEY = "pulauKaya.voice";

interface Remote {
  call: MediaConnection;
  startedAt: number;
  audio: HTMLAudioElement | null;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
}

function loadPrefs(): { mute: boolean; deaf: boolean } {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as { mute?: boolean; deaf?: boolean };
    return { mute: !!d.mute, deaf: !!d.deaf };
  } catch {
    return { mute: false, deaf: false };
  }
}

export class Voice {
  joined = false;
  mute: boolean;
  deaf: boolean;
  /** Mikrofon berhasil dipakai. */
  micOk = false;
  /** Alasan mikrofon tidak tersedia (untuk ditampilkan). */
  micError = "";
  joining = false;

  /** Dipanggil setiap ada perubahan yang perlu digambar ulang. */
  onChange: (() => void) | null = null;

  private ctx: AudioContext | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private micGain: GainNode | null = null;
  private mic: MediaStream | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remotes = new Map<string, Remote>();
  private localMuted = new Set<string>();
  private volumes = new Map<string, number>();
  private speaking = new Set<string>();
  /** Mute sebelum deafen, dipulihkan saat undeafen. */
  private muteBeforeDeaf = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private healTimer: ReturnType<typeof setInterval> | null = null;
  private unwatchSeats: () => void;
  private unwatchSound = onSoundChange(() => this.applyAudio());
  private buf = new Uint8Array(512);

  constructor(private room: Room) {
    const p = loadPrefs();
    this.mute = p.mute;
    this.deaf = p.deaf;
    this.muteBeforeDeaf = p.mute;
    room.onVoice = () => this.sync();
    room.onCall = (c) => this.incoming(c);
    this.unwatchSeats = room.watchSeats(() => this.sync());
  }

  // ------------------------------------------------------------------ kontrol

  async join() {
    if (this.joined || this.joining) return;
    this.joining = true;
    this.changed();
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.dest = ctx.createMediaStreamDestination();
      this.micGain = ctx.createGain();
      this.micGain.connect(this.dest);
      this.localAnalyser = ctx.createAnalyser();
      this.localAnalyser.fftSize = 512;
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(window.isSecureContext ? "Browser tidak mendukung mikrofon." : "Mikrofon butuh HTTPS (atau localhost).");
        }
        this.mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        const src = ctx.createMediaStreamSource(this.mic);
        src.connect(this.micGain);
        src.connect(this.localAnalyser);
        this.micOk = true;
        this.micError = "";
      } catch (e) {
        this.micOk = false;
        const name = (e as { name?: string }).name;
        this.micError =
          name === "NotAllowedError"
            ? "Izin mikrofon ditolak — kamu hanya bisa mendengar."
            : name === "NotFoundError"
              ? "Mikrofon tidak ditemukan — kamu hanya bisa mendengar."
              : `${(e as Error).message ?? e} Kamu hanya bisa mendengar.`;
      }
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      this.joined = true;
      this.applyAudio();
      this.publish();
      this.timer = setInterval(() => this.meter(), 120);
      this.healTimer = setInterval(() => this.sync(), 4000);
      this.sync();
    } finally {
      this.joining = false;
      this.changed();
    }
  }

  leave() {
    if (!this.joined) return;
    this.joined = false;
    for (const id of [...this.remotes.keys()]) this.dropRemote(id);
    if (this.timer) clearInterval(this.timer);
    if (this.healTimer) clearInterval(this.healTimer);
    this.timer = this.healTimer = null;
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = this.dest = this.micGain = this.localAnalyser = null;
    this.micOk = false;
    this.speaking.clear();
    this.publish();
    this.changed();
  }

  toggleMute() {
    if (this.deaf) {
      // Seperti Discord: unmute saat deafen = undeafen sekaligus
      this.deaf = false;
      this.mute = false;
    } else {
      this.mute = !this.mute;
    }
    this.muteBeforeDeaf = this.mute;
    this.applyAndPublish();
  }

  toggleDeaf() {
    if (this.deaf) {
      this.deaf = false;
      this.mute = this.muteBeforeDeaf;
    } else {
      this.muteBeforeDeaf = this.mute;
      this.deaf = true;
      this.mute = true;
    }
    this.applyAndPublish();
  }

  /** Bisukan / bunyikan pemain lain (hanya untuk kita). */
  toggleLocalMute(id: string) {
    if (this.localMuted.has(id)) this.localMuted.delete(id);
    else this.localMuted.add(id);
    this.applyAudio();
    this.changed();
  }

  setVolume(id: string, v: number) {
    this.volumes.set(id, Math.max(0, Math.min(1, v)));
    if (v > 0 && this.localMuted.has(id)) this.localMuted.delete(id);
    this.applyAudio();
    this.changed();
  }

  /** Mic benar-benar mengirim suara. */
  get transmitting(): boolean {
    return this.joined && this.micOk && !this.mute && !this.deaf;
  }

  /** Daftar pemain manusia di room (diri sendiri duluan). */
  members(): VoiceMember[] {
    const me = this.room.me;
    const list: VoiceMember[] = [];
    const seen = new Set<string>();
    for (const seat of this.room.seats) {
      if (seat.kind === "bot" || seen.has(seat.id)) continue;
      seen.add(seat.id);
      const isMe = seat.id === me;
      list.push({
        id: seat.id,
        seat,
        isMe,
        state: isMe ? (this.joined ? { on: true, mute: this.mute || !this.micOk, deaf: this.deaf } : null) : (this.room.voice.get(seat.id) ?? null),
        connected: isMe ? this.joined : !!this.remotes.get(seat.id)?.audio,
        speaking: this.speaking.has(seat.id),
        localMuted: this.localMuted.has(seat.id),
        volume: this.volumes.get(seat.id) ?? 1,
      });
    }
    return list.sort((a, b) => Number(b.isMe) - Number(a.isMe));
  }

  /** Peer id yang sedang berbicara (untuk efek di kartu pemain). */
  isSpeaking(id: string): boolean {
    return this.speaking.has(id);
  }

  destroy() {
    this.leave();
    this.room.onVoice = null;
    this.unwatchSeats();
    this.unwatchSound();
    if (!this.room.isClosed) this.room.onCall = null;
    this.onChange = null;
  }

  // ------------------------------------------------------------------ internal

  private changed() {
    this.onChange?.();
  }

  private savePrefs() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ mute: this.mute, deaf: this.deaf }));
    } catch {
      /* abaikan */
    }
  }

  private applyAndPublish() {
    this.savePrefs();
    this.applyAudio();
    this.publish();
    this.changed();
  }

  private publish() {
    this.room.setMyVoice({ on: this.joined, mute: this.mute || !this.micOk, deaf: this.deaf });
  }

  private applyAudio() {
    if (this.micGain) this.micGain.gain.value = this.transmitting ? 1 : 0;
    for (const [id, r] of this.remotes) {
      if (!r.audio) continue;
      r.audio.muted = this.deaf || this.localMuted.has(id);
      r.audio.volume = (this.volumes.get(id) ?? 1) * Sound.voiceVol;
    }
  }

  /** Peer lain yang sedang gabung voice dan masih di room. */
  private wanted(): Set<string> {
    const ids = new Set<string>();
    if (!this.joined) return ids;
    for (const s of this.room.seats) {
      if (s.kind !== "bot" && s.id !== this.room.me && this.room.voice.get(s.id)?.on) ids.add(s.id);
    }
    return ids;
  }

  /** Samakan panggilan aktif dengan siapa saja yang gabung voice. */
  private sync() {
    const want = this.wanted();
    const now = Date.now();
    for (const [id, r] of this.remotes) {
      const stale = !r.audio && now - r.startedAt > CALL_TIMEOUT_MS;
      if (!want.has(id) || stale) this.dropRemote(id);
    }
    if (this.joined && this.dest) {
      for (const id of want) {
        // Hanya satu sisi yang menelepon agar tidak dobel: id lebih kecil memanggil
        if (this.remotes.has(id) || !(this.room.me < id)) continue;
        const call = this.room.call(id, this.dest.stream);
        if (call) this.attach(id, call);
      }
    }
    this.changed();
  }

  private incoming(call: MediaConnection) {
    if (!this.joined || !this.dest) {
      call.close();
      return;
    }
    const id = call.peer;
    if (!this.room.seats.some((s) => s.id === id && s.kind !== "bot")) {
      call.close();
      return;
    }
    // Panggilan baru menggantikan yang lama (mis. lawan bicara memuat ulang koneksi)
    if (this.remotes.has(id)) this.dropRemote(id);
    call.answer(this.dest.stream);
    this.attach(id, call);
    this.changed();
  }

  private attach(id: string, call: MediaConnection) {
    const r: Remote = { call, startedAt: Date.now(), audio: null, analyser: null, source: null };
    this.remotes.set(id, r);
    call.on("stream", (stream) => {
      if (this.remotes.get(id) !== r || !this.ctx) return;
      if (r.audio) return; // event 'stream' bisa terpanggil dua kali
      const audio = new Audio();
      audio.autoplay = true;
      audio.srcObject = stream;
      audio.dataset.voicePeer = id;
      audio.style.display = "none";
      document.body.append(audio);
      void audio.play().catch(() => {});
      r.audio = audio;
      try {
        r.source = this.ctx.createMediaStreamSource(stream);
        r.analyser = this.ctx.createAnalyser();
        r.analyser.fftSize = 512;
        r.source.connect(r.analyser);
      } catch {
        /* indikator bicara tidak tersedia */
      }
      this.applyAudio();
      this.changed();
    });
    const gone = () => {
      if (this.remotes.get(id) === r) {
        this.dropRemote(id);
        this.changed();
      }
    };
    call.on("close", gone);
    call.on("error", gone);
    call.peerConnection?.addEventListener("iceconnectionstatechange", () => {
      const s = call.peerConnection?.iceConnectionState;
      if (s === "failed" || s === "closed") gone();
    });
  }

  private dropRemote(id: string) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.remotes.delete(id);
    this.speaking.delete(id);
    try {
      r.call.close();
    } catch {
      /* sudah tertutup */
    }
    r.source?.disconnect();
    if (r.audio) {
      r.audio.srcObject = null;
      r.audio.remove();
    }
  }

  private level(an: AnalyserNode | null): number {
    if (!an) return 0;
    const buf = this.buf.length === an.fftSize ? this.buf : (this.buf = new Uint8Array(an.fftSize));
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (const b of buf) {
      const v = (b - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  /** Deteksi siapa yang sedang berbicara (lingkaran hijau seperti Discord). */
  private meter() {
    const next = new Set<string>();
    if (this.transmitting && this.level(this.localAnalyser) > SPEAK_THRESHOLD) next.add(this.room.me);
    for (const [id, r] of this.remotes) {
      const st = this.room.voice.get(id);
      if (st?.mute || this.localMuted.has(id)) continue;
      if (this.level(r.analyser) > SPEAK_THRESHOLD) next.add(id);
    }
    const same = next.size === this.speaking.size && [...next].every((id) => this.speaking.has(id));
    if (!same) {
      this.speaking = next;
      this.changed();
    }
  }
}

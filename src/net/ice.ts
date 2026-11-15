/**
 * Daftar server ICE (STUN/TURN) untuk WebRTC.
 *
 * Bawaan PeerJS memakai TURN publik peerjs.com yang sering mati — pemain di balik NAT ketat
 * (jaringan seluler/CGNAT, Wi-Fi kantor/kampus) lalu gagal tersambung ("ICE failed").
 * Di sini kita ambil kredensial TURN sementara dari /api/turn (Vercel Function → Cloudflare TURN),
 * dan jatuh ke STUN saja bila endpoint itu tidak tersedia (mis. saat `npm run dev`).
 */

const FALLBACK: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];

/** Kredensial diminta 24 jam; dipakai ulang maksimal 1 jam agar tetap jauh dari kedaluwarsa. */
const CACHE_MS = 60 * 60 * 1000;
let cache: { at: number; servers: RTCIceServer[] } | null = null;

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.servers;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch("/api/turn", { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as { iceServers?: RTCIceServer[] };
    const servers = Array.isArray(data.iceServers) && data.iceServers.length ? data.iceServers : null;
    if (!servers) throw new Error("kosong");
    cache = { at: Date.now(), servers };
    return servers;
  } catch (e) {
    console.warn("[ice] TURN tidak tersedia, pakai STUN saja:", e);
    return FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}

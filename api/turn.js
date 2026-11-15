// Vercel Function: GET /api/turn → { iceServers: RTCIceServer[] }
//
// Dua cara mengisi TURN (set di Vercel → Project → Settings → Environment Variables):
//
// A) Kredensial statis — penyedia gratis tanpa kartu (mis. ExpressTURN, Metered):
//      TURN_URLS        — satu atau lebih URL dipisah koma,
//                         mis. "turn:relay1.expressturn.com:3478,turns:relay1.expressturn.com:443"
//      TURN_USERNAME    — username dari dashboard penyedia
//      TURN_CREDENTIAL  — password/credential dari dashboard penyedia
//
// B) Cloudflare Realtime TURN (kredensial sementara dibuat per permintaan):
//      CF_TURN_KEY_ID, CF_TURN_API_TOKEN
//
// Bila keduanya di-set, Cloudflare dipakai dulu; kalau gagal, jatuh ke kredensial statis.

const TTL = 24 * 60 * 60;
const STUN = { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] };

function staticServers() {
  const urls = (process.env.TURN_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    // "free.expressturn.com:3478" → "turn:free.expressturn.com:3478" (browser menolak URL tanpa skema)
    .map((s) => (/^(stun|stuns|turn|turns):/i.test(s) ? s : `turn:${s}`));
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  if (!urls.length || !username || !credential) return null;
  return [STUN, { urls, username, credential }];
}

async function cloudflareServers() {
  const keyId = process.env.CF_TURN_KEY_ID;
  const token = process.env.CF_TURN_API_TOKEN;
  if (!keyId || !token) return null;
  try {
    const r = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL }),
      },
    );
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data.iceServers) && data.iceServers.length ? data.iceServers : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const iceServers = (await cloudflareServers()) ?? staticServers();
  if (!iceServers) {
    return Response.json({ error: "TURN belum dikonfigurasi" }, { status: 503 });
  }
  return Response.json(
    { iceServers },
    // Cache sebentar di CDN supaya tidak memanggil penyedia tiap pemain buka halaman
    { headers: { "Cache-Control": "public, s-maxage=3600, max-age=0" } },
  );
}

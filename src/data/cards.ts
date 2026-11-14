export type CardEffect =
  | { type: "gain"; amount: number }
  | { type: "pay"; amount: number }
  | { type: "repair"; perLevel: number }
  | { type: "shield" }
  | { type: "goto"; tile: number }
  | { type: "island" }
  | { type: "collectFromAll"; amount: number }
  | { type: "payAll"; amount: number }
  | { type: "back"; steps: number }
  | { type: "forward"; steps: number }
  /** Tukar posisi dengan pemain lain acak (tanpa efek petak). */
  | { type: "swap" }
  /** Curi dari pemain terkaya lainnya. */
  | { type: "stealRichest"; amount: number }
  /** Uang acak antara min..max (kelipatan 10). */
  | { type: "gacha"; min: number; max: number }
  /** Semua pemain lain terdorong mundur N petak (tanpa efek petak). */
  | { type: "pushOthers"; steps: number }
  /** Diculik ke petak acak, lalu efek petak berlaku. */
  | { type: "randomTile" }
  /** Dapat kartu simpanan (masuk kantong, dipakai nanti). */
  | { type: "item"; item: ItemId };

/** Efek visual tambahan saat kartu/event muncul. */
export type FunFx = "fart" | "ufo" | "dance" | "cry" | "rain" | "shake" | "duck" | "dizzy";

export interface Card {
  id: string;
  title: string;
  text: string;
  icon: string;
  effect: CardEffect;
  fx?: FunFx;
}

export const CARDS: Card[] = [
  { id: "coinRain", title: "Hujan Duit!", text: "Ada pesawat bocor lewat. Duit berjatuhan. Terima 150.", icon: "💸", effect: { type: "gain", amount: 150 }, fx: "rain" },
  { id: "harvest", title: "Nemu di Celana", text: "Nyuci celana jeans, nemu duit lecek. Terima 100.", icon: "👖", effect: { type: "gain", amount: 100 }, fx: "dance" },
  { id: "leakyWallet", title: "Dompet Dimakan Kambing", text: "Kambing tetangga lapar. Bayar 100.", icon: "🐐", effect: { type: "pay", amount: 100 }, fx: "cry" },
  { id: "repair", title: "Atap Bocor Semua", text: "Musim hujan! Bayar 20 untuk setiap level bangunanmu.", icon: "🪣", effect: { type: "repair", perLevel: 20 }, fx: "cry" },
  { id: "shield", title: "Jimat Kolor Sakti", text: "Kolor warisan kakek. Bebas bayar sewa satu kali.", icon: "🩲", effect: { type: "shield" }, fx: "dance" },
  { id: "toStart", title: "Ketapel Raksasa", text: "Kamu ditembakkan pakai ketapel ke petak Mulai!", icon: "🪃", effect: { type: "goto", tile: 0 }, fx: "dizzy" },
  { id: "toIsland", title: "Ditolak Gebetan", text: "Patah hati, kamu kabur ke Pulau Jomblo.", icon: "💔", effect: { type: "island" }, fx: "cry" },
  { id: "birthday", title: "Ultah Dadakan", text: "Ngaku ulang tahun (padahal bukan). Setiap pemain memberimu 50.", icon: "🎂", effect: { type: "collectFromAll", amount: 50 }, fx: "dance" },
  { id: "back3", title: "Kunci Motor Ketinggalan", text: "Balik lagi! Mundur 3 petak.", icon: "🔑", effect: { type: "back", steps: 3 }, fx: "dizzy" },
  { id: "toFestival", title: "Diundang Manggung", text: "Suaramu fals tapi pede. Pergi ke Pesta Dangdut!", icon: "🎤", effect: { type: "goto", tile: 16 }, fx: "dance" },
  { id: "fart", title: "Kentut Nuklir", text: "BRRRT! Semua pemain lain terpental mundur 2 petak.", icon: "💨", effect: { type: "pushOthers", steps: 2 }, fx: "fart" },
  { id: "ufo", title: "Diculik Alien", text: "Alien penasaran sama kumismu. Kamu dilepas di petak acak.", icon: "🛸", effect: { type: "randomTile" }, fx: "ufo" },
  { id: "swap", title: "Tukar Jiwa", text: "Kesamber petir bareng pemain lain. Kalian tukar posisi!", icon: "⚡", effect: { type: "swap" }, fx: "shake" },
  { id: "treat", title: "Kalah Taruhan Bola", text: "Timmu kalah 7-0. Traktir semua pemain, masing-masing 50.", icon: "⚽", effect: { type: "payAll", amount: 50 }, fx: "cry" },
  { id: "steal", title: "Pinjam Dulu Seratus", text: "Kamu pinjam ke pemain terkaya. Nggak bakal dibalikin. Ambil 120.", icon: "🤝", effect: { type: "stealRichest", amount: 120 }, fx: "dance" },
  { id: "claw", title: "Mesin Capit Warung", text: "Coba peruntungan! Bisa untung, bisa boncos.", icon: "🕹️", effect: { type: "gacha", min: -150, max: 250 }, fx: "shake" },
  { id: "duck", title: "Bebek Karet Ajaib", text: "Bebek karet raksasa mendorongmu maju 4 petak. Kwek!", icon: "🦆", effect: { type: "forward", steps: 4 }, fx: "duck" },
  { id: "sandal", title: "Sendal Ketuker di Kondangan", text: "Sendal swallow-mu jadi sendal kulit mahal. Jual! Terima 80.", icon: "🩴", effect: { type: "gain", amount: 80 }, fx: "dance" },
  { id: "gorengan", title: "Ngutang Gorengan", text: "Ketahuan ambil 5 bayar 1. Bayar 60.", icon: "🍤", effect: { type: "pay", amount: 60 }, fx: "cry" },
  { id: "mancing", title: "Mancing Dapat Ban", text: "Ban bekasnya dijual ke bengkel. Terima 70.", icon: "🎣", effect: { type: "gain", amount: 70 }, fx: "dance" },
  { id: "cukur", title: "Salah Potong Rambut", text: "Kepala botak sebelah. Beli topi, bayar 50.", icon: "💈", effect: { type: "pay", amount: 50 }, fx: "dizzy" },
  { id: "itemSandal", title: "Nemu Sendal Terbang", text: "Sendal jepit bersayap! Simpan di kantong, lempar ke lawan kapan saja.", icon: "🩴", effect: { type: "item", item: "sandal" }, fx: "dance" },
  { id: "itemUtang", title: "Nemu Surat Utang", text: "Surat utang palsu tapi meyakinkan. Simpan, tagih ke lawan nanti!", icon: "📜", effect: { type: "item", item: "utang" }, fx: "dance" },
  { id: "itemTurbo", title: "Sepatu Roda Turbo", text: "Simpan buat giliran penting: langkahmu +3.", icon: "🛼", effect: { type: "item", item: "turbo" }, fx: "duck" },
  { id: "itemKecoak", title: "Toples Kecoak", text: "Isinya kecoak terbang. Lepas di bangunan lawan biar penghuninya kabur!", icon: "🪳", effect: { type: "item", item: "kecoak" }, fx: "shake" },
  { id: "orangDalam", title: "Kartu Orang Dalam", text: "Punya kenalan orang dalam. Bebas bayar sewa satu kali.", icon: "🕴️", effect: { type: "shield" }, fx: "dance" },
  { id: "tilang", title: "Kartu Kena Tilang", text: "Lupa bawa SIM, helm cuma ditenteng. Bayar denda 75.", icon: "👮", effect: { type: "pay", amount: 75 }, fx: "cry" },
  { id: "pajak", title: "Kartu Bayar PAJAK", text: "Orang bijak taat pajak! Bayar 25 untuk setiap level bangunanmu.", icon: "🧾", effect: { type: "repair", perLevel: 25 }, fx: "cry" },
  { id: "korupsi", title: "Kartu Korupsi", text: "Main proyek fiktif. Kalau lolos untung besar, kalau ketahuan KPK boncos!", icon: "💼", effect: { type: "gacha", min: -200, max: 300 }, fx: "shake" },
  { id: "pinjol", title: "Kartu Pinjol", text: "Klik 'cairkan' tanpa baca syarat. Bunganya beranak pinak! Bayar 150.", icon: "📱", effect: { type: "pay", amount: 150 }, fx: "cry" },
  { id: "viral", title: "Kartu Viral", text: "Kontenmu FYP! Setiap pemain kirim saweran 40.", icon: "🤳", effect: { type: "collectFromAll", amount: 40 }, fx: "dance" },
  { id: "gusur", title: "Kartu Kena Gusur", text: "Lahanmu kena proyek strategis. Angkat koper, mundur 4 petak.", icon: "🚜", effect: { type: "back", steps: 4 }, fx: "shake" },
  { id: "wapres", title: "Kartu Wapres Resign", text: "Kursi kosong mendadak! Kamu langsung meluncur ke Istana Presiden.", icon: "🪑", effect: { type: "goto", tile: 31 }, fx: "dizzy" },
  { id: "ronda", title: "Ketiduran Pas Ronda", text: "Ditinggal teman. Kamu terbangun dan lari ke Pos Ronda.", icon: "😴", effect: { type: "goto", tile: 9 }, fx: "dizzy" },
];

/** Event konyol sedunia: kadang muncul di awal ronde. */
export type ChaosEffect =
  | { type: "allGain"; amount: number }
  | { type: "allPay"; amount: number }
  /** Satu pemain acak kena/untung. */
  | { type: "randomGain"; amount: number }
  | { type: "randomPay"; amount: number }
  /** Pemain termiskin dapat bantuan. */
  | { type: "poorestGain"; amount: number }
  /** Pemain terkaya kena "pajak" dibagi rata ke yang lain. */
  | { type: "robinHood"; amount: number }
  /** Pemain acak dipindah ke petak acak (tanpa efek petak). */
  | { type: "ufoAbduct" }
  /** Tidak ada efek uang, cuma heboh. */
  | { type: "nothing" };

export interface ChaosEvent {
  id: string;
  headline: string;
  text: string;
  icon: string;
  effect: ChaosEffect;
  fx: FunFx;
}

export const CHAOS_EVENTS: ChaosEvent[] = [
  { id: "bansos", headline: "Bansos Kumis Turun!", text: "Pak RT bagi-bagi amplop. Semua pemain +60.", icon: "🧧", effect: { type: "allGain", amount: 60 }, fx: "rain" },
  { id: "iuran", headline: "Iuran Agustusan", text: "Buat lomba panjat pinang. Semua pemain bayar 40.", icon: "🇮🇩", effect: { type: "allPay", amount: 40 }, fx: "shake" },
  { id: "seagull", headline: "Serangan Burung Camar", text: "Seekor camar mencuri dompet satu pemain! -80.", icon: "🐦", effect: { type: "randomPay", amount: 80 }, fx: "cry" },
  { id: "lottery", headline: "Nemu Koper Misterius", text: "Isinya duit mainan... eh ternyata asli! Satu pemain +150.", icon: "🧳", effect: { type: "randomGain", amount: 150 }, fx: "dance" },
  { id: "pity", headline: "Donasi Kasihan", text: "Warga iba. Pemain paling miskin dapat 120.", icon: "🥺", effect: { type: "poorestGain", amount: 120 }, fx: "cry" },
  { id: "robin", headline: "Maling Budiman Beraksi", text: "Pemain terkaya kehilangan 150, dibagi ke yang lain.", icon: "🦹", effect: { type: "robinHood", amount: 150 }, fx: "shake" },
  { id: "ufo", headline: "UFO Nyasar!", text: "Alien salah culik orang. Satu pemain dipindah ke petak acak.", icon: "👽", effect: { type: "ufoAbduct" }, fx: "ufo" },
  { id: "blackout", headline: "Mati Lampu Se-Pulau", text: "Semua panik lalu joget di kegelapan. Tidak terjadi apa-apa.", icon: "🔦", effect: { type: "nothing" }, fx: "dance" },
  { id: "fartquake", headline: "Gempa Kentut 6,9 SR", text: "Tanah bergetar dan bau. Semua pemain bayar 30 buat beli pengharum.", icon: "💨", effect: { type: "allPay", amount: 30 }, fx: "fart" },
  { id: "giantduck", headline: "Bebek Raksasa Mendarat", text: "Turis datang foto-foto. Satu pemain jualan es dan dapat 100.", icon: "🦆", effect: { type: "randomGain", amount: 100 }, fx: "duck" },
];

/** Peluang event konyol muncul di awal setiap ronde baru. */
export const CHAOS_CHANCE = 0.45;

// ------------------------------------------------------------------ kartu simpanan

export type ItemId = "sandal" | "utang" | "turbo" | "kecoak";

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  /** Penjelasan singkat efek saat dipakai. */
  text: string;
  /** Butuh memilih pemain sasaran / petak sasaran. */
  target: "player" | "tile" | null;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  sandal: { id: "sandal", name: "Sendal Terbang", icon: "🩴", text: "Lempar ke satu lawan: dia mundur 3 petak.", target: "player" },
  utang: { id: "utang", name: "Surat Utang Palsu", icon: "📜", text: "Tagih satu lawan: ambil 100 darinya.", target: "player" },
  turbo: { id: "turbo", name: "Sepatu Roda Turbo", icon: "🛼", text: "Lemparan dadu giliran ini +3 langkah.", target: null },
  kecoak: { id: "kecoak", name: "Toples Kecoak", icon: "🪳", text: "Turunkan 1 level bangunan lawan (tanah tidak bisa).", target: "tile" },
};

/** Maksimal kartu simpanan per pemain. Kalau penuh, kartu baru dijual 50. */
export const MAX_ITEMS = 3;
export const SANDAL_STEPS = 3;
export const UTANG_AMOUNT = 100;
export const TURBO_STEPS = 3;

// ------------------------------------------------------------------ event musiman

export type SeasonId = "turis" | "banjir" | "diskon" | "thr";

export interface SeasonDef {
  id: SeasonId;
  headline: string;
  text: string;
  /** Teks pendek untuk lencana ronde. */
  badge: string;
  icon: string;
  fx: FunFx;
}

export const SEASONS: Record<SeasonId, SeasonDef> = {
  turis: { id: "turis", headline: "Musim Turis Bule!", text: "Turis datang rombongan. Semua sewa x2 selama 2 ronde.", badge: "Sewa x2", icon: "📸", fx: "dance" },
  banjir: { id: "banjir", headline: "Banjir Kiriman!", text: "Tukang bangunan pada ngungsi. Tidak bisa beli/bangun selama 2 ronde.", badge: "Tidak bisa bangun", icon: "🌊", fx: "rain" },
  diskon: { id: "diskon", headline: "Harbolnas Semen!", text: "Toko bangunan cuci gudang. Biaya beli/bangun diskon 50% selama 2 ronde.", badge: "Bangun -50%", icon: "🛍️", fx: "dance" },
  thr: { id: "thr", headline: "Musim THR!", text: "Bos lagi baik. Gaji lewat Mulai jadi x2 selama 2 ronde.", badge: "Gaji x2", icon: "💰", fx: "rain" },
};

export const SEASON_IDS = Object.keys(SEASONS) as SeasonId[];
/** Lama event musiman (ronde). */
export const SEASON_ROUNDS = 2;
/** Peluang event musiman mulai di awal ronde (bila sedang tidak ada). */
export const SEASON_CHANCE = 0.3;

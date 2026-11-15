import { FESTIVAL_INDEX, tileIndexByName } from "./board";
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
export type FunFx = "fart" | "heli" | "dance" | "party" | "cry" | "rain" | "shake" | "duck" | "dizzy";

export interface Card {
  id: string;
  title: string;
  text: string;
  icon: string;
  effect: CardEffect;
  fx?: FunFx;
}

export const CARDS: Card[] = [
  { id: "coinRain", title: "Mendapat Bansos", text: "Namamu masuk daftar penerima bantuan. Terima Rp135 jt.", icon: "💸", effect: { type: "gain", amount: 135 }, fx: "rain" },
  { id: "harvest", title: "Ada yang Salah Transfer", text: "Saldo tiba-tiba nambah, pengirimnya nggak bisa dihubungi. Terima Rp90 jt.", icon: "🏦", effect: { type: "gain", amount: 90 }, fx: "dance" },
  { id: "leakyWallet", title: "IHSG Anjlok", text: "Portofolio sahammu merah semua. Rugi Rp100 jt.", icon: "📉", effect: { type: "pay", amount: 100 }, fx: "cry" },
  { id: "repair", title: "Atap Bocor Semua", text: "Musim hujan! Bayar Rp20 jt untuk setiap rumah, vila, dan landmark-mu.", icon: "🪣", effect: { type: "repair", perLevel: 20 }, fx: "cry" },
  { id: "shield", title: "Kolor Mas Amba", text: "Penagih ketakutan melihat bekas Mas Amba. Bebas bayar sewa satu kali.", icon: "🩲", effect: { type: "shield" }, fx: "dance" },
  { id: "toStart", title: "Ketapel Raksasa", text: "Kamu ditembakkan pakai ketapel ke petak Mulai!", icon: "🪃", effect: { type: "goto", tile: 0 }, fx: "dizzy" },
  { id: "toIsland", title: "Digrebek Polisi", text: "Ketahuan main judi online. Langsung digiring ke Nusakambangan!", icon: "🚓", effect: { type: "island" }, fx: "cry" },
  { id: "birthday", title: "Ultah Dadakan", text: "Ngaku ulang tahun (padahal bukan). Setiap pemain memberimu Rp45 jt.", icon: "🎂", effect: { type: "collectFromAll", amount: 45 }, fx: "dance" },
  { id: "back3", title: "Kunci Motor Ketinggalan", text: "Balik lagi! Mundur 3 petak.", icon: "🔑", effect: { type: "back", steps: 3 }, fx: "dizzy" },
  { id: "toFestival", title: "Dapat Undangan VIP", text: "Namamu nyelip di daftar tamu. Berangkat ke Pesta Pejabat!", icon: "🥂", effect: { type: "goto", tile: FESTIVAL_INDEX }, fx: "party" },
  { id: "fart", title: "Kentut Nuklir", text: "BRRRT! Semua pemain lain terpental mundur 2 petak.", icon: "💨", effect: { type: "pushOthers", steps: 2 }, fx: "fart" },
  { id: "heli", title: "Nebeng Heli Pejabat", text: "Disangka ajudan, kamu ikut terbang lalu diturunkan di lokasi acak.", icon: "🚁", effect: { type: "randomTile" }, fx: "heli" },
  { id: "swap", title: "Tukar Jiwa", text: "Kesamber petir bareng pemain lain (kecuali yang di Nusakambangan). Kalian tukar posisi!", icon: "⚡", effect: { type: "swap" }, fx: "shake" },
  { id: "treat", title: "Kalah Taruhan Bola", text: "Timmu kalah 7-0. Traktir semua pemain, masing-masing Rp50 jt.", icon: "⚽", effect: { type: "payAll", amount: 50 }, fx: "cry" },
  { id: "steal", title: "Pinjam Dulu Seratus", text: "Kamu pinjam ke pemain terkaya. Nggak bakal dibalikin. Ambil Rp100 jt.", icon: "🤝", effect: { type: "stealRichest", amount: 100 }, fx: "dance" },
  { id: "claw", title: "Mesin Capit Warung", text: "Coba peruntungan! Bisa untung, bisa boncos.", icon: "🕹️", effect: { type: "gacha", min: -150, max: 230 }, fx: "shake" },
  { id: "duck", title: "Bebek Karet Ajaib", text: "Bebek karet raksasa mendorongmu maju 4 petak. Kwek!", icon: "🦆", effect: { type: "forward", steps: 4 }, fx: "duck" },
  { id: "sandal", title: "Mendapat Dividen", text: "Saham yang kamu lupa pernah beli ternyata bagi dividen. Terima Rp72 jt.", icon: "📈", effect: { type: "gain", amount: 72 }, fx: "dance" },
  { id: "gorengan", title: "Bayar Karyawan Lembur", text: "Proyek dikejar deadline, semua lembur. Bayar Rp60 jt.", icon: "⏰", effect: { type: "pay", amount: 60 }, fx: "cry" },
  { id: "mancing", title: "Teman Lama Bayar Hutang", text: "Utang sepuluh tahun lalu akhirnya dilunasi. Terima Rp63 jt.", icon: "💌", effect: { type: "gain", amount: 63 }, fx: "dance" },
  { id: "cukur", title: "Bayar Pajak PPh 21", text: "Potongan pajak penghasilan datang. Bayar Rp50 jt.", icon: "📑", effect: { type: "pay", amount: 50 }, fx: "dizzy" },
  { id: "itemSandal", title: "Nemu Sendal Terbang", text: "Sendal jepit bersayap! Simpan di kantong, lempar ke lawan sebelum kamu lempar dadu.", icon: "🩴", effect: { type: "item", item: "sandal" }, fx: "dance" },
  { id: "itemUtang", title: "Nemu Surat Utang", text: "Surat utang palsu tapi meyakinkan. Simpan, tagih ke lawan nanti!", icon: "📜", effect: { type: "item", item: "utang" }, fx: "dance" },
  { id: "itemTurbo", title: "Sepatu Roda Turbo", text: "Simpan buat giliran penting: langkahmu +3.", icon: "🛼", effect: { type: "item", item: "turbo" }, fx: "duck" },
  { id: "itemKecoak", title: "Karyawan Resign", text: "Karyawan sedikit, terjadi efisiensi! Simpan, pakai untuk turunkan 1 level bangunan lawan.", icon: "🏃", effect: { type: "item", item: "kecoak" }, fx: "shake" },
  { id: "orangDalam", title: "Kartu Orang Dalam", text: "Punya kenalan orang dalam. Bebas bayar sewa satu kali.", icon: "🕴️", effect: { type: "shield" }, fx: "dance" },
  { id: "tilang", title: "Kartu Kena Tilang", text: "Lupa bawa SIM, helm cuma ditenteng. Bayar denda Rp75 jt.", icon: "👮", effect: { type: "pay", amount: 75 }, fx: "cry" },
  { id: "pajak", title: "Kartu Bayar PAJAK", text: "Orang bijak taat pajak! Bayar Rp25 jt untuk setiap rumah, vila, dan landmark-mu.", icon: "🧾", effect: { type: "repair", perLevel: 25 }, fx: "cry" },
  { id: "korupsi", title: "Kartu Korupsi", text: "Main proyek fiktif. Kalau lolos untung besar, kalau ketahuan KPK boncos!", icon: "💼", effect: { type: "gacha", min: -200, max: 270 }, fx: "shake" },
  { id: "pinjol", title: "Kartu Pinjol", text: "Klik 'cairkan' tanpa baca syarat. Bunganya beranak pinak! Bayar Rp150 jt.", icon: "📱", effect: { type: "pay", amount: 150 }, fx: "cry" },
  { id: "viral", title: "Kartu Viral", text: "Kontenmu FYP! Setiap pemain kirim saweran Rp36 jt.", icon: "🤳", effect: { type: "collectFromAll", amount: 36 }, fx: "dance" },
  { id: "gusur", title: "Kartu Kena Gusur", text: "Lahanmu kena proyek strategis. Angkat koper, mundur 4 petak.", icon: "🚜", effect: { type: "back", steps: 4 }, fx: "shake" },
  { id: "wapres", title: "Kartu Wapres Resign", text: "Kursi kosong mendadak! Kamu langsung meluncur ke Istana Presiden.", icon: "🪑", effect: { type: "goto", tile: tileIndexByName("Istana Presiden") }, fx: "dizzy" },
  { id: "ronda", title: "Dipanggil Jadi Saksi", text: "Surat panggilan datang. Kamu buru-buru ke Polri.", icon: "⚖️", effect: { type: "goto", tile: tileIndexByName("Polri") }, fx: "dizzy" },
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
  /** Pemain acak diangkut helikopter ke petak acak (tanpa efek petak). */
  | { type: "heliAbduct" }
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
  { id: "bansos", headline: "Bansos Kumis Turun!", text: "Pak RT bagi-bagi amplop. Semua pemain +Rp60 jt.", icon: "🧧", effect: { type: "allGain", amount: 60 }, fx: "rain" },
  { id: "iuran", headline: "Iuran Agustusan", text: "Buat lomba panjat pinang. Semua pemain bayar Rp40 jt.", icon: "🇮🇩", effect: { type: "allPay", amount: 40 }, fx: "shake" },
  { id: "seagull", headline: "Serangan Burung Camar", text: "Seekor camar mencuri dompet satu pemain! -Rp80 jt.", icon: "🐦", effect: { type: "randomPay", amount: 80 }, fx: "cry" },
  { id: "lottery", headline: "Nemu Koper Misterius", text: "Isinya duit mainan... eh ternyata asli! Satu pemain +Rp150 jt.", icon: "🧳", effect: { type: "randomGain", amount: 150 }, fx: "dance" },
  { id: "pity", headline: "Donasi Kasihan", text: "Warga iba. Pemain paling miskin dapat Rp120 jt.", icon: "🥺", effect: { type: "poorestGain", amount: 120 }, fx: "cry" },
  { id: "robin", headline: "Maling Budiman Beraksi", text: "Pemain terkaya kehilangan Rp150 jt, dibagi ke yang lain.", icon: "🦹", effect: { type: "robinHood", amount: 150 }, fx: "shake" },
  { id: "heli", headline: "Heli Pejabat Salah Jemput!", text: "Pilot salah orang. Satu pemain diangkut ke lokasi acak.", icon: "🚁", effect: { type: "heliAbduct" }, fx: "heli" },
  { id: "blackout", headline: "Mati Lampu Se-Pulau", text: "Semua panik lalu joget di kegelapan. Tidak terjadi apa-apa.", icon: "🔦", effect: { type: "nothing" }, fx: "dance" },
  { id: "fartquake", headline: "Gempa Kentut 6,9 SR", text: "Tanah bergetar dan bau. Semua pemain bayar Rp30 jt buat beli pengharum.", icon: "💨", effect: { type: "allPay", amount: 30 }, fx: "fart" },
  { id: "giantduck", headline: "Bebek Raksasa Mendarat", text: "Turis datang foto-foto. Satu pemain jualan es dan dapat Rp100 jt.", icon: "🦆", effect: { type: "randomGain", amount: 100 }, fx: "duck" },
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
  utang: { id: "utang", name: "Surat Utang Palsu", icon: "📜", text: "Tagih satu lawan: ambil Rp100 jt darinya.", target: "player" },
  turbo: { id: "turbo", name: "Sepatu Roda Turbo", icon: "🛼", text: "Lemparan dadu giliran ini +3 langkah.", target: null },
  kecoak: { id: "kecoak", name: "Karyawan Resign", icon: "🏃", text: "Karyawan lawan resign, terjadi efisiensi: turunkan 1 level bangunannya (tanah tidak bisa).", target: "tile" },
};

/** Maksimal kartu simpanan per pemain. Kalau penuh, kartu baru dijual Rp50 jt. */
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

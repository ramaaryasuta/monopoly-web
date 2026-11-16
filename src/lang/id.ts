/**
 * Semua teks yang tampil ke pemain, dalam Bahasa Indonesia.
 *
 * Kode game tidak boleh menulis teks langsung: ambil dari `Lang`. Teks yang butuh data
 * (nama pemain, jumlah uang, dll.) berbentuk fungsi yang menerima nilai yang sudah
 * diformat. Untuk bahasa lain, buat file dengan bentuk yang sama (tipe `Lang`)
 * lalu ganti impor `Lang`.
 */

/** Nilai yang boleh disisipkan ke teks (sudah diformat oleh pemanggil). */
type Fmt = string | number;

// ============================================================ data: kartu, event, item, musim
/** Kartu Paket (id kartu -> judul & teks). */
const cards = {
  coinRain: { title: "Mendapat Bansos", text: "Namamu masuk daftar penerima bantuan. Terima Rp135 jt." },
  harvest: { title: "Ada yang Salah Transfer", text: "Saldo tiba-tiba nambah, pengirimnya nggak bisa dihubungi. Terima Rp90 jt." },
  leakyWallet: { title: "IHSG Anjlok", text: "Portofolio sahammu merah semua. Rugi Rp100 jt." },
  repair: { title: "Atap Bocor Semua", text: "Musim hujan! Bayar Rp20 jt untuk setiap rumah, vila, dan landmark-mu." },
  shield: { title: "Kolor Mas Amba", text: "Penagih ketakutan melihat bekas Mas Amba. Bebas bayar sewa satu kali." },
  toStart: { title: "Ketapel Raksasa", text: "Kamu ditembakkan pakai ketapel ke petak Mulai!" },
  toIsland: { title: "Digrebek Polisi", text: "Ketahuan main judi online. Langsung digiring ke Nusakambangan!" },
  birthday: { title: "Ultah Dadakan", text: "Ngaku ulang tahun (padahal bukan). Setiap pemain memberimu Rp45 jt." },
  back3: { title: "Kunci Motor Ketinggalan", text: "Balik lagi! Mundur 3 petak." },
  toFestival: { title: "Dapat Undangan VIP", text: "Namamu nyelip di daftar tamu. Berangkat ke Pesta Pejabat!" },
  fart: { title: "Kentut Nuklir", text: "BRRRT! Semua pemain lain terpental mundur 2 petak." },
  heli: { title: "Nebeng Heli Pejabat", text: "Disangka ajudan, kamu ikut terbang lalu diturunkan di lokasi acak." },
  swap: { title: "Tukar Jiwa", text: "Kesamber petir bareng pemain lain (kecuali yang di Nusakambangan). Kalian tukar posisi!" },
  treat: { title: "Kalah Taruhan Bola", text: "Timmu kalah 7-0. Traktir semua pemain, masing-masing Rp50 jt." },
  steal: { title: "Pinjam Dulu Seratus", text: "Kamu pinjam ke pemain terkaya. Nggak bakal dibalikin. Ambil Rp100 jt." },
  claw: { title: "Mesin Capit Warung", text: "Coba peruntungan! Bisa untung, bisa boncos." },
  duck: { title: "Bebek Karet Ajaib", text: "Bebek karet raksasa mendorongmu maju 4 petak. Kwek!" },
  sandal: { title: "Mendapat Dividen", text: "Saham yang kamu lupa pernah beli ternyata bagi dividen. Terima Rp72 jt." },
  gorengan: { title: "Bayar Karyawan Lembur", text: "Proyek dikejar deadline, semua lembur. Bayar Rp60 jt." },
  mancing: { title: "Teman Lama Bayar Hutang", text: "Utang sepuluh tahun lalu akhirnya dilunasi. Terima Rp63 jt." },
  cukur: { title: "Bayar Pajak PPh 21", text: "Potongan pajak penghasilan datang. Bayar Rp50 jt." },
  itemSandal: { title: "Nemu Sendal Terbang", text: "Sendal jepit bersayap! Simpan di kantong, lempar ke lawan sebelum kamu lempar dadu." },
  itemUtang: { title: "Nemu Surat Utang", text: "Surat utang palsu tapi meyakinkan. Simpan, tagih ke lawan nanti!" },
  itemTurbo: { title: "Sepatu Roda Turbo", text: "Simpan buat giliran penting: langkahmu +3." },
  itemKecoak: { title: "Karyawan Resign", text: "Karyawan sedikit, terjadi efisiensi! Simpan, pakai untuk turunkan 1 level bangunan lawan." },
  orangDalam: { title: "Kartu Orang Dalam", text: "Punya kenalan orang dalam. Bebas bayar sewa satu kali." },
  tilang: { title: "Kartu Kena Tilang", text: "Lupa bawa SIM, helm cuma ditenteng. Bayar denda Rp75 jt." },
  pajak: { title: "Kartu Bayar PAJAK", text: "Orang bijak taat pajak! Bayar Rp25 jt untuk setiap rumah, vila, dan landmark-mu." },
  korupsi: { title: "Kartu Korupsi", text: "Main proyek fiktif. Kalau lolos untung besar, kalau ketahuan KPK boncos!" },
  pinjol: { title: "Kartu Pinjol", text: "Klik 'cairkan' tanpa baca syarat. Bunganya beranak pinak! Bayar Rp150 jt." },
  viral: { title: "Kartu Viral", text: "Kontenmu FYP! Setiap pemain kirim saweran Rp36 jt." },
  gusur: { title: "Kartu Kena Gusur", text: "Lahanmu kena proyek strategis. Angkat koper, mundur 4 petak." },
  wapres: { title: "Kartu Wapres Resign", text: "Kursi kosong mendadak! Kamu langsung meluncur ke Istana Presiden." },
  ronda: { title: "Dipanggil Jadi Saksi", text: "Surat panggilan datang. Kamu buru-buru ke Polri." },
};

/** Event Berita Heboh (id event -> judul & teks). */
const chaos = {
  bansos: { headline: "Bansos Kumis Turun!", text: "Pak RT bagi-bagi amplop. Semua pemain +Rp60 jt." },
  iuran: { headline: "Iuran Agustusan", text: "Buat lomba panjat pinang. Semua pemain bayar Rp40 jt." },
  seagull: { headline: "Serangan Burung Camar", text: "Seekor camar mencuri dompet satu pemain! -Rp80 jt." },
  lottery: { headline: "Nemu Koper Misterius", text: "Isinya duit mainan... eh ternyata asli! Satu pemain +Rp150 jt." },
  pity: { headline: "Donasi Kasihan", text: "Warga iba. Pemain paling miskin dapat Rp120 jt." },
  robin: { headline: "Maling Budiman Beraksi", text: "Pemain terkaya kehilangan Rp150 jt, dibagi ke yang lain." },
  heli: { headline: "Heli Pejabat Salah Jemput!", text: "Pilot salah orang. Satu pemain diangkut ke lokasi acak." },
  blackout: { headline: "Mati Lampu Se-Pulau", text: "Semua panik lalu joget di kegelapan. Tidak terjadi apa-apa." },
  fartquake: { headline: "Gempa Kentut 6,9 SR", text: "Tanah bergetar dan bau. Semua pemain bayar Rp30 jt buat beli pengharum." },
  giantduck: { headline: "Bebek Raksasa Mendarat", text: "Turis datang foto-foto. Satu pemain jualan es dan dapat Rp100 jt." },
};

/** Kartu simpanan (id item -> nama & teks). */
const items = {
  sandal: { name: "Sendal Terbang", text: "Lempar ke satu lawan: dia mundur 3 petak." },
  utang: { name: "Surat Utang Palsu", text: "Tagih satu lawan: ambil Rp100 jt darinya." },
  turbo: { name: "Sepatu Roda Turbo", text: "Lemparan dadu giliran ini +3 langkah." },
  kecoak: { name: "Karyawan Resign", text: "Karyawan lawan resign, terjadi efisiensi: turunkan 1 level bangunannya (tanah tidak bisa)." },
};

/** Event musiman (id musim -> judul, teks, lencana). */
const seasons = {
  turis: { headline: "Musim Turis Bule!", text: "Turis datang rombongan. Semua sewa x2 selama 2 ronde.", badge: "Sewa x2" },
  banjir: { headline: "Banjir Kiriman!", text: "Tukang bangunan pada ngungsi. Tidak bisa beli/bangun selama 2 ronde.", badge: "Tidak bisa bangun" },
  diskon: { headline: "Harbolnas Semen!", text: "Toko bangunan cuci gudang. Biaya beli/bangun diskon 50% selama 2 ronde.", badge: "Bangun -50%" },
  thr: { headline: "Musim THR!", text: "Bos lagi baik. Gaji lewat Mulai jadi x2 selama 2 ronde.", badge: "Gaji x2" },
};

/** Nama petak papan menurut indeks petak (0..39). */
const tiles: Record<number, string> = {
  0: "Mulai",
  1: "Burjo SS Tembalang",
  2: "Malioboro",
  3: "OTY Fried Chicken",
  4: "RM Pagi Sore",
  5: "Sei Indonesia",
  6: "Paket Shopee",
  7: "Rumah Ratapan Oslo",
  8: "Lawang Rongewu",
  9: "Lembang Park Zoo",
  10: "Nusakambangan",
  11: "Polri",
  12: "Tugu Jogja",
  13: "Paket Tokopedia",
  14: "Buletan HI",
  15: "Gedung Sate",
  16: "Monas",
  17: "Jembatan Mahakam",
  18: "Bank Living by Sendiri",
  19: "Karimun Jawa",
  20: "Pesta Pejabat",
  21: "Kopi Kenangan",
  22: "Paket Blibli",
  23: "Telkom",
  24: "Pakuwon Mall",
  25: "Sam Poo Kong",
  26: "Wakatobi",
  27: "Tambang Nikel",
  28: "IKN",
  29: "Candi Prambanan",
  30: "Naik Pesawat Negara",
  31: "Raja Ampat",
  32: "Jam Gadang",
  33: "Kantor KPK",
  34: "Candi Borobudur",
  35: "Paket Lazada",
  36: "Uang Ormas",
  37: "Gedung DPR",
  38: "Masjid Istiqlal",
  39: "Istana Presiden",
};

// ============================================================ alur permainan (core/game.ts): pesan giliran, sewa, kartu, nego, utang
const game = {
  tawaranKirim: (from: Fmt, first: boolean, to: Fmt, offer: Fmt) => `🤝 ${from} ${first ? "menawarkan" : "menawar balik"} ke ${to}: ${offer}`,
  diundi: (currentPlayer: Fmt) => `🎲 Diundi: ${currentPlayer} jalan duluan!`,
  tigaKembarPenjara: (player: Fmt) => `${player} melempar dadu kembar 3x — dijebloskan ke Nusakambangan!`,
  kembarLagi: (player: Fmt) => `Dadu kembar! ${player} melempar lagi.`,
  sogokSipir: (player: Fmt, islandBail: Fmt) => `${player} nyogok sipir ${islandBail} dan keluar lewat pintu belakang. Bebas!`,
  kaburKembar: (player: Fmt) => `${player} dapat dadu kembar dan kabur dari Nusakambangan!`,
  masihTerjebak: (player: Fmt, islandTurns: Fmt) => `${player} masih terjebak (${islandTurns} giliran lagi).`,
  bebasBerikutnya: (player: Fmt) => `${player} akan bebas di giliran berikutnya.`,
  terbangKe: (player: Fmt, tile: Fmt) => `${player} terbang ke ${tile}.`,
  urutanNormal: "🔁 Urutan giliran kembali normal.",
  urutanDibalik: "🐍 Urutan giliran dibalik ronde ini!",
  lewatMulai: (player: Fmt, amount: Fmt) => `${player} melewati Mulai: +${amount}`,
  bayarOrmas: (player: Fmt, tax: Fmt) => `${player} membayar uang ormas ${tax}.`,
  dijebloskan: (player: Fmt) => `${player} dijebloskan ke Nusakambangan! Kasihan...`,
  naikPesawat: (player: Fmt) => `${player} naik Pesawat Negara! Giliran berikutnya pilih mau mendarat di mana.`,
  perisaiSewa: (player: Fmt, rent: Fmt) => `Kartu pelindung menyelamatkan ${player} dari sewa ${rent}!`,
  perisaiDisimpan: (player: Fmt) => `${player} menyimpan kartu bebas sewa untuk nanti.`,
  perisaiHangus: (player: Fmt) => `🛡️ ${player} sudah pegang kartu bebas sewa (maks 1) — kartu lama hangus, diganti yang baru.`,
  bayarSewa: (player: Fmt, rent: Fmt, owner: Fmt) => `${player} membayar sewa ${rent} ke ${owner}.`,
  banjirTolakBeli: (player: Fmt, tile: Fmt) => `Lagi banjir! ${player} tidak bisa beli/bangun di ${tile}.`,
  uangKurangBeli: (player: Fmt, tile: Fmt) => `${player} tidak punya cukup uang untuk membeli ${tile}.`,
  tempatWisata: "tempat wisata",
  membeli: (player: Fmt, tile: Fmt, what: Fmt, cost: Fmt) => `${player} membeli ${tile} (${what}) seharga ${cost}.`,
  membangun: (player: Fmt, what: Fmt, tile: Fmt, cost: Fmt) => `${player} membangun ${what} di ${tile} (${cost}).`,
  pestaTanpaProperti: (player: Fmt) => `${player} datang ke Pesta Pejabat tapi belum punya properti buat dijadikan tempat pesta.`,
  pestaDigelar: (tile: Fmt, festivalMultiplier: Fmt) => `Pesta Pejabat di ${tile}! Sewa jadi x${festivalMultiplier}.`,
  pinjam: (player: Fmt, amount: Fmt, victim: Fmt) => `${player} "pinjam" ${amount} dari ${victim}.`,
  capitUntung: (player: Fmt, amount: Fmt) => `Mesin capit dapat boneka! ${player} +${amount}`,
  capitRugi: (player: Fmt, amount: Fmt) => `Mesin capit makan koin! ${player} −${amount}`,
  tukarTempat: (player: Fmt, other: Fmt) => `${player} dan ${other} tukar tempat!`,
  heliTurun: (player: Fmt, tile: Fmt) => `Helikopter menurunkan ${player} di ${tile}.`,
  kantongPenuh: (player: Fmt, def: Fmt, victim: Fmt) => `Kantong ${player} penuh! ${def} dijual ke tukang loak: +${victim}.`,
  simpanItem: (player: Fmt, icon: Fmt, def: Fmt) => `${player} menyimpan ${icon} ${def} di kantong.`,
  lemparSendal: (player: Fmt, victim: Fmt, SANDAL_STEPS: Fmt) => `${player} melempar Sendal Terbang ke ${victim}! Mundur ${SANDAL_STEPS} petak.`,
  tagihUtang: (player: Fmt, victim: Fmt, amount: Fmt) => `${player} menagih surat utang palsu ke ${victim}: ${amount}!`,
  pakaiTurbo: (player: Fmt, TURBO_STEPS: Fmt) => `${player} pakai Sepatu Roda Turbo: lemparan ini +${TURBO_STEPS} langkah!`,
  karyawanResign: (owner: Fmt, tile: Fmt, level: Fmt) => `Karyawan ${owner} di ${tile} resign! Terjadi efisiensi, bangunan turun jadi ${level}.`,
  batasTawar: (player: Fmt, MAX_TRADES_PER_TURN: Fmt) => `${player} sudah ${MAX_TRADES_PER_TURN}x menawar di giliran ini.`,
  pasarMemajang: (player: Fmt, def: Fmt, price: Fmt) => `🏪 ${player} memajang ${def} di Pasar Terbuka seharga ${price}.`,
  pasarMenarik: (player: Fmt, tile: Fmt) => `🏪 ${player} menarik ${tile} dari Pasar Terbuka.`,
  pasarMembeli: (player: Fmt, tile: Fmt, seller: Fmt, price: Fmt) => `🏪 ${player} membeli ${tile} dari ${seller} di Pasar Terbuka seharga ${price}!`,
  tawaranBatal: (err: Fmt) => `🤝 Tawaran batal: ${err}.`,
  tawaranDitolak: (to: Fmt, from: Fmt) => `🙅 ${to} menolak tawaran ${from}.`,
  dealDiterima: (to: Fmt, from: Fmt) => `🤝 Deal! ${to} menerima tawaran ${from}.`,
  batasTawarTunggu: (player: Fmt, MAX_TRADES_PER_TURN: Fmt) => `${player} sudah ${MAX_TRADES_PER_TURN}x menawar di giliran ini. Tunggu giliran berikutnya ya.`,
  rezeki: (name: Fmt, amount: Fmt) => `${name} kecipratan rezeki +${amount}!`,
  apes: (name: Fmt, amount: Fmt) => `${name} apes, −${amount}.`,
  malingBudiman: (name: Fmt, share: Fmt) => `Maling budiman merampok ${name} dan bagi-bagi ${share} per orang!`,
  heliBatal: (victim: Fmt) => `Helikopter mau jemput ${victim}, tapi penjagaan Nusakambangan terlalu ketat. Batal!`,
  heliAngkut: (victim: Fmt, tile: Fmt) => `${victim} diangkut helikopter pejabat ke ${tile}!`,
  bangkrut: (player: Fmt) => `${player} BANGKRUT!`,
  uangKurang: (player: Fmt, money: Fmt) => `💸 Uang ${player} kurang ${money}! Jual aset atau nego dulu...`,
  turunkanBangunan: (player: Fmt, tile: Fmt, level: Fmt, value: Fmt) => `${player} menurunkan ${tile} jadi ${level}, dapat ${value} dari bank.`,
  jualKeBank: (player: Fmt, tile: Fmt, value: Fmt) => `${player} menjual ${tile} ke bank seharga ${value}.`,
};

// ============================================================ aturan (core/rules.ts): level bangunan & alasan kemenangan
const rules = {
  levelNames: ["Kosong", "Tanah", "Rumah 1", "Rumah 2", "Vila", "Landmark"],
  playerCount: "Jumlah pemain harus 2-4",
  lastStanding: "Pemain terakhir yang bertahan!",
  tripleMonopoly: "Monopoli 3 grup warna!",
  lineMonopoly: "Menguasai satu sisi papan penuh!",
  resortMonopoly: "Menguasai semua tempat wisata + 1 grup warna!",
  roundLimit: "Batas ronde tercapai — kekayaan terbesar!",
};

// ============================================================ negosiasi & pasar (core/trade.ts): alasan tawaran ditolak, ringkasan tawaran
const trade = {
  unknownPlayer: "pemain tidak dikenal",
  selfTrade: "tidak bisa tawar ke diri sendiri",
  bankruptPlayer: "pemain sudah bangkrut",
  brokenData: "data tawaran rusak",
  badMoney: "jumlah uang tidak sah",
  duplicateTiles: "wilayah dobel",
  giveNotOwned: "wilayah yang ditawarkan bukan milik pengirim",
  takeNotOwned: "wilayah yang diminta bukan milik lawan",
  moneyOneSide: "uang hanya boleh dari satu pihak",
  noTiles: "tawaran tidak boleh tanpa wilayah",
  moneyShort: (name: Fmt) => `uang ${name} tidak cukup`,
  describe: (a: Fmt, give: Fmt, b: Fmt, take: Fmt) => `${a} beri [${give}] ⇄ ${b} beri [${take}]`,
  nothing: "—",
};

// ============================================================ format uang (core/money.ts)
const money = {
  locale: "id-ID",
  prefix: "Rp",
  trillion: " T",
  billion: " M",
  million: " jt",
  thousand: " rb",
};

// ============================================================ menu utama, lobi, & cara main (ui/Menu.ts)
const menu = {
  charBlurb: ["Kumisnya bikin lawan minder.","Satu mata, fokus ke cuan.","Pedasnya bikin lawan kepanasan.","Kalem di luar, segar di dalam.","Badan gede, hati lembut, kantong tebal.","Tujuh nyawa, nol rasa kasihan."],
  defaultNames: ["Kentang","Om Mata","Cabai","Timun","Paus","Kucing"],
  you: "Kamu",
  back: "← Kembali",
  logo: "MEMONOPOLI",
  logoSub: "Wilayah WNI",
  tagline: "Lempar dadu, beli Gedung DPR, kentutin lawan, jadi sultan! 💨💸",
  localTitle: "Main Bareng di Sini",
  localSub: "1 perangkat · 2–4 pemain · bisa lawan bot",
  onlineTitle: "Main Online",
  onlineSub: "Buat room & ajak teman pakai kode",
  rulesTitle: "Cara Main",
  rulesSub: "Aturan singkat & cara menang",
  settings: "⚙️ Pengaturan",
  startPlay: "▶ Mulai Main!",
  playerCount: (active: Fmt) => `${active} pemain`,
  minPlayers: "Minimal 2 pemain ya!",
  nextChar: "Karakter berikutnya",
  prevChar: "Karakter sebelumnya",
  typeHuman: "Orang",
  typeBot: "Bot",
  clearSlot: "Kosongkan slot",
  emptySlot: "Slot kosong",
  seedPlaceholder: "acak",
  advanced: "⚙️ Opsi lanjutan",
  seedLabel: "🎲 Seed (untuk mengulang game yang sama)",
  pickPlayers: "🛋️ Pilih Pemain",
  pickHint: "Ganti karakter pakai ◀ ▶. Main bergantian di perangkat ini.",
  speed: "⏩ Kecepatan",
  codePlaceholder: "KODE",
  createRoom: "Buat Room",
  join: "Gabung",
  creating: "⏳ Membuat...",
  codeLength: (CODE_LEN: Fmt) => `Kode room harus ${CODE_LEN} huruf.`,
  joining: "⏳ Menyambung...",
  rejoin: "🔄 Sambung ulang",
  forgetSession: "Lupakan sesi ini",
  rejoinHint: (code: Fmt) => `Tadi kamu main di room <b>${code}</b>. Terputus? Masuk lagi ke kursimu:`,
  onlineHeader: "🌐 Main Online",
  yourName: "Namamu",
  hostTitle: "Buat Room",
  hostSub: "Jadi tuan rumah, bagikan kode ke teman.",
  joinTitle: "Gabung Room",
  joinSub: "Masukkan kode dari temanmu.",
  p2pHint: "Tersambung langsung antar perangkat (peer-to-peer). Host harus tetap membuka game sampai selesai.",
  addBot: "＋ Tambah Bot 🤖",
  copyInviteTitle: "Salin link undangan",
  copyLink: "📋 Salin link",
  copied: "✅ Tersalin!",
  copyPrompt: "Salin link ini:",
  changeChar: "Ganti karakter",
  tagHost: "👑 Host",
  tagBot: "🤖 Bot",
  tagGuest: "🌐 Tamu",
  removeBot: "Hapus bot",
  kick: "Keluarkan",
  youSuffix: " (kamu)",
  waitingFriend: "Menunggu teman...",
  lobbyShare: "Bagikan kode ke teman, atau tambah bot. Minimal 2 pemain.",
  lobbyReady: "Siap! Tekan Mulai kalau semua sudah masuk.",
  lobbyWaitHost: "Menunggu host memulai permainan... ⏳",
  roomHeader: "🌐 Room Online",
  roomCode: "KODE ROOM",
  rulesHeader: "📖 Cara Main",
  rule1: "Lempar dadu, jalan, lalu <b>beli</b> tanah & bangun rumah → vila → <b>landmark</b>.",
  rule2: (setBonusPct: Fmt) => `Mendarat di properti lawan? Bayar <b>sewa</b>. Punya satu <b>grup warna lengkap</b>? Sewanya +${setBonusPct}%! Properti lawan hanya bisa didapat lewat <b>negosiasi</b> atau <b>Pasar Terbuka</b>.`,
  rule3: "Dadu kembar = lempar lagi. Kembar 3x = dijebloskan ke <b>Nusakambangan</b> (keluar dengan dadu kembar atau sogok sipir).",
  rule4: (salary: Fmt, festivalMultiplier: Fmt) => `Lewat Mulai: +${salary}. <b>Pesta Pejabat</b>: sewa x${festivalMultiplier}. <b>Naik Pesawat Negara</b>: terbang ke petak mana saja.`,
  rule5: "<b>Paket Shopee, Tokopedia, Blibli & Lazada</b>: paket misterius berisi kartu konyol — bisa dapat duit, bisa kena kentut nuklir.",
  rule6: "<b>Berita Heboh</b>: heli pejabat salah jemput, gempa kentut, maling budiman bisa muncul tiap ronde!",
  winHeader: "🏆 Cara Menang",
  winLastStanding: "Semua lawan bangkrut",
  winTriple: "Monopoli 3 grup warna",
  winLine: "Kuasai 1 sisi papan",
  winResort: "Kuasai semua wisata + 1 grup warna",
  winRoundLimit: (roundLimit: Fmt) => `Terkaya di ronde ${roundLimit}`,
};

// ============================================================ negosiasi & Pasar Terbuka (ui/TradeUi.ts)
const tradeUi = {
  netDiff: (sign: Fmt, amount: Fmt) => `Selisih nilai buatmu: ${sign}${amount}`,
  moneyOf: (who: Fmt, amount: Fmt) => `Uang ${who}: ${amount}`,
  you: "kamu",
  nowPrice: (price: Fmt) => ` · sekarang ${price}`,
  none: "— tidak ada —",
  youGet: "✅ Kamu dapat",
  youGiveTo: (from: Fmt) => `📤 Kamu berikan ke ${from}`,
  netNote: " (berdasarkan nilai investasi, belum termasuk strategi monopoli)",
  pickTitle: "🤝 Negosiasi dengan siapa?",
  pickHint: "<p>Tukar atau jual-beli wilayah. Lawan bisa menerima, menolak, atau menawar balik.</p>",
  youGive: "📤 Kamu berikan",
  youAsk: (them: Fmt) => `📥 Kamu minta dari ${them}`,
  noTiles: "— belum punya wilayah —",
  plusMoney: "💰 + Uang",
  plusAskMoney: "💰 + Minta uang",
  sendOffer: "📨 Kirim Tawaran",
  marketEmpty: "Pasar masih sepi. Belum ada wilayah yang dijual.",
  levelValue: (level: Fmt, value: Fmt) => `${level} · nilai ${value}`,
  yours: "Milikmu",
  belowValue: "di bawah nilai",
  overpriced: "kemahalan",
  moneyShort: (money: Fmt) => `Uang kurang ${money}`,
  withdraw: "↩️ Tarik",
  buy: "🛒 Beli",
  marketTitle: "🏪 Pasar Terbuka",
  marketHint: "Beli atau pajang wilayah saat giliranmu, sebelum lempar dadu.",
  yourMoney: "Uangmu ",
  marketNote: "Semua pemain bisa melihat pasar. Wilayah yang dipajang tetap milikmu sampai ada yang membeli.",
  listTile: "➕ Pajang wilayah",
  confirmAsk: "Yakin mau membeli wilayah ini?",
  investValue: "Nilai investasi",
  moneyAfter: "Uangmu setelah beli",
  overpricedWarn: "⚠️ Harga ini jauh di atas nilai investasinya.",
  confirmBuy: "🛒 Konfirmasi Pembelian",
  buyPrice: (price: Fmt) => `✅ Beli ${price}`,
  listWhich: "➕ Pajang wilayah mana?",
  listWhichHint: "<p>Wilayah tetap milikmu (sewa tetap masuk) sampai ada yang membelinya.</p>",
  investOf: (tile: Fmt) => `Nilai investasi ${tile}: `,
  priceLabel: "💰 Harga",
  priceTitle: (tile: Fmt) => `🏷️ Harga ${tile}`,
  list: "🏪 Pajang",
  minPlaceholder: (MIN_MARKET_PRICE: Fmt) => `min ${MIN_MARKET_PRICE}`,
  colTile: "Wilayah",
  colSeller: "Penjual",
  colPrice: "Harga",
  legendGet: "Kamu dapat",
  legendGive: "Kamu berikan",
  legendAsk: "Kamu minta",
  legendMarket: "Dijual di pasar",
};

// ============================================================ HUD, info petak, layar akhir (ui/Hud.ts)
const hud = {
  shieldTag: (n: Fmt, max: Fmt) => `🛡️${n}/${max}`,
  turnTabTitle: (title: Fmt) => `🎲 Giliranmu! · ${title}`,
  kindLabel: { start: "Petak Mulai", property: "Properti", resort: "Tempat Wisata", chance: "Paket Misterius", tax: "Pajak", island: "Penjara", festival: "Pesta Pejabat", tour: "Naik Pesawat Negara" },
  tileHelp: { start: (salary: Fmt) => `Dapat ${salary} setiap melewati petak ini.`, chance: "Paket datang tanpa pesan! Buka isinya — bisa duit, bisa kentut nuklir!", tax: (pct: Fmt, min: Fmt) => `Ormas datang minta "uang keamanan". Bayar ${pct}% dari uangmu (minimal ${min}).`, island: (turns: Fmt, bail: Fmt) => `Dipenjara ${turns} giliran. Keluar dengan dapat dadu kembar atau sogok sipir ${bail}.`, festival: (mult: Fmt) => `Gelar pesta pejabat di satu propertimu — sewanya jadi x${mult}.`, tour: (fee: Fmt) => `Numpang pesawat negara: giliran berikutnya mendarat di petak mana saja (ongkos ${fee}).` },
  roundLabel: (round: Fmt, limit: Fmt) => `Ronde ${round} / ${limit}`,
  seasonLabel: (icon: Fmt, badge: Fmt, left: Fmt) => `  ·  ${icon} ${badge} (${left} ronde)`,
  levelRow: (cls: Fmt, name: Fmt, build: Fmt, rent: Fmt) => `<tr class="${cls}"><td>${name}</td><td>bangun ${build}</td><td>sewa ${rent}</td></tr>`,
  resortWord: "Wisata",
  festivalTag: " ⭐ Festival",
  ownerInfo: (color: Fmt, name: Fmt, levelName: Fmt, rent: Fmt, festival: Fmt, invested: Fmt) => `<p>Pemilik: <b style="color:${color}">${name}</b> — ${levelName}<br/>Sewa saat ini: <b>${rent}</b>${festival}<br/>Nilai investasi: ${invested}</p>`,
  market: "Pasar Terbuka",
  turnNow: "🎲 GILIRAN",
  turnNext: "⏭️ BERIKUTNYA",
  log: "📜 Catatan",
  resetCam: "Reset kamera",
  tradeAnytime: "Negosiasi kapan saja",
  nego: "🤝 Nego",
  bankruptTag: "💀 Bangkrut",
  roll: "🎲 LEMPAR DADU",
  useCard: (count: Fmt) => `🎒 Pakai Kartu (${count})`,
  cards: (items: Fmt) => `🎒 Kartu (${items})`,
  trade: "🤝 Negosiasi",
  tradeUsed: "🤝 Jatah habis",
  marketCount: (listed: Fmt) => `🏪 Pasar · ${listed}`,
  resortInfo: (victim: Fmt, resortBaseRent: Fmt) => `<p>Harga ${victim}. Sewa ${resortBaseRent} dan berlipat ganda untuk setiap tempat wisata yang dimiliki pemilik yang sama.</p>`,
  unowned: "<p>Belum dimiliki.</p>",
  listedInMarket: (price: Fmt) => `<p class="listed">🏪 Dijual di Pasar Terbuka: <b>${price}</b></p>`,
  bankruptSuffix: " (bangkrut)",
  winnerLine: (avatar: Fmt, name: Fmt, reason: Fmt) => `${avatar} ${name} menang! ${reason}`,
  gameOver: "🏆 Permainan Selesai!",
  playAgain: "🔁 Main Lagi",
  animSpeed: "Kecepatan animasi",
  marketBtn: "🏪 Pasar",
};

// ============================================================ dialog keputusan pemain manusia (ui/HumanDecider.ts)
const human = {
  offerFrom: (first: boolean, name: Fmt) => `🤝 ${first ? "Tawaran" : "Tawar balik"} dari ${name}`,
  continue: "⛓️ LANJUT",
  offerTo: (name: Fmt) => `🤝 Tawaran ke ${name}`,
  forWho: (me: Fmt) => `Untuk ${me} 👀`,
  accept: "✅ Terima",
  counterBtn: "🔁 Tawar Balik",
  reject: "❌ Tolak",
  counterTo: (name: Fmt) => `🔁 Tawar balik ke ${name}`,
  bag: "🎒 Kantong Ajaib",
  bagHint: "<p>Pakai satu kartu sebelum lempar dadu.</p>",
  target: (icon: Fmt, item: Fmt) => `${icon} Sasaran ${item}`,
  pickResign: (icon: Fmt) => `Klik bangunan lawan yang karyawannya mau dibikin resign ${icon}`,
  buyQ: (tile: Fmt) => `Beli ${tile}?`,
  buildQ: (tile: Fmt) => `Bangun di ${tile}?`,
  buyResort: (cost: Fmt) => `🌴 Beli Wisata — ${cost}`,
  rent: (rent: Fmt) => `sewa ${rent}`,
  moneyShort: (short: Fmt) => `💸 uang kurang ${short}`,
  skipOk: "Oke, lewati",
  skip: "Lewati",
  currentLevel: (level: Fmt) => `Saat ini: <b>${level}</b>. `,
  lapNote: "<p class=\"lap-note\">🚩 Putaran pertama: baru bisa beli tanah. Rumah & vila setelah lewat Mulai.</p>",
  buyBody: (levelText: Fmt, money: Fmt, lapNote: Fmt) => `<p>${levelText}Uangmu: <b>${money}</b></p>${lapNote}`,
  debtTitle: "💸 Uangnya kurang!",
  debtBody: (amount: Fmt, to: Fmt, money: Fmt, short: Fmt) => `Harus bayar <b>${amount}</b> ke <b>${to}</b>. Uangmu <b>${money}</b>, kurang <b>${short}</b>.`,
  sellAllShort: (total: Fmt) => `⚠️ Walau semua dijual ke bank (+${total}) masih kurang. Coba nego jual ke pemain lain, atau menyerah.`,
  debtHelp: "Turunkan bangunan (wilayah tetap milikmu), jual wilayah ke bank (50% nilai investasi), atau nego jual ke pemain lain.",
  downgradeMax: (tile: Fmt, value: Fmt) => `⬇️ Turunkan ${tile} — maks +${value}`,
  sellTile: (tile: Fmt, value: Fmt) => `🏦 Jual ${tile} — +${value}`,
  negoSell: (left: Fmt) => `🤝 Nego jual ke pemain (sisa ${left}x)`,
  negoUsed: "🤝 Jatah nego habis",
  giveUp: "🏳️ Menyerah (bangkrut)",
  downgrade: (tile: Fmt) => `⬇️ Turunkan ${tile}`,
  downgradeBody: (level: Fmt, short: Fmt) => `Sekarang <b>${level}</b>. Bangunan dijual ke bank 50% harga, wilayah tetap milikmu. Kurang <b>${short}</b>.`,
  becomes: (level: Fmt, value: Fmt) => `Jadi ${level} — +${value}`,
  enough: "✅ cukup",
  back: "↩️ Kembali",
  sellTo: (name: Fmt) => `🤝 Jual ke ${name}`,
  sure: "🏳️ Yakin menyerah?",
  giveUpBody: (name: Fmt) => `<p>${name} akan bangkrut dan semua wilayahnya kembali ke bank.</p>`,
  cancel: "Batal",
  yesBankrupt: "Ya, bangkrut",
  jailTitle: "⛓️ Dipenjara di Nusakambangan",
  jailBody: (turnsLeft: Fmt) => `<p>Sisa ${turnsLeft} giliran. Dapatkan dadu kembar untuk kabur, atau sogok sipir biar langsung bebas.</p>`,
  bribe: (bail: Fmt) => `💰 Sogok sipir ${bail}`,
  tryDouble: "🎲 Coba dapat dadu kembar",
  shieldTitle: "🛡️ Pakai Kartu Bebas Sewa?",
  shieldBody: (rent: Fmt, tile: Fmt, owner: Fmt) =>
    `<p>Kamu kena sewa <b>${rent}</b> di <b>${tile}</b> milik ${owner}.</p><p>Pakai kartu bebas sewa sekarang, atau bayar dan simpan kartunya untuk sewa yang lebih mahal nanti?</p><p class="hint">🛡️ Maksimal pegang 1 kartu — kalau dapat kartu baru, kartu lama hangus.</p>`,
  shieldUse: "🛡️ Pakai kartu (gratis)",
  shieldPay: (rent: Fmt) => `💸 Bayar ${rent}, simpan kartu`,
  pickTour: "Klik petak tujuan pesawat negara",
  pickFestival: "Klik propertimu untuk Pesta Pejabat",
};

// ============================================================ presenter 3D: celetukan, tombol, & kartu (ui/ScenePresenter.ts)
const scene = {
  itemShout: ["Rasakan ini!","Hiyaaat!","Kejutan!","Hehehe...","Awas ya!"],
  pow: ["BOOM!","WADUH!","PLAK!","BRRRT!","GASS!","ANJAY!","DUAR!"],
  okLabels: ["OK deh","Pasrah 🙏","Gaskeun!","Yaudah lah","Siap bos!"],
  happy: ["Gaskeun! 🔥","Rezeki anak soleh!","Mantap jiwa!","Sultan mah bebas 😎","Hahaha kaya!","Cuan cuan cuan!","Traktir? Nggak."],
  sad: ["Waduh...","Dompetku menangis 😭","Kok gitu sih?!","Asem!","Astagaa...","Nangis di pojokan","Gajian masih lama..."],
  dealAsk: ["Deal, bos? 🤝","Ada penawaran menarik nih!","Bisa nego dong~","Harga teman!"],
  dealCounter: ["Kurang dikit lagi...","Gimana kalau segini?","Naikin dong! 😤","Nego tipis-tipis"],
  dealNo: ["Ogah! 🙅","Mimpi kali!","Nggak dulu deh","Harga diri lebih mahal!"],
  dealYes: ["Deal! 🤝","Sepakat!","Cuan bareng!","Salaman dulu!"],


  setShout: ["Satu komplek punyaku! 👑","Tuan tanah sejati!","Sewa naik, bos! 📈","Komplit kayak nasi padang!","Lunas semua, hehe"],
  eventButtons: ["Astaga!","Waduh!","Hah?!","Ngakak 🤣"],
  seasonButtons: ["Siap!","Wah!","Gaskeun!","Oke deh"],
  bankruptSpeech: ["Mampus aku...","Pinjol mana pinjol?!","Aku pulang kampung aja 😭","Jual ginjal kah?"],
  destBanner: (name: Fmt, tile: Fmt, steps: Fmt) => `🎯 ${name} → ${tile} (${steps} langkah)`,
  turnLabel: (name: Fmt, isBot: boolean) => `Giliran ${name}${isBot ? " 🤖" : ""}`,
  victims: (names: Fmt) => `Yang kena: ${names}`,
  victimsHtml: (names: Fmt) => `<p class="victim">Yang kena: <b>${names}</b></p>`,
  seasonEnd: (icon: Fmt, headline: Fmt) => `${icon} ${headline} sudah selesai. Pulau kembali normal.`,
  seasonFor: (rounds: Fmt, badge: Fmt) => `Berlaku ${rounds} ronde: ${badge}`,
  saveItem: "🎒 Simpan!",
  setCompleteLog: (name: Fmt, group: Fmt, bonus: Fmt) => `👑 SET LENGKAP! ${name} menguasai semua wilayah grup ${group} — sewanya +${bonus}%!`,
  setCompleteTitle: "👑 SET LENGKAP!",
  setCompleteBanner: (name: Fmt, group: Fmt, bonus: Fmt) => `${name} menguasai grup ${group} · sewa +${bonus}%`,
};

// ============================================================ menu pengaturan (ui/SettingsMenu.ts)
const settings = {
  openTitle: "Pengaturan (Esc)",
  sound: "Suara game",
  music: "Musik latar",
  sfx: "Efek suara",
  musicVol: "Volume musik",
  voice: "Voice chat",
  voiceHint: "Volume suara teman saat main online. Mic & volume per orang tetap di panel suara.",
  resume: "▶ Lanjutkan",
  dialogLabel: "Pengaturan",
  title: "⚙️ Pengaturan",
  escHint: "Tekan Esc untuk membuka/menutup menu ini",
  on: "NYALA",
  off: "MATI",
};

// ============================================================ panel suara (ui/VoicePanel.ts)
const voice = {
  titleJoined: (inVoice: Fmt) => `🔊 Suara · ${inVoice}`,
  titleIdle: (inVoice: Fmt) => `🎙️ Suara${inVoice ? ` · ${inVoice}` : ""}`,
  togglePanel: "Buka/tutup panel suara",
  micMissing: "Mikrofon tidak tersedia",
  micOn: "Nyalakan mikrofon",
  micOff: "Bisukan mikrofon",
  hearAgain: "Dengarkan lagi",
  deafen: "Tulikan (tidak dengar siapa pun)",
  notJoined: "belum gabung",
  connecting: "menyambung...",
  controlTitle: "Klik untuk atur suara pemain ini",
  youSuffix: " (kamu)",
  volumeOf: (name: Fmt) => `Volume ${name}`,
  unmute: "🔈 Bunyikan",
  muteForMe: "🚫 Bisukan untukku",
};

// ============================================================ panel QA, hanya untuk pengembang (ui/QaPanel.ts)
const qa = {
  randomCard: "(kartu acak)",
  randomEvent: "(event acak)",
  randomSeason: "(musim acak)",
  giveItem: "(beri kartu simpanan)",
  plusMoney: "+1000 pemain aktif",
  title: (seed: Fmt) => `🧪 QA — seed ${seed}`,
  dice: "Dadu:",
  queue: "Antrian:",
  card: "Kartu:",
  nextEvent: "Event giliran berikut:",
  nextSeason: "Musim giliran berikut:",
  pocket: "Kantong pemain aktif:",
  addDice: "Antri dadu",
};

// ============================================================ alur utama & online (main.ts)
const main = {
  reconnected: "🔌 Tersambung kembali! Lanjut main 🎉",
  findingMoney: (name: Fmt) => `💸 ${name} lagi cari uang...`,
  thinkingOffer: (name: Fmt) => `🤝 ${name} lagi mikirin tawaran...`,
  thinking: (name: Fmt) => `⏳ ${name} lagi mikir...`,
  offerQueued: "Tawaranmu sebelumnya masih antre, tunggu sebentar ya ⏳",
  offerSent: (name: Fmt) => `🤝 Tawaran ke ${name} terkirim! Diproses sebentar lagi.`,
  disconnected: (name: Fmt) => `${name} terputus — sekarang dimainkan bot 🤖`,
  backOnline: (name: Fmt) => `🔌 ${name} tersambung kembali!`,
  disconnectTitle: "📡 Koneksi terputus",
  rejoinHint: "<p>Tenang, kursimu dimainkan bot sementara. Tekan <b>Sambung ulang</b> untuk kembali ke permainan.</p>",
  toMenu: "Ke menu",
  backToMenu: "Kembali ke menu",
  fatal: (error: Fmt) => `<div class="panel" style="margin:20px;padding:20px">Terjadi error: ${error}</div>`,
};

// ============================================================ online: pesan galat koneksi (net/Room.ts, net/Voice.ts)
const net = {
  serverDown: "Server penghubung tidak merespons. Cek koneksi internet.",
  createFail: "Gagal membuat room. Coba lagi.",
  hostUnreachable: "Tidak bisa tersambung ke host. Mungkin jaringan memblokir koneksi P2P.",
  roomNotFound: (code: Fmt) => `Room ${code} tidak ditemukan. Cek kodenya ya!`,
  hostLost: "Koneksi ke host terputus 📡",
  hostLostShort: "Koneksi ke host terputus.",
  hostLostSad: "Koneksi ke host terputus 😢",
  versionMismatch: "Versi game berbeda. Muat ulang halaman (Ctrl+F5).",
  alreadyStarted: "Permainan di room ini sudah dimulai.",
  roomFull: "Room sudah penuh (maks 4).",
  kicked: "Kamu dikeluarkan dari room oleh host.",
  noMicSupport: "Browser tidak mendukung mikrofon.",
  needHttps: "Mikrofon butuh HTTPS (atau localhost).",
  micDenied: "Izin mikrofon ditolak — kamu hanya bisa mendengar.",
  micNotFound: "Mikrofon tidak ditemukan — kamu hanya bisa mendengar.",
  micError: (error: Fmt) => `${error} Kamu hanya bisa mendengar.`,
  defaultName: "Pemain",
};

// ============================================================ critters
const critters = {
  labels: ["Bang Kentang Kumis","Om Mata Satu","Cabai Ngamuk","Timun Kalem","Paus Biru","Kucing Garong"],
};

// ============================================================ scene3d
const scene3d = {
  brandTop: "MEMONOPOLI",
  brandSub: "WILAYAH WNI",
  itemHeader: "🎒 KARTU SIMPANAN",
  defaultPacket: "Paket Misterius",
  packetHeader: (header: Fmt) => `📦 ${header}`,
  seasonTag: "📅 EVENT MUSIMAN",
  newsTag: "📢 BERITA HEBOH",
  live: "LIVE",
  ticker: (headline: Fmt) => `WNI TV  •  ${headline}  •  JANGAN PANIK  •  `,
  rentLabel: (rent: Fmt) => `Sewa ${rent}`,
  partyBadge: (mult: Fmt) => `SEWA x${mult}`,
  partyCorner: (mult: Fmt) => `x${mult}`,
};

// ============================================================ common
const common = {
  cancel: "Batal",
  close: "Tutup",
};

// ============================================================ papan (data/board.ts)
const board = {
  tileNotFound: (name: Fmt) => `Petak tidak ada: ${name}`,
  groupNames: ["Permen","Jeruk","Lemon","Daun","Langit","Laut","Anggur","Ceri"],
};

// ============================================================ identitas aplikasi (judul tab & bahasa HTML)
const app = {
  title: "Memonopoli : Wilayah WNI",
  htmlLang: "id",
};


// ============================================================ cardSummary
const cardSummary = {
  gainDetail: "Uangmu bertambah",
  payDetail: "Bayar ke bank",
  repairDetail: (buildings: Fmt, perLevel: Fmt) => `${buildings} bangunan × ${perLevel}`,
  repairNone: "😌 Rp0",
  repairNoneDetail: "Belum punya bangunan, lolos!",
  shieldMain: "🛡️ Bebas sewa 1×",
  shieldDetail: "Maks pegang 1 · saat kena sewa, pilih mau dipakai atau tidak",
  shieldReplace: "Maks pegang 1 · kartu lamamu hangus, diganti yang ini",
  gotoMain: (dest: Fmt) => `✈️ Pindah ke ${dest}`,
  gotoDetail: "Dapat gaji Mulai",
  islandMain: "⛓️ Masuk Nusakambangan",
  islandDetail: "Terjebak beberapa giliran",
  collectDetail: (amount: Fmt, count: Fmt) => `${amount} × ${count} pemain lain`,
  payAllDetail: (amount: Fmt, count: Fmt) => `${amount} ke ${count} pemain lain`,
  stealNone: "🤷 Tidak ada yang bisa dipinjami",
  stealDetail: (name: Fmt) => `Diambil dari ${name}`,
  gachaMain: (min: Fmt, max: Fmt) => `🎲 ${min} s/d ${max}`,
  gachaDetail: "Untung atau rugi, diundi!",
  backMain: (steps: Fmt) => `⬅️ Mundur ${steps} petak`,
  forwardMain: (steps: Fmt) => `➡️ Maju ${steps} petak`,
  pushMain: (steps: Fmt) => `💨 Lawan mundur ${steps} petak`,
  pushDetail: "Uangmu aman",
  swapMain: "🔄 Tukar posisi",
  swapDetail: "Dengan pemain acak",
  randomTileMain: "🚁 Pindah ke petak acak",
  itemFullDetail: (name: Fmt) => `Kantong penuh, ${name} dijual ke tukang loak`,
  itemMain: (icon: Fmt, name: Fmt) => `🎒 Dapat ${icon} ${name}`,
  itemDetail: "Disimpan di kantong, pakai nanti",
};

// ============================================================ boardMap
const boardMap = {
  kindName: { start: "Petak Mulai", chance: "Kartu Paket", island: "Penjara", festival: "Festival", tour: "Pesawat", tax: "Pajak", resort: "Tempat Wisata" },
  title: "🗺️ Peta papan",
  hint: "Arahkan / ketuk petak atau daftar untuk melihat lokasinya",
  group: (name: Fmt) => `Grup ${name}`,
  groupLevel: (name: Fmt, level: Fmt) => `Grup ${name} · ${level}`,
  unowned: "Belum dimiliki",
  valueLine: (owned: boolean, value: Fmt) => ` · ${owned ? "nilai" : "harga"} ${value}`,
  party: "🎉 Sedang Pesta Pejabat",
};

export const Lang = {
  cards,
  chaos,
  items,
  seasons,
  tiles,
  game,
  rules,
  trade,
  money,
  menu,
  tradeUi,
  hud,
  human,
  scene,
  settings,
  voice,
  qa,
  main,
  net,
  critters,
  scene3d,
  common,
  board,
  app,

















  cardSummary,
  boardMap,
};

export type Lang = typeof Lang;

# Memonopoli : Wilayah WNI 🇮🇩

Board game 3D bergaya kartun (terinspirasi genre "Let's Get Rich" / party board game) dibuat dengan **Babylon.js + TypeScript + Vite**.
Semua karakter, nama, dan aset visual adalah original dan dibuat secara prosedural, tanpa file model eksternal.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit test + simulasi 50 game bot
npm run build      # typecheck + build produksi ke dist/
```

## Fitur QA

| Cara | Fungsi |
|---|---|
| `?qa=1` di URL | Panel QA: antrikan hasil dadu, paksa kartu, paksa Berita Heboh di giliran berikutnya, +1000 uang ke pemain aktif |
| `?seed=123` di URL / Seed di menu (Main Bareng di Sini → ⚙️ Opsi lanjutan) | Game deterministik (dadu & kartu sama setiap kali), untuk reproduksi bug |
| `window.__game` di DevTools | Akses state game (`__game.state`), `__game.forcedDice.push([6,6])` |
| `window.__view` di DevTools | Akses scene Babylon (kamera, mesh) |
| Seed tampil di console | `[Memonopoli] seed=...` setiap game dimulai |
| Klik petak mana saja | Info petak: harga, tabel sewa per level, pemilik |
| Tombol ⏩ | Kecepatan animasi 1x/2x/3x |
| Space / Enter | Lempar dadu |

Saat melaporkan bug, sertakan **seed**, urutan aksi, dan screenshot.

## Main Online (P2P)

Beranda → **Main Online** → **Buat Room** memberi kode 5 huruf (mis. `BHDVS`). Teman memasukkan kode itu di **Gabung Room**, atau membuka link `?room=KODE` (tombol 📋 Salin link).

- Koneksi langsung antar browser (WebRTC lewat [PeerJS](https://peerjs.com)). Server publik PeerJS hanya dipakai untuk "jabat tangan" awal; data game tidak lewat server.
- **Host** = pusat room: tamu tersambung ke host, host meneruskan pesan dan menjalankan bot. Host harus tetap membuka game sampai selesai.
- **Lockstep deterministik**: semua perangkat menjalankan game dengan seed yang sama; yang dikirim hanya keputusan (lempar dadu, beli, pilih petak, negosiasi). Karena itu panel QA (`?qa=1`) dimatikan saat online.
- **🤝 Nego kapan saja**: tombol di toolbar mengirim tawaran walau bukan giliranmu. Tawaran diantrekan lalu diproses di titik sinkron berikutnya (awal giliran, setelah tiap lemparan, akhir giliran, atau langsung menyela menu giliran pemain manusia). Urutannya ditentukan perangkat pemilik pemain yang sedang giliran, jadi semua peer tetap identik. Maks 3 tawaran per pemain per giliran.
- Tamu terputus di tengah game → kursinya diambil alih bot oleh host. Host terputus → room bubar.
- **Sambung ulang**: tamu yang terputus / me-refresh halaman bisa kembali ke kursinya lewat tombol **🔄 Sambung ulang** (di dialog putus koneksi atau di layar Main Online). Identitasnya pakai token acak di `localStorage` perangkat itu (bukan IP — browser tidak bisa membaca IP sendiri dan IP HP sering berganti). Host mengirim riwayat semua keputusan; perangkat tamu memutar ulang game tanpa animasi, lalu bot berhenti dan kursi kembali dimainkan tamu.
- Tab yang disembunyikan menjeda animasinya sendiri; saat dibuka lagi game mengejar ketertinggalan, tidak ada langkah yang hilang.
- Tanpa server TURN, sebagian jaringan (NAT ketat, beberapa operator seluler / Wi-Fi kantor) bisa gagal tersambung.
- QA: `window.__room` di DevTools; `[Memonopoli] seed=... room=...` di console.

## Aturan singkat

- Mulai dengan Rp500 jt. Lewat **Mulai** +Rp350 jt. Urutan jalan diundi: pemain pertama dipilih acak.
- **Urutan ular** 🐍 (3–4 pemain): supaya pemain yang jalan lebih dulu tidak selalu dapat tanah terbaik, ronde genap berjalan terbalik (mis. 1-2-3-4, lalu 4-3-2-1, lalu 1-2-3-4). Pemain di batas ronde main dua kali berturut-turut. Ular berakhir di batas ronde begitu ada pemain yang melewati **Mulai**, lalu urutan kembali normal.
- Mendarat di tanah kosong → beli & langsung bangun hingga **Vila**. Di **putaran pertama** (sebelum pertama kali lewat Mulai) hanya boleh beli tanah. **Landmark** dibangun saat mendarat lagi di Vila sendiri.
- Mendarat di properti lawan → bayar **sewa** = 65% nilai wilayah (total biaya tanah + bangunan yang sudah dikeluarkan). Punya **satu grup warna lengkap** → sewa semua wilayah di grup itu **+30%**. Properti lawan hanya bisa pindah tangan lewat **negosiasi** atau **Pasar Terbuka** (tidak ada akuisisi paksa).
- **Tempat wisata** 🌴: sewa berlipat untuk setiap wisata milik pemilik yang sama.
- **Dadu kembar** = lempar lagi; kembar 3x = dijebloskan ke **Nusakambangan** (3 giliran / sogok sipir Rp50 jt / dadu kembar).
- **Pesta Pejabat** 🥂: sewa satu propertimu x2. Event musiman **Musim Turis** (semua sewa x2) baru bisa muncul setelah 75% game berjalan, yaitu mulai ronde 47 dari 62. **Naik Pesawat Negara** ✈️: giliran berikutnya terbang ke petak mana saja.
- **Paket Shopee / Tokopedia / Blibli / Lazada** 📦: 34 kartu konyol (kentut nuklir, nebeng heli pejabat, tukar jiwa, mesin capit, dll).
- **Berita Heboh** 📢: di awal ronde baru (peluang 45%) muncul event sepulau — heli pejabat salah jemput, gempa kentut, maling budiman, bansos, dll.
- Uang kurang → **turunkan bangunan** (mis. Vila → Rumah 1; wilayah tetap milikmu, dapat 50% harga bangunan yang dibongkar), pilih sendiri wilayah yang dijual ke bank (50%), atau **nego jual** ke pemain lain (maks 3x). Masih kurang / menyerah → **bangkrut**.
- **Menang**: lawan bangkrut semua · monopoli 3 grup warna · kuasai 1 sisi papan · kuasai 4 wisata **dan** 1 grup warna lengkap · terkaya di ronde 62.

## Struktur

```
src/
  core/      # logic murni (tanpa 3D) — bisa dites di Node
    types.ts, rules.ts, game.ts (turn state machine), bot.ts (AI), rng.ts, interfaces.ts
  data/      # definisi papan & kartu (angka & efek; teksnya dari lang/)
  lang/      # SEMUA teks untuk pemain (id.ts): pesan, label UI, kartu, nama petak

  scene/     # Babylon.js: GameScene, BoardView, Pawn, Dice, Effects, toon material, tween, sfx
  ui/        # HTML overlay: Menu, Hud, HumanDecider, ScenePresenter, QaPanel
  net/       # online P2P: Room (PeerJS, room code, lobi), NetDecider (kirim/terima keputusan)
tests/       # vitest
```

Logic (`core/`) tidak tahu apa pun soal 3D: ia berbicara lewat interface `Decider` (keputusan manusia/bot) dan `Presenter` (animasi). Karena itu seluruh aturan bisa dites tanpa browser.

## Teks / bahasa

Semua teks yang tampil ke pemain ada di satu file: [`src/lang/id.ts`](src/lang/id.ts), diekspor sebagai `Lang` dan dikelompokkan per bagian (`Lang.game`, `Lang.menu`, `Lang.hud`, `Lang.cards`, `Lang.tiles`, ...). Kode tidak menulis teks langsung. Teks yang butuh data berbentuk fungsi, mis. `Lang.game.bayarSewa(pemain, sewa, pemilik)`; nilai uang diformat oleh pemanggil (`rp()`), format Rupiah-nya sendiri ada di `Lang.money`. Untuk menambah bahasa, salin `id.ts` menjadi file baru dengan bentuk yang sama (tipe `Lang`) lalu ganti impor `Lang`.

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
- **Lockstep deterministik**: semua perangkat menjalankan game dengan seed yang sama; yang dikirim hanya keputusan (lempar dadu, beli, akuisisi, pilih petak). Karena itu panel QA (`?qa=1`) dimatikan saat online.
- Tamu terputus di tengah game → kursinya diambil alih bot oleh host. Host terputus → room bubar.
- Tab yang disembunyikan menjeda animasinya sendiri; saat dibuka lagi game mengejar ketertinggalan, tidak ada langkah yang hilang.
- Tanpa server TURN, sebagian jaringan (NAT ketat, beberapa operator seluler / Wi-Fi kantor) bisa gagal tersambung.
- QA: `window.__room` di DevTools; `[Memonopoli] seed=... room=...` di console.

## Aturan singkat

- Mulai dengan 🪙1.500. Lewat **Mulai** +200.
- Mendarat di tanah kosong → beli & langsung bangun hingga **Vila**. **Landmark** dibangun saat mendarat lagi di Vila sendiri.
- Mendarat di properti lawan → bayar **sewa**, lalu boleh **akuisisi** (2x nilai investasi). Landmark tidak bisa diakuisisi.
- **Tempat wisata** 🌴: sewa berlipat untuk setiap wisata milik pemilik yang sama.
- **Dadu kembar** = lempar lagi; kembar 3x = dijebloskan ke **Nusakambangan** (3 giliran / sogok sipir Rp100 jt / dadu kembar).
- **Pesta Pejabat** 🥂: sewa satu propertimu x2. **Naik Pesawat Negara** ✈️: giliran berikutnya terbang ke petak mana saja.
- **Paket Shopee / Tokopedia / Blibli / Lazada** 📦: 34 kartu konyol (kentut nuklir, nebeng heli pejabat, tukar jiwa, mesin capit, dll).
- **Berita Heboh** 📢: di awal ronde baru (peluang 45%) muncul event sepulau — heli pejabat salah jemput, gempa kentut, maling budiman, bansos, dll.
- Uang kurang → properti dijual otomatis (50%) → kalau masih kurang, **bangkrut**.
- **Menang**: lawan bangkrut semua · monopoli 3 grup warna · kuasai 1 sisi papan · kuasai 4 wisata · terkaya di ronde 30.

## Struktur

```
src/
  core/      # logic murni (tanpa 3D) — bisa dites di Node
    types.ts, rules.ts, game.ts (turn state machine), bot.ts (AI), rng.ts, interfaces.ts
  data/      # definisi papan & kartu
  scene/     # Babylon.js: GameScene, BoardView, Pawn, Dice, Effects, toon material, tween, sfx
  ui/        # HTML overlay: Menu, Hud, HumanDecider, ScenePresenter, QaPanel
  net/       # online P2P: Room (PeerJS, room code, lobi), NetDecider (kirim/terima keputusan)
tests/       # vitest
```

Logic (`core/`) tidak tahu apa pun soal 3D: ia berbicara lewat interface `Decider` (keputusan manusia/bot) dan `Presenter` (animasi). Karena itu seluruh aturan bisa dites tanpa browser.

# Pulau Kaya 🏝️🪙

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
| `?seed=123` di URL / kolom Seed di menu | Game deterministik (dadu & kartu sama setiap kali), untuk reproduksi bug |
| `window.__game` di DevTools | Akses state game (`__game.state`), `__game.forcedDice.push([6,6])` |
| `window.__view` di DevTools | Akses scene Babylon (kamera, mesh) |
| Seed tampil di console | `[Pulau Kaya] seed=...` setiap game dimulai |
| Klik petak mana saja | Info petak: harga, tabel sewa per level, pemilik |
| Tombol ⏩ | Kecepatan animasi 1x/2x/3x |
| Space / Enter | Lempar dadu |

Saat melaporkan bug, sertakan **seed**, urutan aksi, dan screenshot.

## Aturan singkat

- Mulai dengan 🪙1.500. Lewat **Mulai** +200.
- Mendarat di tanah kosong → beli & langsung bangun hingga **Vila**. **Landmark** dibangun saat mendarat lagi di Vila sendiri.
- Mendarat di properti lawan → bayar **sewa**, lalu boleh **akuisisi** (2x nilai investasi). Landmark tidak bisa diakuisisi.
- **Tempat wisata** 🌴: sewa berlipat untuk setiap wisata milik pemilik yang sama.
- **Dadu kembar** = lempar lagi; kembar 3x = terdampar di **Pulau Jomblo** (3 giliran / sewa perahu bebek 100 / dadu kembar).
- **Pesta Dangdut** 🎤: sewa satu propertimu x2. **Naik UFO** 🛸: giliran berikutnya dijatuhkan ke petak mana saja.
- **Kardus Misterius** 📦: 22 kartu konyol (kentut nuklir, diculik alien, tukar jiwa, mesin capit, dll).
- **Berita Heboh** 📢: di awal ronde baru (peluang 45%) muncul event sepulau — UFO nyasar, gempa kentut, maling budiman, bansos, dll.
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
tests/       # vitest
```

Logic (`core/`) tidak tahu apa pun soal 3D: ia berbicara lewat interface `Decider` (keputusan manusia/bot) dan `Presenter` (animasi). Karena itu seluruh aturan bisa dites tanpa browser.

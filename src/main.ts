import "./ui/style.css";
import { BotDecider } from "./core/bot";
import { Game } from "./core/game";
import { NullPresenter, type Decider } from "./core/interfaces";
import { interruptibleDeals, isInterjection, type Interjection } from "./core/interject";
import { BroadcastDecider, RemoteDecider } from "./net/NetDecider";
import { GameScene } from "./scene/GameScene";
import { music } from "./scene/music";
import { Speed } from "./scene/tween";
import { modal } from "./ui/dom";
import { HumanDecider } from "./ui/HumanDecider";
import { Hud } from "./ui/Hud";
import { showMenu } from "./ui/Menu";
import { mountQaPanel } from "./ui/QaPanel";
import { ScenePresenter } from "./ui/ScenePresenter";
import { editOffer, pickTradeTarget } from "./ui/TradeUi";

async function boot() {
  music.init();
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const view = new GameScene(canvas);
  Object.assign(window as object, { __view: view });
  // Kamera berputar sangat pelan di menu (berbasis waktu, bukan per frame, supaya
  // tidak makin cepat di layar 120/144 Hz). Satu putaran ≈ 5 menit.
  // Diam total bila sistem meminta "kurangi gerakan".
  const MENU_SPIN_RAD_PER_SEC = (Math.PI * 2) / 300;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const spin = view.scene.onBeforeRenderObservable.add(() => {
    if (reduceMotion) return;
    const dt = Math.min(view.engine.getDeltaTime(), 100) / 1000;
    view.camera.alpha += MENU_SPIN_RAD_PER_SEC * dt;
  });

  await document.fonts?.ready;
  const setup = await showMenu();
  view.scene.onBeforeRenderObservable.remove(spin);
  const online = setup.online;

  // Game dibuat dulu, lalu presenter & deciders dipasang (keduanya butuh referensi state)
  const game = new Game(setup.players, [], new NullPresenter(), { seed: setup.seed });

  // Online: kursi yang dikendalikan manusia di perangkat ini
  const localHumans = online
    ? online.seats.flatMap((s, i) => (s.id === online.room.me && s.kind !== "bot" ? [i] : []))
    : game.state.players.flatMap((p) => (p.isBot ? [] : [p.id]));

  const hud = new Hud(game.state, setup.characters, online ? localHumans : null);
  game.presenter = new ScenePresenter(view, hud, game.state, (pid) => localHumans.includes(pid));

  hud.screenPosOfPlayer = (pid) => view.worldToScreen(view.pawns[pid].worldTop());
  hud.onResetCamera = () => void view.goHome();
  view.onTileClick = (i) => void hud.showTileInfo(i);

  const human = new HumanDecider(game.state, hud, view, online ? localHumans : null);
  // Bot berpikir lebih cepat jika kecepatan dinaikkan
  const bot = new BotDecider(game.state, () => 450 / Speed.factor);

  if (!online) {
    game.deciders = game.state.players.map((p): Decider => (p.isBot ? bot : human));
  } else {
    // Lockstep: setiap peer menjalankan Game yang sama (seed sama); hanya keputusan yang dikirim.
    // Pemilik keputusan: manusia = perangkatnya sendiri, bot = host.
    const { room, seats, voice, voicePanel } = online;
    voicePanel.onSpeaking = (id, on) => seats.forEach((s, pid) => s.id === id && s.kind !== "bot" && hud.setSpeaking(pid, on));
    const remotes: (RemoteDecider | null)[] = [];
    const broadcastBot = (pid: number) => new BroadcastDecider(bot, (k, v) => room.sendAct(pid, k, v));
    const pool = game.pool;
    // Menu awal giliran manusia di perangkat ini bisa disela tawaran kapan saja dari pemain lain
    const humanHere = interruptibleDeals(human, pool);
    game.deciders = seats.map((s, pid): Decider => {
      const ownedHere = s.kind === "bot" ? room.isHost : s.id === room.me;
      if (ownedHere) {
        remotes.push(null);
        return new BroadcastDecider(s.kind === "bot" ? bot : humanHere, (k, v) => room.sendAct(pid, k, v));
      }
      const r = new RemoteDecider((waiting, kind) => {
        if (kind === "roll" || kind === "deal" || kind === "sync") return; // label "Giliran X" sudah tampil
        if (kind === "debt") {
          hud.setTurnLabel(waiting ? `💸 ${game.state.players[pid].name} lagi cari uang...` : null);
          return;
        }
        const name = game.state.players[pid].name;
        if (kind === "trade") {
          const cur = game.state.players[game.state.current];
          hud.setTurnLabel(waiting ? `🤝 ${name} lagi mikirin tawaran...` : `Giliran ${cur.name}${cur.isBot ? " 🤖" : ""}`);
          return;
        }
        hud.setTurnLabel(waiting ? `⏳ ${name} lagi mikir...` : null);
      });
      remotes.push(r);
      return r;
    });
    // Checkpoint aksi kapan saja: pemilik kursi pemain giliran yang menentukan isinya, lalu menyiarkannya
    const decideHere = async (cur: number) => {
      const list = pool.drain();
      room.sendAct(cur, "sync", list);
      return list;
    };
    game.syncInterjections = async (cur) => {
      const r = remotes[cur];
      if (!r) return decideHere(cur);
      const list = await r.sync(() => decideHere(cur));
      pool.markApplied(list);
      return list;
    };
    room.onAct = (pid, k, v) => {
      if (k === "offer") {
        if (isInterjection(v, pid)) pool.add(v);
        return;
      }
      remotes[pid]?.push(k, v);
    };

    // Tombol 🤝 Nego kapan saja (bukan hanya saat giliran sendiri)
    const me = localHumans[0];
    let sent = 0;
    if (me !== undefined) {
      hud.enableAnytimeTrade(async () => {
        const st = game.state;
        if (st.winner !== null || st.players[me].bankrupt) return;
        if (pool.has(me)) {
          hud.toast("Tawaranmu sebelumnya masih antre, tunggu sebentar ya ⏳");
          return;
        }
        const target = await pickTradeTarget(st, me);
        if (target === null) return;
        const offer = await editOffer(st, { from: me, to: target, giveTiles: [], giveMoney: 0, takeTiles: [], takeMoney: 0 }, `🤝 Tawaran ke ${st.players[target].name}`);
        if (!offer || st.winner !== null) return;
        const it: Interjection = { id: `${room.me}:${++sent}`, player: me, act: { type: "trade", offer } };
        pool.add(it);
        room.sendAct(me, "offer", it);
        hud.toast(`🤝 Tawaran ke ${st.players[target].name} terkirim! Diproses sebentar lagi.`, "good");
      });
    }
    room.onPlayerLeft = (pid) => {
      const p = game.state.players[pid];
      p.isBot = true;
      hud.refreshName(pid);
      game.presenter.message(`${p.name} terputus — sekarang dimainkan bot 🤖`, "bad");
      if (room.isHost) remotes[pid]?.takeover(broadcastBot(pid));
    };
    room.onClosed = (reason) => {
      game.stop();
      voice.destroy();
      voicePanel.destroy();
      void modal({
        title: "📡 Koneksi terputus",
        body: `<p>${reason}</p>`,
        buttons: [{ label: "Kembali ke menu", value: 0, class: "green" }],
      }).then(() => location.reload());
    };
    window.addEventListener("beforeunload", () => {
      voice.leave();
      room.leave();
    });
  }

  // Akses dari DevTools untuk QA
  Object.assign(window as object, { __game: game, __view: view, __room: online?.room, __voice: online?.voice });
  view.setupPlayers(game.state, setup.characters);
  await view.goHome(1);

  const params = new URLSearchParams(location.search);
  // Panel QA memaksa dadu/kartu → bikin game online tidak sinkron, jadi hanya untuk main lokal
  if (params.has("qa") && !online) mountQaPanel(game, hud);
  console.info(`[Memonopoli] seed=${game.seed}${online ? ` room=${online.room.code}` : " — tambahkan ?qa=1 di URL untuk panel QA"}`);

  await game.run();
  online?.room.leave();
  location.href = location.pathname;
}

boot().catch((e) => {
  console.error(e);
  document.getElementById("ui")!.innerHTML = `<div class="panel" style="margin:20px;padding:20px">Terjadi error: ${String(e)}</div>`;
});

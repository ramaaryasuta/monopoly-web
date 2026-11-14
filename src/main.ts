import "./ui/style.css";
import { BotDecider } from "./core/bot";
import { Game } from "./core/game";
import { NullPresenter, type Decider } from "./core/interfaces";
import { BroadcastDecider, RemoteDecider } from "./net/NetDecider";
import { GameScene } from "./scene/GameScene";
import { Speed } from "./scene/tween";
import { modal } from "./ui/dom";
import { HumanDecider } from "./ui/HumanDecider";
import { Hud } from "./ui/Hud";
import { showMenu } from "./ui/Menu";
import { mountQaPanel } from "./ui/QaPanel";
import { ScenePresenter } from "./ui/ScenePresenter";

async function boot() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const view = new GameScene(canvas);
  // Kamera berputar pelan di menu
  const spin = view.scene.onBeforeRenderObservable.add(() => (view.camera.alpha += 0.0015));

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

  const human = new HumanDecider(game.state, hud, view);
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
    game.deciders = seats.map((s, pid): Decider => {
      const ownedHere = s.kind === "bot" ? room.isHost : s.id === room.me;
      if (ownedHere) {
        remotes.push(null);
        return new BroadcastDecider(s.kind === "bot" ? bot : human, (k, v) => room.sendAct(pid, k, v));
      }
      const r = new RemoteDecider((waiting, kind) => {
        if (kind === "roll") return; // label "Giliran X" sudah tampil
        hud.setTurnLabel(waiting ? `⏳ ${game.state.players[pid].name} lagi mikir...` : null);
      });
      remotes.push(r);
      return r;
    });
    room.onAct = (pid, k, v) => remotes[pid]?.push(k, v);
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
  console.info(`[Pulau Kaya] seed=${game.seed}${online ? ` room=${online.room.code}` : " — tambahkan ?qa=1 di URL untuk panel QA"}`);

  await game.run();
  online?.room.leave();
  location.href = location.pathname;
}

boot().catch((e) => {
  console.error(e);
  document.getElementById("ui")!.innerHTML = `<div class="panel" style="margin:20px;padding:20px">Terjadi error: ${String(e)}</div>`;
});

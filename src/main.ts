import "./ui/style.css";
import { BotDecider } from "./core/bot";
import { Game } from "./core/game";
import { NullPresenter, type Decider } from "./core/interfaces";
import { GameScene } from "./scene/GameScene";
import { Speed } from "./scene/tween";
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

  // Game dibuat dulu, lalu presenter & deciders dipasang (keduanya butuh referensi state)
  const game = new Game(setup.players, [], new NullPresenter(), { seed: setup.seed });
  const hud = new Hud(game.state, setup.characters);
  game.presenter = new ScenePresenter(view, hud, game.state);

  hud.screenPosOfPlayer = (pid) => view.worldToScreen(view.pawns[pid].worldTop());
  hud.onResetCamera = () => void view.goHome();
  view.onTileClick = (i) => void hud.showTileInfo(i);

  const human = new HumanDecider(game.state, hud, view);
  // Bot berpikir lebih cepat jika kecepatan dinaikkan
  const bot = new BotDecider(game.state, () => 450 / Speed.factor);
  game.deciders = game.state.players.map((p): Decider => (p.isBot ? bot : human));

  // Akses dari DevTools untuk QA
  Object.assign(window as object, { __game: game, __view: view });
  view.setupPlayers(game.state, setup.characters);
  await view.goHome(1);

  const params = new URLSearchParams(location.search);
  if (params.has("qa")) mountQaPanel(game, hud);
  console.info(`[Pulau Kaya] seed=${game.seed} — tambahkan ?qa=1 di URL untuk panel QA`);

  await game.run();
  location.reload();
}

boot().catch((e) => {
  console.error(e);
  document.getElementById("ui")!.innerHTML = `<div class="panel" style="margin:20px;padding:20px">Terjadi error: ${String(e)}</div>`;
});

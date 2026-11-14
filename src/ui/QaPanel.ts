import type { Game } from "../core/game";
import { CARDS } from "../data/cards";
import { h, uiRoot } from "./dom";
import type { Hud } from "./Hud";

/** Panel QA (aktif dengan ?qa=1): paksa dadu, paksa kartu, tambah uang, lihat seed. */
export function mountQaPanel(game: Game, hud: Hud) {
  const d1 = h("input", { type: "number", min: 1, max: 6, value: 1, "data-testid": "qa-d1" });
  const d2 = h("input", { type: "number", min: 1, max: 6, value: 2, "data-testid": "qa-d2" });
  const queueLabel = h("span", {});
  const refreshQueue = () => (queueLabel.textContent = game.forcedDice.map((d) => d.join("+")).join(", ") || "-");
  const addDice = h("button", { class: "btn small" }, "Antri dadu");
  addDice.addEventListener("click", () => {
    const a = Math.min(6, Math.max(1, Number(d1.value)));
    const b = Math.min(6, Math.max(1, Number(d2.value)));
    game.forcedDice.push([a, b]);
    refreshQueue();
  });

  const card = h("select", { "data-testid": "qa-card" }, h("option", { value: "" }, "(kartu acak)"));
  for (const c of CARDS) card.append(h("option", { value: c.id }, `${c.icon} ${c.title}`));
  card.addEventListener("change", () => (game.forcedCard = card.value || null));

  const money = h("button", { class: "btn small" }, "+1000 pemain aktif");
  money.addEventListener("click", () => {
    const p = game.state.players[game.state.current];
    p.money += 1000;
    hud.animateMoney(p.id);
    hud.refresh();
  });

  const panel = h(
    "div",
    { class: "qa panel" },
    h("h4", {}, `🧪 QA — seed ${game.seed}`),
    h("div", { class: "row" }, "Dadu:", d1, d2, addDice),
    h("div", { class: "row" }, "Antrian:", queueLabel),
    h("div", { class: "row" }, "Kartu:", card),
    h("div", { class: "row" }, money),
  );
  uiRoot().append(panel);
  setInterval(refreshQueue, 500);
}

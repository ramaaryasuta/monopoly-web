import type { Game } from "../core/game";
import { CARDS, CHAOS_EVENTS, ITEMS, MAX_ITEMS, SEASON_IDS, SEASONS, type ItemId, type SeasonId } from "../data/cards";
import { h, uiRoot } from "./dom";
import type { Hud } from "./Hud";
import { Lang } from "../lang/id";

/** Panel QA (aktif dengan ?qa=1): paksa dadu, paksa kartu, tambah uang, lihat seed. */
export function mountQaPanel(game: Game, hud: Hud) {
  const d1 = h("input", { type: "number", min: 1, max: 6, value: 1, "data-testid": "qa-d1" });
  const d2 = h("input", { type: "number", min: 1, max: 6, value: 2, "data-testid": "qa-d2" });
  const queueLabel = h("span", {});
  const refreshQueue = () => (queueLabel.textContent = game.forcedDice.map((d) => d.join("+")).join(", ") || "-");
  const addDice = h("button", { class: "btn small" }, Lang.qa.addDice);
  addDice.addEventListener("click", () => {
    const a = Math.min(6, Math.max(1, Number(d1.value)));
    const b = Math.min(6, Math.max(1, Number(d2.value)));
    game.forcedDice.push([a, b]);
    refreshQueue();
  });

  const card = h("select", { "data-testid": "qa-card" }, h("option", { value: "" }, Lang.qa.randomCard));
  for (const c of CARDS) card.append(h("option", { value: c.id }, `${c.icon} ${c.title}`));
  card.addEventListener("change", () => (game.forcedCard = card.value || null));

  const chaos = h("select", { "data-testid": "qa-chaos" }, h("option", { value: "" }, Lang.qa.randomEvent));
  for (const c of CHAOS_EVENTS) chaos.append(h("option", { value: c.id }, `${c.icon} ${c.headline}`));
  chaos.addEventListener("change", () => {
    game.forcedChaos = chaos.value || null;
    chaos.value = "";
  });

  const season = h("select", { "data-testid": "qa-season" }, h("option", { value: "" }, Lang.qa.randomSeason));
  for (const id of SEASON_IDS) season.append(h("option", { value: id }, `${SEASONS[id].icon} ${SEASONS[id].headline}`));
  season.addEventListener("change", () => {
    game.forcedSeason = (season.value || null) as SeasonId | null;
    season.value = "";
  });

  const item = h("select", { "data-testid": "qa-item" }, h("option", { value: "" }, Lang.qa.giveItem));
  for (const it of Object.values(ITEMS)) item.append(h("option", { value: it.id }, `${it.icon} ${it.name}`));
  item.addEventListener("change", () => {
    const p = game.state.players[game.state.current];
    if (item.value && p.items.length < MAX_ITEMS) p.items.push(item.value as ItemId);
    item.value = "";
    hud.refresh();
  });

  const money = h("button", { class: "btn small" }, Lang.qa.plusMoney);
  money.addEventListener("click", () => {
    const p = game.state.players[game.state.current];
    p.money += 1000;
    hud.animateMoney(p.id);
    hud.refresh();
  });

  const panel = h(
    "div",
    { class: "qa panel" },
    h("h4", {}, Lang.qa.title(game.seed)),
    h("div", { class: "row" }, Lang.qa.dice, d1, d2, addDice),
    h("div", { class: "row" }, Lang.qa.queue, queueLabel),
    h("div", { class: "row" }, Lang.qa.card, card),
    h("div", { class: "row" }, Lang.qa.nextEvent, chaos),
    h("div", { class: "row" }, Lang.qa.nextSeason, season),
    h("div", { class: "row" }, Lang.qa.pocket, item),
    h("div", { class: "row" }, money),
  );
  uiRoot().append(panel);
  setInterval(refreshQueue, 500);
}

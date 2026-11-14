import { CONFIG } from "../core/rules";
import type { PlayerSetup } from "../core/types";
import { CRITTERS } from "../scene/Pawn";
import { sfx } from "../scene/sfx";
import { Speed } from "../scene/tween";
import { h, uiRoot } from "./dom";
import { AVATARS } from "./Hud";

export interface MenuResult {
  players: PlayerSetup[];
  characters: number[];
  seed?: number;
}

type SlotType = "human" | "bot" | "off";

/** Layar menu: atur pemain (manusia/bot), karakter, kecepatan. */
export function showMenu(): Promise<MenuResult> {
  return new Promise((resolve) => {
    const slots: { type: SlotType; name: string; char: number }[] = [
      { type: "human", name: "Kamu", char: 0 },
      { type: "bot", name: "Om Mata", char: 1 },
      { type: "bot", name: "Jago", char: 2 },
      { type: "bot", name: "Burger", char: 3 },
    ];

    const grid = h("div", { class: "slots" });
    const startBtn = h("button", { class: "btn green", style: "font-size:26px;padding:12px 40px", "data-testid": "start" }, "▶ Mulai Main!");
    const err = h("div", { style: "color:#c02646;font-weight:700;min-height:22px" });

    const render = () => {
      grid.innerHTML = "";
      slots.forEach((s, i) => {
        const avatar = h("div", { class: "avatar", style: `background:${CRITTERS[s.char].color}`, title: "Klik untuk ganti karakter" }, AVATARS[s.char]);
        avatar.addEventListener("click", () => {
          sfx.click();
          // Ganti ke karakter yang belum dipakai slot lain
          for (let k = 1; k <= 4; k++) {
            const next = (s.char + k) % 4;
            if (!slots.some((o, j) => j !== i && o.type !== "off" && o.char === next)) {
              s.char = next;
              break;
            }
          }
          render();
        });
        const name = h("input", { value: s.name, maxlength: 12, "data-testid": `name-${i}` });
        name.addEventListener("input", () => (s.name = name.value));
        const type = h("select", { "data-testid": `type-${i}` });
        for (const [v, l] of [
          ["human", "👤 Manusia"],
          ["bot", "🤖 Bot"],
          ["off", "— Kosong —"],
        ] as const) {
          const o = h("option", { value: v }, l);
          if (s.type === v) o.selected = true;
          type.append(o);
        }
        type.addEventListener("change", () => {
          s.type = type.value as SlotType;
          render();
        });
        grid.append(
          h(
            "div",
            { class: `slot${s.type === "off" ? " off" : ""}` },
            avatar,
            h("small", {}, CRITTERS[s.char].label),
            name,
            type,
          ),
        );
      });
    };
    render();

    const speed = h("select", {});
    for (const v of [1, 2, 3]) {
      const o = h("option", { value: v }, `${v}x`);
      if (Speed.factor === v) o.selected = true;
      speed.append(o);
    }
    speed.addEventListener("change", () => (Speed.factor = Number(speed.value)));
    const seed = h("input", { placeholder: "acak", size: 8, "data-testid": "seed" });
    const urlSeed = new URLSearchParams(location.search).get("seed");
    if (urlSeed) seed.value = urlSeed;

    const rules = h("details", { class: "rules" });
    rules.innerHTML = `<summary>📖 Cara Bermain</summary>
      <ul>
        <li>Lempar dadu, jalan, lalu <b>beli</b> tanah & bangun rumah → vila → <b>landmark</b>.</li>
        <li>Mendarat di properti lawan? Bayar <b>sewa</b>, lalu boleh <b>akuisisi</b> (harga 2x investasi). Landmark tidak bisa diakuisisi.</li>
        <li>Dadu kembar = lempar lagi. Kembar 3x = terdampar di Pulau Jomblo.</li>
        <li>Awas <b>Berita Heboh</b>: UFO nyasar, gempa kentut, maling budiman bisa muncul kapan saja!</li>
        <li>Lewat Mulai: +${CONFIG.salary}. Pesta Dangdut: sewa x${CONFIG.festivalMultiplier}. Naik UFO: dijatuhkan ke mana saja.</li>
        <li><b>Menang</b> jika: semua lawan bangkrut, monopoli 3 grup warna, kuasai satu sisi papan, kuasai semua wisata, atau terkaya di ronde ${CONFIG.roundLimit}.</li>
      </ul>`;

    const panel = h(
      "div",
      { class: "panel" },
      h("div", { class: "logo" }, "PULAU KAYA"),
      h("div", { class: "tagline" }, "Lempar dadu, beli kos bocor, kentutin lawan, jadi sultan! 💨🪙"),
      grid,
      h(
        "div",
        { class: "menu-row" },
        h("label", {}, "⏩ Kecepatan", speed),
        h("label", {}, "🎲 Seed", seed),
      ),
      err,
      startBtn,
      rules,
    );
    const menu = h("div", { class: "menu" }, panel);
    uiRoot().append(menu);

    startBtn.addEventListener("click", () => {
      const active = slots.filter((s) => s.type !== "off");
      if (active.length < 2) {
        err.textContent = "Minimal 2 pemain ya!";
        sfx.bad();
        return;
      }
      sfx.build();
      menu.remove();
      const players = active.map((s) => ({
        name: s.name.trim() || CRITTERS[s.char].label.split(" ").slice(-1)[0],
        color: CRITTERS[s.char].color,
        isBot: s.type === "bot",
      }));
      const seedNum = seed.value.trim() ? Number(seed.value) : undefined;
      resolve({ players, characters: active.map((s) => s.char), seed: Number.isFinite(seedNum) ? seedNum : undefined });
    });
  });
}

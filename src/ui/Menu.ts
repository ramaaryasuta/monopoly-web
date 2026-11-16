import { CONFIG } from "../core/rules";
import { rp } from "../core/money";
import { clearSession, CODE_LEN, loadSession, MAX_SEATS, normalizeCode, Room, type Seat } from "../net/Room";
import { Voice } from "../net/Voice";
import type { PlayerSetup } from "../core/types";
import { CRITTERS } from "../scene/Pawn";
import { sfx } from "../scene/sfx";
import { Speed } from "../scene/tween";
import { settingsButton } from "./SettingsMenu";
import { h, uiRoot } from "./dom";
import { AVATARS } from "./Hud";
import { VoicePanel } from "./VoicePanel";
import { Lang } from "../lang/id";

export interface MenuResult {
  players: PlayerSetup[];
  characters: number[];
  seed?: number;
  /** Ada bila permainan online. */
  online?: { room: Room; seats: Seat[]; voice: Voice; voicePanel: VoicePanel };
}

type SlotType = "human" | "bot" | "off";
interface Slot {
  type: SlotType;
  name: string;
  char: number;
}

const STORE_KEY = "pulauKaya.menu";
const CHAR_BLURB = Lang.menu.charBlurb;


/** Nama bawaan per karakter (bukan per slot). */
const DEFAULT_NAMES = Lang.menu.defaultNames;

/** Nama bawaan karakter lama → nama barunya (untuk data tersimpan). */
const RENAMED: Record<string, string> = { Jago: DEFAULT_NAMES[2], Burger: DEFAULT_NAMES[3] };

const DEFAULT_SLOTS: Slot[] = [
  { type: "human", name: Lang.menu.you, char: 0 },
  { type: "bot", name: DEFAULT_NAMES[1], char: 1 },
  { type: "bot", name: DEFAULT_NAMES[2], char: 2 },
  { type: "bot", name: DEFAULT_NAMES[3], char: 3 },
];

function loadSaved(): { slots: Slot[]; speed: number } {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as { slots?: Slot[]; speed?: number };
      if (Array.isArray(d.slots) && d.slots.length === 4) {
        const slots = d.slots.map((s, i) => ({
          type: (["human", "bot", "off"] as const).includes(s.type) ? s.type : DEFAULT_SLOTS[i].type,
          name: typeof s.name === "string" ? (RENAMED[s.name] ?? s.name).slice(0, 12) : DEFAULT_SLOTS[i].name,
          char: Number.isInteger(s.char) && s.char >= 0 && s.char < CRITTERS.length ? s.char : i,
        }));
        // Karakter harus unik; kalau data lama bentrok, pakai default
        if (new Set(slots.map((s) => s.char)).size === 4) return { slots, speed: d.speed ?? 1 };
      }
    }
  } catch {
    /* penyimpanan tidak tersedia: pakai default */
  }
  return { slots: structuredClone(DEFAULT_SLOTS), speed: 1 };
}

function save(slots: Slot[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ slots, speed: Speed.factor }));
  } catch {
    /* abaikan */
  }
}

/**
 * Menu bertingkat: Beranda → Lobi (main di satu perangkat) / Online (room P2P) / Cara Main.
 * Resolve ketika permainan (lokal atau online) dimulai.
 */
export function showMenu(): Promise<MenuResult> {
  return new Promise((resolve) => {
    const saved = loadSaved();
    const slots = saved.slots;
    Speed.factor = saved.speed;
    const urlSeed = new URLSearchParams(location.search).get("seed") ?? "";

    const root = h("div", { class: "menu" });
    uiRoot().append(root);

    const show = (screen: HTMLElement) => {
      root.innerHTML = "";
      root.append(screen);
    };

    const backBtn = (to: () => void) => {
      const b = h("button", { class: "btn small white back-btn", "data-testid": "back" }, Lang.menu.back);
      b.addEventListener("click", () => {
        sfx.click();
        to();
      });
      return b;
    };

    const header = (title: string, back: () => void) =>
      h("div", { class: "menu-head" }, backBtn(back), h("h2", {}, title), h("span", { class: "spacer" }));

    // ---------------------------------------------------------------- beranda

    const home = () => {
      const big = (icon: string, label: string, sub: string, cls: string, testid: string, onClick: () => void, badge?: string) => {
        const b = h(
          "button",
          { class: `btn big-choice ${cls}`, "data-testid": testid },
          h("span", { class: "bc-icon" }, icon),
          h("span", { class: "bc-text" }, h("b", {}, label), h("small", {}, sub)),
          badge ? h("span", { class: "badge" }, badge) : null,
        );
        b.addEventListener("click", () => {
          sfx.click();
          onClick();
        });
        return b;
      };

      const parade = h("div", { class: "parade" }, ...AVATARS.map((a, i) => h("span", { style: `--i:${i};background:${CRITTERS[i].color}` }, a)));

      show(
        h(
          "div",
          { class: "panel menu-panel home" },
          parade,
          h("div", { class: "logo" }, Lang.menu.logo),
          h("div", { class: "logo-sub" }, Lang.menu.logoSub),
          h("div", { class: "tagline" }, Lang.menu.tagline),
          h(
            "div",
            { class: "choices" },
            big("🛋️", Lang.menu.localTitle, Lang.menu.localSub, "green", "mode-local", lobby),
            big("🌐", Lang.menu.onlineTitle, Lang.menu.onlineSub, "blue", "mode-online", () => online()),
            big("📖", Lang.menu.rulesTitle, Lang.menu.rulesSub, "white", "mode-rules", rules),
          ),
          h("div", { class: "menu-foot" }, settingsButton(Lang.menu.settings)),
          h("div", { class: "menu-version", "data-testid": "version" }, `v${__APP_VERSION__}`),
        ),
      );
    };

    // ---------------------------------------------------------------- lobi lokal

    const lobby = () => {
      const grid = h("div", { class: "slots" });
      const err = h("div", { class: "menu-err" });
      const startBtn = h("button", { class: "btn green start-btn", "data-testid": "start" }, Lang.menu.startPlay);
      const countLabel = h("span", { class: "count" });

      const freeChar = (i: number, dir: 1 | -1) => {
        const s = slots[i];
        for (let k = 1; k <= CRITTERS.length; k++) {
          const next = (s.char + dir * k + CRITTERS.length * 2) % CRITTERS.length;
          if (!slots.some((o, j) => j !== i && o.type !== "off" && o.char === next)) return next;
        }
        return s.char;
      };
      /** Ganti karakter; nama bawaan ikut berganti, nama buatan pemain dibiarkan. */
      const setChar = (s: Slot, char: number) => {
        if (DEFAULT_NAMES.includes(s.name.trim())) s.name = DEFAULT_NAMES[char];
        s.char = char;
      };

      const render = () => {
        grid.innerHTML = "";
        const active = slots.filter((s) => s.type !== "off").length;
        countLabel.textContent = Lang.menu.playerCount(active);
        startBtn.disabled = active < 2;
        err.textContent = active < 2 ? Lang.menu.minPlayers : "";

        slots.forEach((s, i) => {
          const off = s.type === "off";
          const arrow = (dir: 1 | -1) => {
            const b = h("button", { class: "arrow", title: dir > 0 ? Lang.menu.nextChar : Lang.menu.prevChar, disabled: off }, dir > 0 ? "▶" : "◀");
            b.addEventListener("click", () => {
              sfx.click();
              setChar(s, freeChar(i, dir));
              render();
            });
            return b;
          };

          const name = h("input", { value: s.name, maxlength: 12, placeholder: "Nama", "data-testid": `name-${i}`, disabled: off });
          name.addEventListener("input", () => {
            s.name = name.value;
            save(slots);
          });

          const seg = h("div", { class: "seg", role: "radiogroup" });
          for (const [v, ico, l] of [
            ["human", "👤", Lang.menu.typeHuman],
            ["bot", "🤖", Lang.menu.typeBot],
            ["off", "", "✖"],
          ] as const) {
            const b = h("button", {
              class: s.type === v ? "on" : "",
              role: "radio",
              "aria-checked": s.type === v ? "true" : "false",
              title: v === "off" ? Lang.menu.clearSlot : undefined,
              "data-testid": `type-${i}-${v}`,
            }, ico ? h("span", { class: "seg-ico" }, `${ico} `) : null, l);
            b.addEventListener("click", () => {
              sfx.click();
              s.type = v;
              // Slot yang dinyalakan lagi mungkin bentrok karakter: cari yang bebas
              if (v !== "off" && slots.some((o, j) => j !== i && o.type !== "off" && o.char === s.char)) setChar(s, freeChar(i, 1));
              render();
            });
            seg.append(b);
          }

          const c = CRITTERS[s.char];
          grid.append(
            h(
              "div",
              { class: `slot${off ? " off" : ""}`, "data-testid": `slot-${i}` },
              h("div", { class: "slot-num" }, `P${i + 1}`),
              off
                ? h("div", { class: "empty-seat" }, h("div", { class: "avatar ghost" }, "＋"), h("small", {}, Lang.menu.emptySlot))
                : h(
                    "div",
                    { class: "char-pick" },
                    arrow(-1),
                    h("div", { class: "avatar", style: `background:${c.color}` }, AVATARS[s.char]),
                    arrow(1),
                  ),
              off ? null : h("div", { class: "char-name" }, c.label),
              off ? null : h("div", { class: "char-blurb" }, CHAR_BLURB[s.char]),
              name,
              seg,
            ),
          );
        });
        save(slots);
      };
      render();

      const speedSeg = h("div", { class: "seg" });
      const renderSpeed = () => {
        speedSeg.innerHTML = "";
        for (const v of [1, 2, 3]) {
          const b = h("button", { class: Speed.factor === v ? "on" : "" }, `${v}x`);
          b.addEventListener("click", () => {
            sfx.click();
            Speed.factor = v;
            save(slots);
            renderSpeed();
          });
          speedSeg.append(b);
        }
      };
      renderSpeed();

      const seed = h("input", { placeholder: Lang.menu.seedPlaceholder, size: 8, value: urlSeed, "data-testid": "seed", inputmode: "numeric" });
      const advanced = h(
        "details",
        { class: "advanced", open: urlSeed ? true : undefined },
        h("summary", {}, Lang.menu.advanced),
        h("label", {}, Lang.menu.seedLabel, seed),
      );

      startBtn.addEventListener("click", () => {
        const active = slots.filter((s) => s.type !== "off");
        if (active.length < 2) {
          sfx.bad();
          return;
        }
        sfx.build();
        save(slots);
        root.remove();
        const players = active.map((s) => ({
          name: s.name.trim() || CRITTERS[s.char].label.split(" ").slice(-1)[0],
          color: CRITTERS[s.char].color,
          isBot: s.type === "bot",
        }));
        const seedNum = seed.value.trim() ? Number(seed.value) : undefined;
        resolve({ players, characters: active.map((s) => s.char), seed: Number.isFinite(seedNum) ? seedNum : undefined });
      });

      show(
        h(
          "div",
          { class: "panel menu-panel lobby" },
          header(Lang.menu.pickPlayers, home),
          h("p", { class: "hint" }, Lang.menu.pickHint),
          grid,
          h(
            "div",
            { class: "lobby-foot" },
            h("label", { class: "inline" }, Lang.menu.speed, speedSeg),
            countLabel,
          ),
          err,
          startBtn,
          advanced,
        ),
      );
    };

    // ---------------------------------------------------------------- online

    let room: Room | null = null;
    let voiceUi: { voice: Voice; panel: VoicePanel } | null = null;
    const dropVoice = () => {
      voiceUi?.voice.destroy();
      voiceUi?.panel.destroy();
      voiceUi = null;
    };

    /** Layar awal online: isi nama, lalu buat room atau gabung pakai kode. */
    const online = (prefillCode = "", errorText = "", autoJoin = false) => {
      dropVoice();
      room?.leave();
      room = null;
      const me = slots[0];
      const name = h("input", { class: "online-name", value: me.name, maxlength: 12, placeholder: "Namamu", "data-testid": "online-name" });
      name.addEventListener("input", () => {
        me.name = name.value;
        save(slots);
      });
      const code = h("input", { class: "room-code", placeholder: Lang.menu.codePlaceholder, maxlength: CODE_LEN, value: prefillCode, "data-testid": "room-code", autocomplete: "off" });
      code.addEventListener("input", () => (code.value = normalizeCode(code.value)));
      const err = h("div", { class: "menu-err", "data-testid": "online-err" }, errorText);
      const createBtn = h("button", { class: "btn green", "data-testid": "create-room" }, Lang.menu.createRoom);
      const joinBtn = h("button", { class: "btn blue", "data-testid": "join-room" }, Lang.menu.join);

      const busy = async (btn: HTMLButtonElement, label: string, job: () => Promise<Room>) => {
        sfx.click();
        err.textContent = "";
        createBtn.disabled = joinBtn.disabled = true;
        const old = btn.textContent;
        btn.textContent = label;
        try {
          room = await job();
          roomLobby(room);
        } catch (e) {
          sfx.bad();
          err.textContent = `😵 ${(e as Error).message ?? e}`;
          createBtn.disabled = joinBtn.disabled = false;
          btn.textContent = old;
        }
      };
      createBtn.addEventListener("click", () => void busy(createBtn, Lang.menu.creating, () => Room.host(name.value, me.char)));
      const join = () => {
        if (code.value.length !== CODE_LEN) {
          sfx.bad();
          err.textContent = Lang.menu.codeLength(CODE_LEN);
          code.focus();
          return;
        }
        void busy(joinBtn, Lang.menu.joining, () => Room.join(code.value, name.value));
      };
      joinBtn.addEventListener("click", join);
      code.addEventListener("keydown", (e) => {
        if (e.key === "Enter") join();
      });

      // Sesi game online sebelumnya (mis. koneksi putus / halaman dimuat ulang): tombol sambung ulang
      const saved = loadSession();
      let resumeRow: HTMLElement | null = null;
      if (saved) {
        const again = h("button", { class: "btn green small", "data-testid": "rejoin-room" }, Lang.menu.rejoin);
        const forget = h("button", { class: "btn white small", title: Lang.menu.forgetSession }, "✖");
        again.addEventListener("click", () => {
          code.value = saved.code;
          if (!name.value.trim()) name.value = saved.name;
          join();
        });
        forget.addEventListener("click", () => {
          sfx.click();
          clearSession();
          resumeRow?.remove();
        });
        resumeRow = h(
          "div",
          { class: "resume-row", "data-testid": "resume-row" },
          h("span", { html: Lang.menu.rejoinHint(saved.code) }),
          again,
          forget,
        );
      }

      const card = (icon: string, title: string, text: string, ...extra: HTMLElement[]) =>
        h("div", { class: "online-card" }, h("div", { class: "oc-icon" }, icon), h("b", {}, title), h("p", {}, text), ...extra);
      show(
        h(
          "div",
          { class: "panel menu-panel online" },
          header(Lang.menu.onlineHeader, home),
          resumeRow,
          h("label", { class: "online-name-row" }, Lang.menu.yourName, name),
          h(
            "div",
            { class: "online-grid" },
            card("🏠", Lang.menu.hostTitle, Lang.menu.hostSub, createBtn),
            card("🔑", Lang.menu.joinTitle, Lang.menu.joinSub, code, joinBtn),
          ),
          err,
          h("p", { class: "hint" }, Lang.menu.p2pHint),
        ),
      );
      if (prefillCode) code.focus();
      if (autoJoin && code.value.length === CODE_LEN) join();
    };

    /** Lobi room: kode, daftar kursi, tambah bot, mulai. */
    const roomLobby = (r: Room) => {
      const me = slots[0];
      const list = h("div", { class: "seat-list" });
      const status = h("div", { class: "hint", "data-testid": "lobby-status" });
      const startBtn = h("button", { class: "btn green start-btn", "data-testid": "online-start" }, Lang.menu.startPlay);
      const addBotBtn = h("button", { class: "btn small white", "data-testid": "add-bot" }, Lang.menu.addBot);
      dropVoice();
      const voice = new Voice(r);
      const voicePanel = new VoicePanel(voice);
      voiceUi = { voice, panel: voicePanel };
      Object.assign(window as object, { __voice: voice }); // untuk QA di DevTools
      const link = `${location.origin}${location.pathname}?room=${r.code}`;

      const copyBtn = h("button", { class: "btn small white", title: Lang.menu.copyInviteTitle }, Lang.menu.copyLink);
      copyBtn.addEventListener("click", async () => {
        sfx.click();
        try {
          await navigator.clipboard.writeText(link);
          copyBtn.textContent = Lang.menu.copied;
        } catch {
          prompt(Lang.menu.copyPrompt, link);
        }
        setTimeout(() => (copyBtn.textContent = Lang.menu.copyLink), 1500);
      });

      addBotBtn.addEventListener("click", () => {
        sfx.click();
        r.addBot();
      });
      startBtn.addEventListener("click", () => {
        sfx.build();
        r.start();
      });

      const freeCharFrom = (seats: Seat[], i: number, dir: 1 | -1) => {
        for (let k = 1; k <= CRITTERS.length; k++) {
          const next = (seats[i].char + dir * k + CRITTERS.length * 2) % CRITTERS.length;
          if (!seats.some((o, j) => j !== i && o.char === next)) return next;
        }
        return seats[i].char;
      };

      const render = (seats: Seat[]) => {
        list.innerHTML = "";
        seats.forEach((s, i) => {
          const mine = s.id === r.me;
          const editable = mine || (r.isHost && s.kind === "bot");
          const arrow = (dir: 1 | -1) => {
            const b = h("button", { class: "arrow", title: Lang.menu.changeChar }, dir > 0 ? "▶" : "◀");
            b.addEventListener("click", () => {
              sfx.click();
              const char = freeCharFrom(seats, i, dir);
              if (mine) {
                me.char = char;
                save(slots);
              }
              r.setSeat(i, { char });
            });
            return b;
          };
          const tag = s.kind === "host" ? Lang.menu.tagHost : s.kind === "bot" ? Lang.menu.tagBot : Lang.menu.tagGuest;
          const kick = r.isHost && s.kind !== "host" ? h("button", { class: "btn small white kick", title: s.kind === "bot" ? Lang.menu.removeBot : Lang.menu.kick }, "✖") : null;
          kick?.addEventListener("click", () => {
            sfx.click();
            r.removeSeat(i);
          });
          list.append(
            h(
              "div",
              { class: `seat${mine ? " mine" : ""}`, "data-testid": `seat-${i}` },
              h(
                "div",
                { class: "char-pick" },
                editable ? arrow(-1) : null,
                h("div", { class: "avatar", style: `background:${CRITTERS[s.char].color}` }, AVATARS[s.char]),
                editable ? arrow(1) : null,
              ),
              h("div", { class: "seat-info" }, h("b", {}, s.name + (mine ? Lang.menu.youSuffix : "")), h("small", {}, `${tag} · ${CRITTERS[s.char].label}`)),
              kick,
            ),
          );
        });
        for (let i = seats.length; i < MAX_SEATS; i++) {
          list.append(h("div", { class: "seat empty" }, h("div", { class: "avatar ghost" }, "＋"), h("small", {}, Lang.menu.waitingFriend)));
        }
        addBotBtn.disabled = seats.length >= MAX_SEATS;
        startBtn.disabled = seats.length < 2;
        status.textContent = r.isHost
          ? seats.length < 2
            ? Lang.menu.lobbyShare
            : Lang.menu.lobbyReady
          : Lang.menu.lobbyWaitHost;
      };

      r.onLobby = (seats) => render(seats);
      r.onClosed = (reason) => {
        sfx.bad();
        online("", `📡 ${reason}`);
      };
      const begin = ({ seed, seats }: { seed: number; seats: Seat[] }) => {
        r.onLobby = null;
        r.onClosed = null;
        voiceUi = null; // pindah ke layar game
        root.remove();
        resolve({
          players: seats.map((s) => ({ name: s.name, color: CRITTERS[s.char].color, isBot: s.kind === "bot" })),
          characters: seats.map((s) => s.char),
          seed,
          online: { room: r, seats, voice, voicePanel },
        });
      };
      r.onStart = begin;
      // Tersambung kembali ke game yang sedang berjalan: langsung masuk ke papan
      if (r.resume) {
        begin({ seed: r.resumeSeed, seats: r.seats });
        return;
      }
      render(r.seats);

      show(
        h(
          "div",
          { class: "panel menu-panel online room-lobby" },
          header(Lang.menu.roomHeader, () => online()),
          h(
            "div",
            { class: "code-box" },
            h("small", {}, Lang.menu.roomCode),
            h("div", { class: "big-code", "data-testid": "room-code-display" }, r.code),
            copyBtn,
          ),
          list,
          r.isHost ? h("div", { class: "lobby-foot" }, addBotBtn) : null,
          status,
          r.isHost ? startBtn : null,
        ),
      );
    };

    // ---------------------------------------------------------------- cara main

    const rules = () => {
      const item = (icon: string, html: string) => h("li", { html: `<span class="ri">${icon}</span><span>${html}</span>` });
      show(
        h(
          "div",
          { class: "panel menu-panel rules-screen" },
          header(Lang.menu.rulesHeader, home),
          h(
            "ul",
            { class: "rule-list" },
            item("🎲", Lang.menu.rule1),
            item("💸", Lang.menu.rule2(Math.round(CONFIG.setRentBonus * 100))),
            item("🎯", Lang.menu.rule3),
            item("🏁", Lang.menu.rule4(rp(CONFIG.salary), CONFIG.festivalMultiplier)),
            item("📦", Lang.menu.rule5),
            item("📢", Lang.menu.rule6),
          ),
          h("h3", {}, Lang.menu.winHeader),
          h(
            "div",
            { class: "win-grid" },
            ...[
              ["💀", Lang.menu.winLastStanding],
              ["🎨", Lang.menu.winTriple],
              ["📏", Lang.menu.winLine],
              ["🌴", Lang.menu.winResort],
              ["⏰", Lang.menu.winRoundLimit(CONFIG.roundLimit)],
            ].map(([i, t]) => h("div", {}, h("span", {}, i), t)),
          ),
        ),
      );
    };

    const params = new URLSearchParams(location.search);
    const roomParam = normalizeCode(params.get("room") ?? "");
    const lastSession = loadSession();
    if (params.has("rejoin") && lastSession) online(lastSession.code, "", true);
    else if (roomParam) online(roomParam);
    else home();
  });
}

import { music } from "../scene/music";
import { setSound, sfx, Sound } from "../scene/sfx";
import { h, uiRoot } from "./dom";
import { Lang } from "../lang/id";

/**
 * Menu Esc / ⚙️: semua pengaturan audio dikumpulkan di sini supaya toolbar & beranda bersih.
 * Bisa dibuka kapan saja (menu awal maupun saat main), tidak menjeda permainan.
 */
let openEl: HTMLElement | null = null;

export function isSettingsOpen() {
  return openEl !== null;
}

export function closeSettings() {
  if (!openEl) return;
  openEl.remove();
  openEl = null;
}

export function toggleSettings() {
  if (openEl) closeSettings();
  else openSettings();
}

/** Pasang tombol Esc sekali saat boot. */
export function installSettingsHotkey() {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || e.repeat) return;
      e.preventDefault();
      sfx.click();
      toggleSettings();
    },
    true,
  );
}

/** Tombol ⚙️ kecil untuk toolbar / beranda (perangkat sentuh tidak punya Esc). */
export function settingsButton(label: string | Node = "⚙️") {
  const b = h("button", { class: "btn small white settings-btn", title: Lang.settings.openTitle, "data-testid": "open-settings" }, label);
  b.addEventListener("click", () => {
    sfx.click();
    toggleSettings();
  });
  return b;
}

function toggleRow(icon: string, label: string, testid: string, get: () => boolean, set: (on: boolean) => void) {
  const sw = h("button", { class: "switch", role: "switch", "data-testid": testid });
  const render = () => {
    const on = get();
    sw.classList.toggle("on", on);
    sw.setAttribute("aria-checked", String(on));
    sw.textContent = on ? Lang.settings.on : Lang.settings.off;
  };
  sw.addEventListener("click", () => {
    set(!get());
    render();
    sfx.click();
  });
  render();
  return { row: h("div", { class: "set-row" }, h("span", { class: "set-label" }, h("span", { class: "set-icon" }, icon), label), sw), render };
}

function sliderRow(icon: string, label: string, testid: string, get: () => number, set: (v: number) => void, preview?: () => void) {
  const value = h("span", { class: "set-val" });
  const input = h("input", { type: "range", min: 0, max: 100, step: 5, "data-testid": testid, "aria-label": label }) as HTMLInputElement;
  const render = () => {
    const pct = Math.round(get() * 100);
    input.value = String(pct);
    input.style.setProperty("--pct", `${pct}%`);
    value.textContent = `${pct}%`;
  };
  input.addEventListener("input", () => {
    set(Number(input.value) / 100);
    render();
  });
  if (preview) input.addEventListener("change", preview);
  render();
  return h("div", { class: "set-row slider" }, h("span", { class: "set-label" }, h("span", { class: "set-icon" }, icon), label), input, value);
}

export function openSettings() {
  if (openEl) return;
  const body = h("div", { class: "settings-body" });
  const sync = () => body.classList.toggle("all-muted", Sound.muted);

  const master = toggleRow("🔊", Lang.settings.sound, "set-sound", () => !Sound.muted, (on) => {
    setSound({ muted: !on });
    sync();
  });
  const musicToggle = toggleRow("🎵", Lang.settings.music, "set-music", () => music.enabled, () => music.toggle());

  body.append(
    h("div", { class: "set-group" }, master.row),
    h(
      "div",
      { class: "set-group game-audio" },
      sliderRow("💥", Lang.settings.sfx, "set-sfx-vol", () => Sound.sfxVol, (v) => setSound({ sfxVol: v }), () => sfx.coin()),
      musicToggle.row,
      sliderRow("🎚️", Lang.settings.musicVol, "set-music-vol", () => Sound.musicVol, (v) => setSound({ musicVol: v })),
    ),
    h(
      "div",
      { class: "set-group" },
      sliderRow("🎙️", Lang.settings.voice, "set-voice-vol", () => Sound.voiceVol, (v) => setSound({ voiceVol: v })),
      h("p", { class: "hint" }, Lang.settings.voiceHint),
    ),
  );
  sync();

  const resume = h("button", { class: "btn green", "data-testid": "close-settings" }, Lang.settings.resume);
  resume.addEventListener("click", () => {
    sfx.click();
    closeSettings();
  });

  const el = h(
    "div",
    { class: "modal-backdrop settings-backdrop", "data-testid": "settings-menu" },
    h(
      "div",
      { class: "modal panel settings-modal", role: "dialog", "aria-label": Lang.settings.dialogLabel },
      h("h2", {}, Lang.settings.title),
      body,
      h("div", { class: "buttons" }, resume),
      h("p", { class: "hint" }, Lang.settings.escHint),
    ),
  );
  // Klik area gelap di luar panel = tutup.
  el.addEventListener("pointerdown", (e) => {
    if (e.target === el) closeSettings();
  });
  openEl = el;
  uiRoot().append(el);
  resume.focus();
}

import type { Voice, VoiceMember } from "../net/Voice";
import { CRITTERS } from "../scene/Pawn";
import { sfx } from "../scene/sfx";
import { h, uiRoot } from "./dom";
import { AVATARS } from "./Hud";

/**
 * Panel voice chat mengambang (kiri tengah layar), tampil di lobi room & saat main.
 * - Gabung / keluar suara
 * - 🎤 mute diri sendiri, 🎧 deafen (tidak dengar siapa pun + otomatis mute)
 * - Klik pemain lain → bisukan untuk kamu saja + atur volumenya
 */
export class VoicePanel {
  readonly el = h("div", { class: "voice-panel panel", "data-testid": "voice-panel" });
  private list = h("div", { class: "vp-list" });
  private warn = h("div", { class: "vp-warn", hidden: true });
  private controls = h("div", { class: "vp-controls" });
  private body = h("div", { class: "vp-body" }, this.list, this.warn, this.controls);
  private title = h("span", { class: "vp-title" });
  private expanded: string | null = null;
  private listSig = "";
  private ctrlSig = "";
  private collapsed = window.matchMedia("(max-width: 760px)").matches;
  private _onSpeaking: ((id: string, speaking: boolean) => void) | null = null;
  private lastSpeaking = new Set<string>();

  /** Kartu pemain di HUD ikut menyala saat berbicara (yang sedang bicara langsung dikabarkan). */
  set onSpeaking(fn: ((id: string, speaking: boolean) => void) | null) {
    this._onSpeaking = fn;
    if (fn) for (const id of this.lastSpeaking) fn(id, true);
  }

  constructor(private voice: Voice) {
    const head = h("button", { class: "vp-head", title: "Buka/tutup panel suara", "data-testid": "voice-toggle-panel" }, this.title, h("span", { class: "vp-caret" }));
    head.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.render(true);
    });
    this.el.append(head, this.body);
    uiRoot().append(this.el);
    voice.onChange = () => this.render();
    this.render(true);
  }

  destroy() {
    this.el.remove();
  }

  private render(force = false) {
    const v = this.voice;
    const members = v.members();
    const inVoice = members.filter((m) => m.state?.on).length;

    // Indikator bicara selalu diperbarui (murah)
    const speakingNow = new Set(members.filter((m) => m.speaking).map((m) => m.id));
    for (const id of new Set([...speakingNow, ...this.lastSpeaking])) {
      if (speakingNow.has(id) !== this.lastSpeaking.has(id)) this._onSpeaking?.(id, speakingNow.has(id));
    }
    this.lastSpeaking = speakingNow;
    this.el.classList.toggle("talking", v.transmitting && speakingNow.has(members.find((m) => m.isMe)?.id ?? ""));

    this.title.textContent = v.joined ? `🔊 Suara · ${inVoice}` : `🎙️ Suara${inVoice ? ` · ${inVoice}` : ""}`;
    this.el.classList.toggle("collapsed", this.collapsed);
    this.el.classList.toggle("joined", v.joined);

    // Daftar & tombol digambar ulang terpisah, supaya tombol tidak "hilang" saat diklik
    // ketika ada pemain lain yang gabung/keluar.
    const listSig = JSON.stringify([this.expanded, v.joined, members.map((m) => [m.id, m.seat.name, m.seat.char, m.state, m.connected, m.localMuted])]);
    if (force || listSig !== this.listSig) {
      this.listSig = listSig;
      this.list.replaceChildren(...members.map((m) => this.row(m)));
    } else {
      for (const row of this.list.querySelectorAll<HTMLElement>(".vp-row")) {
        row.classList.toggle("speaking", speakingNow.has(row.dataset.id ?? ""));
      }
    }

    const ctrlSig = JSON.stringify([v.joined, v.joining, v.mute, v.deaf, v.micOk, v.micError]);
    if (!force && ctrlSig === this.ctrlSig) return;
    this.ctrlSig = ctrlSig;
    this.warn.textContent = v.micError && v.joined ? `⚠️ ${v.micError}` : "";
    this.warn.hidden = !this.warn.textContent;

    const controls = this.controls;
    controls.replaceChildren();
    if (!v.joined) {
      const joinBtn = h("button", { class: "btn small green vp-join", disabled: v.joining, "data-testid": "voice-join" }, v.joining ? "⏳ Menyambung..." : "🎧 Gabung Suara");
      joinBtn.addEventListener("click", () => {
        sfx.click();
        void v.join();
      });
      controls.append(joinBtn);
    } else {
      const micOff = v.mute || v.deaf || !v.micOk;
      const muteBtn = h(
        "button",
        {
          class: `btn small vp-btn ${micOff ? "off" : "white"}`,
          title: !v.micOk ? "Mikrofon tidak tersedia" : micOff ? "Nyalakan mikrofon" : "Bisukan mikrofon",
          disabled: !v.micOk,
          "aria-pressed": micOff ? "true" : "false",
          "data-testid": "voice-mute",
        },
        micOff ? "🔇" : "🎤",
      );
      muteBtn.addEventListener("click", () => {
        sfx.click();
        v.toggleMute();
      });
      const deafBtn = h(
        "button",
        {
          class: `btn small vp-btn ${v.deaf ? "off" : "white"}`,
          title: v.deaf ? "Dengarkan lagi" : "Tulikan (tidak dengar siapa pun)",
          "aria-pressed": v.deaf ? "true" : "false",
          "data-testid": "voice-deafen",
        },
        v.deaf ? "🙉" : "🎧",
      );
      deafBtn.addEventListener("click", () => {
        sfx.click();
        v.toggleDeaf();
      });
      const leaveBtn = h("button", { class: "btn small pink vp-btn", title: "Keluar dari suara", "data-testid": "voice-leave" }, "📞");
      leaveBtn.addEventListener("click", () => {
        sfx.click();
        this.expanded = null;
        v.leave();
      });
      controls.append(muteBtn, deafBtn, leaveBtn);
    }
  }

  private row(m: VoiceMember): HTMLElement {
    const v = this.voice;
    const on = !!m.state?.on;
    const icons: string[] = [];
    if (on && m.state?.deaf) icons.push("🙉");
    else if (on && m.state?.mute) icons.push("🔇");
    if (m.localMuted) icons.push("🚫");

    let status = "";
    if (!on) status = "belum gabung";
    else if (!m.isMe && v.joined && !m.connected) status = "menyambung...";

    const canControl = !m.isMe && on && v.joined;
    const row = h(
      "div",
      {
        class: `vp-row${on ? "" : " away"}${m.speaking ? " speaking" : ""}${canControl ? " clickable" : ""}`,
        "data-id": m.id,
        "data-testid": `voice-member-${m.seat.name}`,
        title: canControl ? "Klik untuk atur suara pemain ini" : undefined,
      },
      h("div", { class: "vp-avatar", style: `background:${CRITTERS[m.seat.char].color}` }, AVATARS[m.seat.char]),
      h("div", { class: "vp-name" }, h("b", {}, m.seat.name + (m.isMe ? " (kamu)" : "")), status ? h("small", {}, status) : null),
      h("span", { class: "vp-icons" }, icons.join(" ")),
    );
    if (!canControl) return row;

    row.addEventListener("click", () => {
      sfx.click();
      this.expanded = this.expanded === m.id ? null : m.id;
      this.render(true);
    });
    if (this.expanded !== m.id) return row;

    // Kontrol per pemain: bisukan lokal + volume
    const pct = h("span", { class: "vp-pct" }, `${Math.round(m.volume * 100)}%`);
    const slider = h("input", { type: "range", min: 0, max: 100, value: Math.round(m.volume * 100), "aria-label": `Volume ${m.seat.name}`, "data-testid": "voice-volume" });
    slider.addEventListener("input", () => {
      pct.textContent = `${slider.value}%`;
      v.setVolume(m.id, Number(slider.value) / 100);
    });
    const muteOther = h(
      "button",
      { class: `btn small ${m.localMuted ? "off" : "white"}`, "data-testid": "voice-mute-other" },
      m.localMuted ? "🔈 Bunyikan" : "🚫 Bisukan untukku",
    );
    muteOther.addEventListener("click", (e) => {
      e.stopPropagation();
      sfx.click();
      v.toggleLocalMute(m.id);
    });
    const wrap = h("div", { class: "vp-member" }, row, h("div", { class: "vp-extra" }, h("label", {}, "🔊", slider, pct), muteOther));
    wrap.addEventListener("click", (e) => e.stopPropagation());
    return wrap;
  }
}

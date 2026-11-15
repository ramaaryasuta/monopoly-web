/**
 * Tingkat kualitas grafis. "low" dipakai otomatis di HP/tablet (layar sentuh).
 * Bisa dipaksa lewat URL: ?gfx=low / ?gfx=high.
 */
export type Quality = "low" | "high";

function detect(): Quality {
  try {
    const q = new URLSearchParams(location.search).get("gfx");
    if (q === "low" || q === "high") return q;
  } catch {
    /* abaikan */
  }
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
  // iPadOS menyamar sebagai Mac, tapi punya layar sentuh
  const iPadOs = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return coarse || mobileUa || iPadOs ? "low" : "high";
}

export const QUALITY: Quality = detect();
export const LOW_GFX = QUALITY === "low";

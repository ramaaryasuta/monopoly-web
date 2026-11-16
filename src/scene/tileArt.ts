import { DynamicTexture, type Scene } from "@babylonjs/core";
import type { TileDef } from "../core/types";
import { GROUP_COLORS, isCorner as cornerTile } from "../data/board";
import { rp } from "../core/money";
import { Lang } from "../lang/id";

const ICONS: Record<string, string> = {
  start: "🏁",
  chance: "📦",
  tax: "🦹",
  island: "⛓️",
  festival: "🥂",
  tour: "✈️",
  resort: "🌴",
};

/** Warna tinta teks petak: hampir hitam supaya kontras di atas petak krem. */
const INK = "#1d1228";
const TILE_TEX_SIZE = 512;

export const FONT = "'Fredoka', 'Baloo 2', 'Comic Sans MS', system-ui, sans-serif";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export interface TileArtState {
  ownerColor: string | null;
  rent: number;
  festival: boolean;
  /** Pemilik menguasai seluruh grup warna petak ini (sewa +bonus set). */
  fullSet?: boolean;
}

/** Gambar permukaan atas petak ke DynamicTexture. Atas tekstur = arah ke dalam papan. */
export function drawTile(tex: DynamicTexture, def: TileDef, st: TileArtState) {
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const S = tex.getSize().width;
  /** Skala ukuran garis/sudut yang dulu dirancang untuk tekstur 256px. */
  const k = S / 256;
  ctx.clearRect(0, 0, S, S);

  const isCorner = cornerTile(def.index);
  const base = isCorner ? "#fff3c4" : "#fffaf0";
  roundRect(ctx, 6 * k, 6 * k, S - 12 * k, S - 12 * k, 28 * k);
  ctx.fillStyle = base;
  ctx.fill();

  // Pita warna grup (sisi dalam = atas tekstur)
  if (def.kind === "property") {
    ctx.save();
    roundRect(ctx, 6 * k, 6 * k, S - 12 * k, S * 0.24, 28 * k);
    ctx.clip();
    ctx.fillStyle = GROUP_COLORS[def.group!];
    ctx.fillRect(0, 0, S, S * 0.3);
    ctx.restore();
  } else if (def.kind === "resort") {
    ctx.save();
    roundRect(ctx, 6 * k, 6 * k, S - 12 * k, S * 0.24, 28 * k);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, "#36d1c4");
    g.addColorStop(1, "#5bc0ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S * 0.3);
    ctx.restore();
  }

  // Bingkai pemilik
  ctx.lineWidth = (st.ownerColor ? 16 : 8) * k;
  ctx.strokeStyle = st.ownerColor ?? INK;
  roundRect(ctx, 10 * k, 10 * k, S - 20 * k, S - 20 * k, 26 * k);
  ctx.stroke();
  if (st.fullSet) {
    // Set lengkap: bingkai emas di dalam bingkai pemilik + mahkota di pita warna
    ctx.lineWidth = 7 * k;
    ctx.strokeStyle = "#ffd23f";
    roundRect(ctx, 21 * k, 21 * k, S - 42 * k, S - 42 * k, 20 * k);
    ctx.stroke();
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = INK;
    roundRect(ctx, 17.5 * k, 17.5 * k, S - 35 * k, S - 35 * k, 22 * k);
    ctx.stroke();
    roundRect(ctx, 24.5 * k, 24.5 * k, S - 49 * k, S - 49 * k, 18 * k);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (isCorner || def.kind === "chance" || def.kind === "tax") {
    ctx.font = `${isCorner ? S * 0.36 : S * 0.3}px ${FONT}`;
    ctx.fillText(ICONS[def.kind], S / 2, S * 0.42);
    ctx.fillStyle = INK;
    ctx.font = `bold ${S * 0.12}px ${FONT}`;
    wrapText(ctx, def.name, S * 0.88).forEach((l, i, arr) => {
      ctx.fillText(l, S / 2, S * 0.78 + (i - (arr.length - 1) / 2) * S * 0.125);
    });
    return;
  }

  // Properti / resort
  if (def.kind === "resort") {
    ctx.font = `${S * 0.2}px ${FONT}`;
    ctx.fillText(ICONS.resort, S / 2, S * 0.42);
  }
  ctx.fillStyle = INK;
  ctx.font = `bold ${S * 0.13}px ${FONT}`;
  const lines = wrapText(ctx, def.name, S * 0.86);
  const nameY = def.kind === "resort" ? S * 0.6 : S * 0.48;
  lines.forEach((l, i) => ctx.fillText(l, S / 2, nameY + (i - (lines.length - 1) / 2) * S * 0.135));

  // Harga / sewa
  ctx.font = `bold ${S * 0.12}px ${FONT}`;
  const label = st.ownerColor ? Lang.scene3d.rentLabel(rp(st.rent)) : rp(def.price ?? 0);
  const w = ctx.measureText(label).width + S * 0.12;
  roundRect(ctx, S / 2 - w / 2, S * 0.755, w, S * 0.16, S * 0.075);
  ctx.fillStyle = st.ownerColor ?? "#ffd23f";
  ctx.fill();
  ctx.lineWidth = 4 * k;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = st.ownerColor ? "#fff" : INK;
  ctx.fillText(label, S / 2, S * 0.835);

  if (st.fullSet) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${S * 0.17}px ${FONT}`;
    ctx.fillText("👑", S * 0.17, S * 0.15);
  }

  if (st.festival) {
    ctx.font = `${S * 0.16}px ${FONT}`;
    ctx.fillText("⭐", S * 0.83, S * 0.17);
  }
}

export function createTileTexture(scene: Scene, name: string) {
  // 512px + filter anisotropik supaya tulisan tetap tajam walau papan dilihat miring.
  const tex = new DynamicTexture(name, { width: TILE_TEX_SIZE, height: TILE_TEX_SIZE }, scene, true);
  tex.hasAlpha = true;
  tex.anisotropicFilteringLevel = 16;
  return tex;
}

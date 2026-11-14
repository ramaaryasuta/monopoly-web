import { DynamicTexture, type Scene } from "@babylonjs/core";
import type { TileDef } from "../core/types";
import { GROUP_COLORS } from "../data/board";

const ICONS: Record<string, string> = {
  start: "🏁",
  chance: "📦",
  tax: "🦹",
  island: "💔",
  festival: "🎤",
  tour: "🛸",
  resort: "🌴",
};

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
}

/** Gambar permukaan atas petak ke DynamicTexture. Atas tekstur = arah ke dalam papan. */
export function drawTile(tex: DynamicTexture, def: TileDef, st: TileArtState) {
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const S = tex.getSize().width;
  ctx.clearRect(0, 0, S, S);

  const isCorner = def.index % 8 === 0;
  const base = isCorner ? "#fff3c4" : "#fffaf0";
  roundRect(ctx, 6, 6, S - 12, S - 12, 28);
  ctx.fillStyle = base;
  ctx.fill();

  // Pita warna grup (sisi dalam = atas tekstur)
  if (def.kind === "property") {
    ctx.save();
    roundRect(ctx, 6, 6, S - 12, S * 0.24, 28);
    ctx.clip();
    ctx.fillStyle = GROUP_COLORS[def.group!];
    ctx.fillRect(0, 0, S, S * 0.3);
    ctx.restore();
  } else if (def.kind === "resort") {
    ctx.save();
    roundRect(ctx, 6, 6, S - 12, S * 0.24, 28);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, "#36d1c4");
    g.addColorStop(1, "#5bc0ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S * 0.3);
    ctx.restore();
  }

  // Bingkai pemilik
  ctx.lineWidth = st.ownerColor ? 16 : 8;
  ctx.strokeStyle = st.ownerColor ?? "#3a2a4a";
  roundRect(ctx, 10, 10, S - 20, S - 20, 26);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (isCorner || def.kind === "chance" || def.kind === "tax") {
    ctx.font = `${isCorner ? S * 0.36 : S * 0.3}px ${FONT}`;
    ctx.fillText(ICONS[def.kind], S / 2, S * 0.42);
    ctx.fillStyle = "#3a2a4a";
    ctx.font = `bold ${S * 0.11}px ${FONT}`;
    wrapText(ctx, def.name, S * 0.85).forEach((l, i, arr) => {
      ctx.fillText(l, S / 2, S * 0.78 + (i - (arr.length - 1) / 2) * S * 0.12);
    });
    return;
  }

  // Properti / resort
  if (def.kind === "resort") {
    ctx.font = `${S * 0.2}px ${FONT}`;
    ctx.fillText(ICONS.resort, S / 2, S * 0.42);
  }
  ctx.fillStyle = "#3a2a4a";
  ctx.font = `bold ${S * 0.12}px ${FONT}`;
  const lines = wrapText(ctx, def.name, S * 0.82);
  const nameY = def.kind === "resort" ? S * 0.62 : S * 0.48;
  lines.forEach((l, i) => ctx.fillText(l, S / 2, nameY + (i - (lines.length - 1) / 2) * S * 0.13));

  // Harga / sewa
  ctx.font = `bold ${S * 0.11}px ${FONT}`;
  const label = st.ownerColor ? `Sewa ${st.rent}` : `${def.price}`;
  const w = ctx.measureText(label).width + S * 0.12;
  roundRect(ctx, S / 2 - w / 2, S * 0.76, w, S * 0.15, S * 0.07);
  ctx.fillStyle = st.ownerColor ?? "#ffd23f";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#3a2a4a";
  ctx.stroke();
  ctx.fillStyle = st.ownerColor ? "#fff" : "#3a2a4a";
  ctx.fillText(label, S / 2, S * 0.835);

  if (st.festival) {
    ctx.font = `${S * 0.16}px ${FONT}`;
    ctx.fillText("⭐", S * 0.83, S * 0.17);
  }
}

export function createTileTexture(scene: Scene, name: string) {
  const tex = new DynamicTexture(name, { width: 256, height: 256 }, scene, true);
  tex.hasAlpha = true;
  return tex;
}

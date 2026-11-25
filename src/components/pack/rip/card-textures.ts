"use client";

/*
  Card and roulette artwork.

  The card back is drawn procedurally in the house style; the front is the
  card's real artwork from the pool, loaded with CORS (the image CDN allows
  it) and falling back to a styled plate if it cannot be fetched.
*/

import * as THREE from "three";
import type { Rarity } from "@/lib/domain";
import { rarityVisual } from "@/lib/rarity-visuals";

const CARD_W = 768;
const CARD_H = 1072;
const DISPLAY = '"Rips Display", "Barlow Condensed", "Arial Narrow", sans-serif';
const SANS = '"Outfit", "Helvetica Neue", Arial, sans-serif';

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function shield(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const k = size / 64;
  const p = (x: number, y: number) => [cx + (x - 32) * k, cy + (y - 32) * k] as const;
  const a = p(32, 6);
  const b = p(55, 17);
  const c = p(55, 36);
  const d = p(32, 59);
  const e = p(9, 36);
  const f = p(9, 17);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.bezierCurveTo(...p(55, 47), ...p(45, 55), d[0], d[1]);
  ctx.bezierCurveTo(...p(19, 55), ...p(9, 47), e[0], e[1]);
  ctx.lineTo(f[0], f[1]);
  ctx.closePath();
}

export function cardBackTexture(): THREE.CanvasTexture {
  const c = canvas(CARD_W, CARD_H);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#2c1550");
  bg.addColorStop(0.45, "#1a0c31");
  bg.addColorStop(1, "#0a0514");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // fine metal ribs
  for (let x = 0; x < CARD_W; x += 4) {
    ctx.fillStyle = x % 8 === 0 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(x, 0, 2, CARD_H);
  }

  // guilloche rings
  for (let r = 90; r < 520; r += 26) {
    ctx.beginPath();
    ctx.arc(CARD_W / 2, CARD_H / 2, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(190,150,255,${0.05 - r / 12000})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(CARD_W / 2, CARD_H * 0.44, 20, CARD_W / 2, CARD_H * 0.44, 380);
  glow.addColorStop(0, "rgba(190,130,255,0.32)");
  glow.addColorStop(1, "rgba(190,130,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // border
  ctx.strokeStyle = "rgba(226,196,255,0.55)";
  ctx.lineWidth = 6;
  ctx.strokeRect(26, 26, CARD_W - 52, CARD_H - 52);
  ctx.strokeStyle = "rgba(226,196,255,0.2)";
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, CARD_W - 88, CARD_H - 88);

  // shield emblem
  ctx.save();
  ctx.translate(0, -30);
  shield(ctx, CARD_W / 2, CARD_H / 2, 300);
  ctx.fillStyle = "rgba(20,7,36,0.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,200,255,0.9)";
  ctx.lineWidth = 5;
  ctx.stroke();
  // crown
  const k = 300 / 64;
  const cx = CARD_W / 2;
  const cy = CARD_H / 2 - 30;
  ctx.beginPath();
  const pts = [
    [20, 40],
    [22.5, 24],
    [29, 31],
    [32, 20],
    [35, 31],
    [41.5, 24],
    [44, 40],
  ];
  pts.forEach(([x, y], i) => {
    const px = cx + (x - 32) * k;
    const py = cy + (y - 32) * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(240,220,255,0.95)";
  ctx.fill();
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(245,236,255,0.95)";
  ctx.font = `700 86px ${DISPLAY}`;
  ctx.fillText("RIPS", CARD_W / 2, CARD_H - 150);
  ctx.font = `500 26px ${SANS}`;
  ctx.fillStyle = "rgba(210,190,240,0.55)";
  ctx.letterSpacing = "6px";
  ctx.fillText("BY FCARGO", CARD_W / 2, CARD_H - 108);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function fallbackCard(name: string, tier: Rarity): THREE.CanvasTexture {
  const c = canvas(CARD_W, CARD_H);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  const visual = rarityVisual(tier);
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, visual.deep);
  bg.addColorStop(1, "#08050e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = visual.color;
  ctx.lineWidth = 8;
  ctx.strokeRect(30, 30, CARD_W - 60, CARD_H - 60);
  ctx.fillStyle = visual.color;
  ctx.font = `700 64px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.fillText(visual.name.toUpperCase(), CARD_W / 2, 260);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 58px ${DISPLAY}`;
  const words = name.toUpperCase().split(" ");
  words.slice(0, 4).forEach((word, i) => ctx.fillText(word, CARD_W / 2, CARD_H / 2 + i * 70));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function loadCardFront(url: string, name: string, tier: Rarity): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  try {
    const tex = await Promise.race([
      loader.loadAsync(url),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  } catch {
    return fallbackCard(name, tier);
  }
}

/** The ribbon of rarity bands the roulette scrolls past. */
export function reelTexture(bands: Rarity[]) {
  const bandH = 160;
  const width = 640;
  const height = bands.length * bandH;
  const c = canvas(width, height);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  bands.forEach((tier, index) => {
    const visual = rarityVisual(tier);
    const y = index * bandH;
    const g = ctx.createLinearGradient(0, y, width, y);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.2, visual.deep);
    g.addColorStop(0.5, visual.color);
    g.addColorStop(0.8, visual.deep);
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, width, bandH);

    const sheen = ctx.createRadialGradient(width / 2, y + bandH / 2, 10, width / 2, y + bandH / 2, width * 0.6);
    sheen.addColorStop(0, "rgba(255,255,255,0.5)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.06)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, y, width, bandH);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${bandH * 0.27}px ${DISPLAY}`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.shadowColor = visual.bright;
    ctx.shadowBlur = 18;
    ctx.fillText(visual.name.toUpperCase(), width / 2, y + bandH * 0.53);
    ctx.shadowBlur = 0;

    // The card covers the middle of the ribbon, so the label is repeated out
    // to either side where it stays readable as the reel lands.
    ctx.font = `700 ${bandH * 0.2}px ${DISPLAY}`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    for (const x of [width * 0.17, width * 0.83]) {
      ctx.fillText(visual.name.toUpperCase(), x, y + bandH * 0.53);
    }

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(0, y + bandH - 2, width, 2);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, y, width, 3);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapT = THREE.RepeatWrapping;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return { texture: tex, count: bands.length };
}

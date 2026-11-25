/*
  Foil artwork for the 3D pack.

  Everything is drawn with a 2D canvas at build-on-the-client time: the printed
  design, a roughness/metalness map and a height field that is turned into a
  tangent-space normal map. That gives the foil its material variation — brushed
  vertical ribs, micro dents, a crimp band and genuinely bevelled lettering —
  rather than a flat purple gradient.
*/

import * as THREE from "three";
import type { PackColorway } from "@/lib/pack-colorways";

export type PackArtInput = {
  /** Stable look key; lets one authored design be reused across every instance. */
  key?: string;
  wordmark: string;
  colorway: PackColorway;
  setName: string;
  label: string;
};

export type PackTextures = {
  map: THREE.Texture;
  orm: THREE.Texture;
  normal: THREE.Texture;
};

/* Face artwork is authored at 1024 x 1707, i.e. the pack's 0.6 aspect. */
const CW = 1024;
const CH = 1707;

const FACE = {
  word: 300,
  wordY: 448,
  emblemY: 700,
  emblemSize: 300,
  buttonY: 1072,
  buttonSize: 198,
  lineY: 1216,
  set: 46,
  setY: 1300,
  label: 168,
  labelY: 1454,
  seal: 128,
};

const DISPLAY = '"Rips Display", "Barlow Condensed", "Arial Narrow", sans-serif';
const SANS = '"Outfit", "Helvetica Neue", Arial, sans-serif';

/* ── small colour helpers ─────────────────────────────────── */

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const l = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${l(ar, br)},${l(ag, bg)},${l(ab, bb)})`;
}

const shade = (hex: string, t: number) => (t >= 0 ? mix(hex, "#ffffff", t) : mix(hex, "#000000", -t));

/** Deterministic noise so every render of a pack is identical. */
function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function surface(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return [canvas, ctx];
}

/* ── fonts ────────────────────────────────────────────────── */

let fontsReady: Promise<void> | null = null;

export function ensurePackFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!fontsReady) {
    fontsReady = (async () => {
      const fonts = document.fonts;
      if (!fonts) return;
      await Promise.all([
        fonts.load(`700 64px "Rips Display"`).catch(() => []),
        fonts.load(`600 32px "Outfit"`).catch(() => []),
        fonts.load(`700 32px "Outfit"`).catch(() => []),
      ]);
      await fonts.ready.catch(() => undefined);
    })();
  }
  return fontsReady;
}

/* ── shared shapes ────────────────────────────────────────── */

/** The RIPS shield, in the same 64-unit space as the emblem geometry. */
function shieldPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
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

/* ── type ─────────────────────────────────────────────────── */

type Ink = "color" | "silver" | "solid" | "mask" | "orm";

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  family: string,
  weight: number,
  maxWidth: number,
  tracking = 0,
) {
  let s = size;
  const set = () => {
    ctx.font = `${weight} ${Math.round(s)}px ${family}`;
    ctx.letterSpacing = `${Math.round(s * tracking)}px`;
  };
  set();
  const width = ctx.measureText(text).width;
  if (width > maxWidth) {
    s *= maxWidth / width;
    set();
  }
  return s;
}

function drawWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  baseline: number,
  size: number,
  maxWidth: number,
  ink: Ink,
  colorway: PackColorway,
  tracking = 0.01,
) {
  const label = text.toUpperCase();
  if (!label.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // measure the *uppercase* string, which is what actually gets drawn
  const s = fitFont(ctx, label, size, DISPLAY, 700, maxWidth, tracking);
  // and cap the draw itself, so a font swap or a long name can never run
  // past the printed band

  if (ink === "mask") {
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, cx, baseline, maxWidth);
    ctx.restore();
    return;
  }

  if (ink === "orm") {
    ctx.fillStyle = "rgb(255,122,150)";
    ctx.fillText(label, cx, baseline, maxWidth);
    ctx.restore();
    return;
  }

  // a tight seat shadow: the word is pressed into the film, not floating on it
  ctx.shadowColor = "rgba(12,2,20,0.55)";
  ctx.shadowBlur = s * 0.028;
  ctx.shadowOffsetY = s * 0.014;
  ctx.fillStyle = "rgba(20,5,32,0.9)";
  ctx.fillText(label, cx, baseline, maxWidth);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (ink === "solid") {
    ctx.fillStyle = colorway.ink;
    ctx.fillText(label, cx, baseline, maxWidth);
    ctx.restore();
    return;
  }

  // brushed silver: bright crown, darker waist, bright foot
  const top = baseline - s * 0.78;
  const g = ctx.createLinearGradient(0, top, 0, baseline + s * 0.04);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.26, "#f7f4fc");
  g.addColorStop(0.44, "#d5cfe1");
  g.addColorStop(0.52, "#a49cb7");
  g.addColorStop(0.62, "#e6e1f0");
  g.addColorStop(0.84, "#fdfbff");
  g.addColorStop(1, "#c9c3d6");
  ctx.fillStyle = g;
  ctx.fillText(label, cx, baseline, maxWidth);

  // top bevel highlight + lower shade line
  ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.strokeText(label, cx, baseline, maxWidth);
  ctx.lineWidth = Math.max(1, s * 0.008);
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.strokeText(label, cx, baseline + s * 0.02, maxWidth);
  ctx.restore();
}

/* ── foil base ────────────────────────────────────────────── */

function paintFoil(ctx: CanvasRenderingContext2D, cw: PackColorway, seed: number) {
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, shade(cw.top, 0.16));
  g.addColorStop(0.16, cw.top);
  g.addColorStop(0.46, cw.mid);
  g.addColorStop(0.74, shade(cw.mid, -0.32));
  g.addColorStop(1, cw.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);

  // broad vertical reflection bands: the film curls left to right
  const band = ctx.createLinearGradient(0, 0, CW, 0);
  band.addColorStop(0.0, rgba("#ffffff", 0.2));
  band.addColorStop(0.07, rgba("#ffffff", 0.04));
  band.addColorStop(0.2, rgba("#ffffff", 0.13));
  band.addColorStop(0.38, rgba("#ffffff", 0.02));
  band.addColorStop(0.52, rgba("#000000", 0.07));
  band.addColorStop(0.68, rgba("#ffffff", 0.1));
  band.addColorStop(0.82, rgba("#000000", 0.13));
  band.addColorStop(0.94, rgba("#ffffff", 0.12));
  band.addColorStop(1.0, rgba("#ffffff", 0.22));
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, CW, CH);

  // specular crown near the top of the sachet
  const glow = ctx.createRadialGradient(CW * 0.46, CH * 0.2, 0, CW * 0.46, CH * 0.2, CW * 0.78);
  glow.addColorStop(0, rgba("#ffffff", 0.18));
  glow.addColorStop(0.55, rgba("#ffffff", 0.04));
  glow.addColorStop(1, rgba("#ffffff", 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CW, CH);

  // brushed vertical ribs
  for (let x = 0; x < CW; x += 3) {
    const a = 0.012 + 0.02 * (0.5 + 0.5 * Math.sin(x * 0.41));
    ctx.fillStyle = x % 6 === 0 ? rgba("#ffffff", a) : rgba("#000000", a * 0.8);
    ctx.fillRect(x, 0, 2, CH);
  }

  // dents and handling marks in the film
  const rnd = rand(seed);
  for (let i = 0; i < 110; i += 1) {
    const x = rnd() * CW;
    const y = rnd() * CH;
    const r = 18 + rnd() * 110;
    const light = rnd() > 0.45;
    const spot = ctx.createRadialGradient(x, y, 0, x, y, r);
    spot.addColorStop(0, light ? rgba("#ffffff", 0.05) : rgba("#000000", 0.055));
    spot.addColorStop(1, light ? rgba("#ffffff", 0) : rgba("#000000", 0));
    ctx.fillStyle = spot;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // a couple of long soft creases
  for (let i = 0; i < 5; i += 1) {
    const x = CW * (0.1 + rnd() * 0.8);
    const y = CH * (0.2 + rnd() * 0.5);
    const h = 160 + rnd() * 320;
    const cg = ctx.createLinearGradient(x, y, x + 60, y + h);
    cg.addColorStop(0, rgba("#ffffff", 0));
    cg.addColorStop(0.5, rgba("#ffffff", 0.05));
    cg.addColorStop(1, rgba("#ffffff", 0));
    ctx.fillStyle = cg;
    ctx.fillRect(x, y, 70, h);
  }

  // a whisper of edge falloff, so the fold reads without a picture frame
  const vign = ctx.createLinearGradient(0, 0, CW, 0);
  vign.addColorStop(0, rgba("#05010a", 0.16));
  vign.addColorStop(0.035, rgba("#05010a", 0));
  vign.addColorStop(0.965, rgba("#05010a", 0));
  vign.addColorStop(1, rgba("#05010a", 0.18));
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, CW, CH);

  const vg = ctx.createLinearGradient(0, CH * 0.8, 0, CH);
  vg.addColorStop(0, rgba("#05010a", 0));
  vg.addColorStop(1, rgba("#05010a", 0.3));
  ctx.fillStyle = vg;
  ctx.fillRect(0, CH * 0.8, CW, CH * 0.2);
}

function paintCrimp(ctx: CanvasRenderingContext2D, yTop: number, yBottom: number, cw: PackColorway) {
  const h = yBottom - yTop;
  const g = ctx.createLinearGradient(0, yTop, 0, yBottom);
  g.addColorStop(0, shade(cw.top, 0.22));
  g.addColorStop(0.45, shade(cw.top, -0.12));
  g.addColorStop(1, shade(cw.mid, 0.05));
  ctx.fillStyle = g;
  ctx.fillRect(0, yTop, CW, h);

  for (let x = 0; x < CW; x += 9) {
    ctx.fillStyle = rgba("#000000", 0.28);
    ctx.fillRect(x, yTop, 4, h);
    ctx.fillStyle = rgba("#ffffff", 0.2);
    ctx.fillRect(x + 4, yTop, 2, h);
  }

  // the weld line that separates the sealed band from the pouch
  const seam =
    yTop > CH / 2 ? ctx.createLinearGradient(0, yTop - 26, 0, yTop + 8) : ctx.createLinearGradient(0, yBottom + 26, 0, yBottom - 8);
  seam.addColorStop(0, rgba("#05010a", 0));
  seam.addColorStop(1, rgba("#05010a", 0.55));
  ctx.fillStyle = seam;
  if (yTop > CH / 2) ctx.fillRect(0, yTop - 26, CW, 34);
  else ctx.fillRect(0, yBottom - 8, CW, 34);
}

/* ── the printed design ───────────────────────────────────── */

function paintDesign(
  ctx: CanvasRenderingContext2D,
  look: PackArtInput,
  ink: Ink,
  scale: number,
  width: number,
) {
  const cw = look.colorway;
  const cx = width / 2;
  const k = scale;
  const set = look.setName.toUpperCase().replace(/^POKEMON$/, "POKÉMON");

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  if (ink === "color") {
    // recessed seat for the raised emblem
    ctx.save();
    ctx.shadowColor = "rgba(6,1,12,0.6)";
    ctx.shadowBlur = 24 * k;
    ctx.shadowOffsetY = 4 * k;
    shieldPath(ctx, cx, FACE.emblemY * k, FACE.emblemSize * k * 1.01);
    ctx.fillStyle = "rgba(10,3,20,0.4)";
    ctx.fill();
    ctx.restore();

    // keyline around the emblem plate
    shieldPath(ctx, cx, FACE.emblemY * k, FACE.emblemSize * k * 1.12);
    ctx.strokeStyle = rgba(cw.accent, 0.22);
    ctx.lineWidth = Math.max(1, 2 * k);
    ctx.stroke();

    // contact shadow under the metal seal button
    const r = (FACE.buttonSize / 2) * k;
    const halo = ctx.createRadialGradient(cx, FACE.buttonY * k + 5 * k, r * 0.85, cx, FACE.buttonY * k + 5 * k, r * 1.3);
    halo.addColorStop(0, "rgba(6,1,12,0.5)");
    halo.addColorStop(1, "rgba(6,1,12,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, FACE.buttonY * k + 5 * k, r * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // wordmark
  drawWord(ctx, look.wordmark || "RIPS", cx, FACE.wordY * k, FACE.word * k, width * 0.74, ink, cw, 0.015);

  // lower band rule
  const lineColor =
    ink === "mask" ? "rgba(255,255,255,0.85)" : ink === "orm" ? "rgb(255,100,120)" : rgba(cw.accent, 0.5);
  ctx.fillStyle = lineColor;
  ctx.fillRect(width * 0.07, FACE.lineY * k, width * 0.86, Math.max(1, 1.6 * k));

  drawWord(ctx, set, cx, FACE.setY * k, FACE.set * k, width * 0.66, ink, cw, 0.2);
  drawWord(ctx, look.label, cx, FACE.labelY * k, FACE.label * k, width * 0.62, ink, cw, 0.005);

  if (ink === "color") {
    // foil crease where the lower band meets the pouch body
    const gl = ctx.createLinearGradient(0, (FACE.lineY - 10) * k, 0, (FACE.lineY + 26) * k);
    gl.addColorStop(0, "rgba(255,255,255,0)");
    gl.addColorStop(0.3, "rgba(255,255,255,0.07)");
    gl.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = gl;
    ctx.fillRect(0, (FACE.lineY - 10) * k, width, 36 * k);
  }

  ctx.restore();
}

/* ── maps ─────────────────────────────────────────────────── */

function makeAlbedo(look: PackArtInput): HTMLCanvasElement {
  const [canvas, ctx] = surface(CW, CH);
  paintFoil(ctx, look.colorway, seedOf(look.label + look.setName));
  paintCrimp(ctx, 0, FACE.seal, look.colorway);
  paintCrimp(ctx, CH - FACE.seal, CH, look.colorway);
  paintDesign(ctx, look, "color", 1, CW);
  return canvas;
}

function makeOrm(look: PackArtInput): HTMLCanvasElement {
  const s = 0.5;
  const w = Math.round(CW * s);
  const h = Math.round(CH * s);
  const [canvas, ctx] = surface(w, h);

  // r unused, g = roughness, b = metalness
  ctx.fillStyle = "rgb(255,62,250)";
  ctx.fillRect(0, 0, w, h);

  for (let x = 0; x < w; x += 2) {
    const v = x % 4 === 0 ? 74 : 58;
    ctx.fillStyle = `rgb(255,${v},245)`;
    ctx.fillRect(x, 0, 1, h);
  }

  ctx.fillStyle = "rgb(255,54,240)";
  ctx.fillRect(0, 0, w, FACE.seal * s);
  ctx.fillRect(0, h - FACE.seal * s, w, FACE.seal * s);

  // ink sits on top of the film: rougher and less metallic
  paintDesign(ctx, look, "orm", s, w);
  return canvas;
}

function makeHeight(look: PackArtInput): HTMLCanvasElement {
  const s = 0.5;
  const w = Math.round(CW * s);
  const h = Math.round(CH * s);
  const [canvas, ctx] = surface(w, h);

  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, w, h);

  // brushed ribs
  for (let x = 0; x < w; x += 2) {
    const a = x % 4 === 0 ? 0.12 : 0.05;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, 0, 1, h);
  }

  // crimp ridges
  for (let x = 0; x < w; x += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x, 0, 2, FACE.seal * s);
    ctx.fillRect(x, h - FACE.seal * s, 2, FACE.seal * s);
  }

  // printed ink is pressed into the film, so the letters read as raised
  const [mask, mctx] = surface(w, h);
  mctx.fillStyle = "#000000";
  mctx.fillRect(0, 0, w, h);
  paintDesign(mctx, look, "mask", s, w);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.62;
  ctx.filter = `blur(${Math.max(1, 2.2 * s * 2)}px)`;
  ctx.drawImage(mask, 0, 0);
  ctx.restore();

  // the rule above the band is a groove
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(w * 0.07, FACE.lineY * s - 1, w * 0.86, 2);

  return canvas;
}

function heightToNormal(height: HTMLCanvasElement, strength = 2.4): HTMLCanvasElement {
  const w = height.width;
  const h = height.height;
  const src = height.getContext("2d")?.getImageData(0, 0, w, h).data;
  const [canvas, ctx] = surface(w, h);
  if (!src) return canvas;
  const out = ctx.createImageData(w, h);
  const at = (x: number, y: number) => {
    const px = x < 0 ? 0 : x >= w ? w - 1 : x;
    const py = y < 0 ? 0 : y >= h ? h - 1 : y;
    return src[(py * w + px) * 4] / 255;
  };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      let nx = -dx * strength;
      let ny = dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/* A tileable crimp normal for the seal strips: fine vertical ribs. */
let crimpNormalCache: HTMLCanvasElement | null = null;
export function crimpNormalCanvas(): HTMLCanvasElement {
  if (crimpNormalCache) return crimpNormalCache;
  const w = 128;
  const h = 64;
  const [canvas, ctx] = surface(w, h);
  const img = ctx.createImageData(w, h);
  for (let x = 0; x < w; x += 1) {
    const phase = (x / w) * Math.PI * 4;
    const nx = Math.cos(phase) * 0.9;
    for (let y = 0; y < h; y += 1) {
      const i = (y * w + x) * 4;
      const len = Math.hypot(nx, 1);
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = 128;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  crimpNormalCache = canvas;
  return canvas;
}

function texture(canvas: HTMLCanvasElement, srgb: boolean): THREE.Texture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/*
  Authoring a pack's three maps is a full pass over ~1.7M pixels each, and the
  same design gets drawn for the stage, the side packs, the catalogue bake and
  the rip overlay. Cache by look key so it happens once per design, not once
  per mesh — this is what removed multi-second main-thread stalls on the home
  page.
*/
const textureCache = new Map<string, PackTextures>();

export function buildPackTextures(look: PackArtInput): PackTextures {
  if (look.key) {
    const hit = textureCache.get(look.key);
    if (hit) return hit;
  }

  const built: PackTextures = {
    map: texture(makeAlbedo(look), true),
    orm: texture(makeOrm(look), false),
    normal: texture(heightToNormal(makeHeight(look)), false),
  };

  // Shared maps outlive any single model, so disposal must not free them.
  built.map.userData.shared = true;
  built.orm.userData.shared = true;
  built.normal.userData.shared = true;
  if (look.key) textureCache.set(look.key, built);
  return built;
}

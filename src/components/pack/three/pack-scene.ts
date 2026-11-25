/*
  The physical booster pack.

  This is a real mesh, not a picture of one: a pillow-shaped front and back
  joined by a rounded rim, crimped seal strips with genuine ridge geometry,
  and a raised metal shield + domed seal button that sit on the curved film.
  A procedural studio environment gives the metallised film its reflections.
*/

import * as THREE from "three";
import type { PackColorway } from "@/lib/pack-colorways";
import { buildPackTextures, crimpNormalCanvas, type PackArtInput } from "./pack-textures";

export type PackLook = {
  key: string;
  wordmark: string;
  colorway: PackColorway;
  setName: string;
  label: string;
};

/* Pack proportions in world units (0.6 aspect, like a real booster). */
const WIDTH = 1.2;
const HEIGHT = 2.0;
const HALF_W = WIDTH / 2;
const HALF_H = HEIGHT / 2;
const THICKNESS = 0.048;
const CORNER = 0.052;
const BULGE = 0.064;
const SEAL = HEIGHT * 0.075;
const RIBS = 46;

export const CAMERA = { fov: 28, position: [0.22, 0.08, 4.68] as const, lookAt: [0, 0, 0] as const };
export const PACK_ASPECT = WIDTH / HEIGHT;

/** Physical dimensions, also used by the interactive rip. */
export const PACK_DIMS = {
  width: WIDTH,
  height: HEIGHT,
  halfWidth: HALF_W,
  halfHeight: HALF_H,
  thickness: THICKNESS,
  seal: SEAL,
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Distance from the centre to the rounded-rect silhouette along a direction. */
function boundaryDistance(dx: number, dy: number) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  let t = Math.min(ax > 1e-9 ? HALF_W / ax : Infinity, ay > 1e-9 ? HALF_H / ay : Infinity);
  const cx = Math.sign(dx) * (HALF_W - CORNER);
  const cy = Math.sign(dy) * (HALF_H - CORNER);
  const qa = dx * dx + dy * dy;
  const qb = -2 * (dx * cx + dy * cy);
  const qc = cx * cx + cy * cy - CORNER * CORNER;
  const disc = qb * qb - 4 * qa * qc;
  if (disc > 0 && qa > 1e-9) {
    const s = (-qb - Math.sqrt(disc)) / (2 * qa);
    if (s > 0 && Math.abs(s * dx) >= HALF_W - CORNER - 1e-6 && Math.abs(s * dy) >= HALF_H - CORNER - 1e-6) {
      t = Math.min(t, s);
    }
  }
  return t;
}

/** Air pockets and folds trapped under the laminate. */
const POCKETS = [
  { x: -0.31, y: -0.6, r: 0.34, a: 0.0075 },
  { x: 0.33, y: 0.48, r: 0.3, a: 0.0055 },
  { x: 0.15, y: -0.14, r: 0.52, a: 0.0035 },
  { x: -0.42, y: 0.6, r: 0.24, a: 0.004 },
];

/** Height of the film above the pack's mid-plane at a point on the face. */
function relief(x: number, y: number, t: number) {
  const fade = 1 - smoothstep(0.8, 1, t);
  let z = BULGE * Math.pow(Math.max(0, 1 - t * t), 1.15);
  z += 0.0042 * Math.sin(x * 3.1 + 1.3 * Math.sin(y * 2.4)) * fade;
  z += 0.003 * Math.sin(y * 6.4 - x * 2.2 + 0.6) * fade;
  z += 0.0018 * Math.cos(y * 12.5 + x * 4.4) * fade;
  // the vertical fold that runs down each side of a sealed pouch
  z += 0.0055 * Math.exp(-Math.pow((Math.abs(x) - 0.4) / 0.04, 2)) * fade;
  for (const p of POCKETS) {
    z += p.a * Math.exp(-((x - p.x) ** 2 + (y - p.y) ** 2) / (p.r * p.r)) * fade;
  }
  return z;
}

/** Face height in world space, used to seat the emblem and the seal button. */
function surfaceZ(x: number, y: number) {
  const t = clamp01(Math.max(Math.abs(x) / HALF_W, Math.abs(y) / HALF_H));
  return THICKNESS / 2 + relief(x, y, t);
}

/* ── shell ────────────────────────────────────────────────── */

type GridPoint = { x: number; y: number; t: number; u: number; v: number };

export function buildShell() {
  const NX = 64;
  const NY = 106;
  const cols = NX + 1;
  const rows = NY + 1;
  const points: GridPoint[] = [];

  for (let iy = 0; iy < rows; iy += 1) {
    const gy = -1 + (2 * iy) / NY;
    for (let ix = 0; ix < cols; ix += 1) {
      const gx = -1 + (2 * ix) / NX;
      const t = Math.max(Math.abs(gx), Math.abs(gy));
      let x = 0;
      let y = 0;
      if (t > 1e-6) {
        const len = Math.hypot(gx, gy);
        const ux = gx / len;
        const uy = gy / len;
        const r = boundaryDistance(ux, uy) * t;
        x = ux * r;
        y = uy * r;
      }
      points.push({ x, y, t, u: (gx + 1) / 2, v: (gy + 1) / 2 });
    }
  }

  const count = points.length;
  const position = new Float32Array(count * 2 * 3);
  const uv = new Float32Array(count * 2 * 2);
  let p = 0;
  let q = 0;
  for (const side of [1, -1]) {
    for (const point of points) {
      position[p++] = point.x;
      position[p++] = point.y;
      position[p++] = side * (THICKNESS / 2 + relief(point.x, point.y, point.t));
      uv[q++] = point.u;
      uv[q++] = point.v;
    }
  }

  const index: number[] = [];
  for (let side = 0; side < 2; side += 1) {
    const base = side * count;
    for (let iy = 0; iy < NY; iy += 1) {
      for (let ix = 0; ix < NX; ix += 1) {
        const a = base + iy * cols + ix;
        const b = a + 1;
        const c = a + cols + 1;
        const d = a + cols;
        if (side === 0) index.push(a, b, c, a, c, d);
        else index.push(a, c, b, a, d, c);
      }
    }
  }

  const body = new THREE.BufferGeometry();
  body.setAttribute("position", new THREE.BufferAttribute(position, 3));
  body.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  body.setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1));
  body.computeVertexNormals();

  // walk the silhouette once, counter-clockwise, for the rim
  const loop: { x: number; y: number }[] = [];
  for (let iy = 0; iy <= NY; iy += 1) loop.push(points[iy * cols]);
  for (let ix = 1; ix <= NX; ix += 1) loop.push(points[NY * cols + ix]);
  for (let iy = NY - 1; iy >= 0; iy -= 1) loop.push(points[iy * cols + NX]);
  for (let ix = NX - 1; ix >= 1; ix -= 1) loop.push(points[ix]);

  const rimPos = new Float32Array(loop.length * 3 * 3);
  let rp = 0;
  for (const point of loop) {
    for (const ring of [0, 1, 2]) {
      const grow = ring === 1 ? 1.0075 : 1;
      rimPos[rp++] = point.x * grow;
      rimPos[rp++] = point.y * grow;
      rimPos[rp++] = ring === 0 ? THICKNESS / 2 : ring === 2 ? -THICKNESS / 2 : 0;
    }
  }

  const rimIndex: number[] = [];
  for (let i = 0; i < loop.length; i += 1) {
    const j = (i + 1) % loop.length;
    const f0 = i * 3;
    const m0 = f0 + 1;
    const b0 = f0 + 2;
    const f1 = j * 3;
    const m1 = f1 + 1;
    const b1 = f1 + 2;
    rimIndex.push(f0, f1, m1, f0, m1, m0, m0, m1, b1, m0, b1, b0);
  }

  const rim = new THREE.BufferGeometry();
  rim.setAttribute("position", new THREE.BufferAttribute(rimPos, 3));
  rim.setIndex(new THREE.BufferAttribute(new Uint32Array(rimIndex), 1));
  rim.computeVertexNormals();

  return { body, rim };
}

/* ── crimped seal ─────────────────────────────────────────── */

export function buildSeal(top: boolean) {
  const cols = RIBS * 4;
  const rows = 8;
  const perSide = (cols + 1) * (rows + 1);
  const position = new Float32Array(perSide * 2 * 3);
  const uv = new Float32Array(perSide * 2 * 2);
  let p = 0;
  let q = 0;

  for (const side of [1, -1]) {
    for (let j = 0; j <= rows; j += 1) {
      const rv = j / rows;
      for (let i = 0; i <= cols; i += 1) {
        const u = i / cols;
        const x = -HALF_W + u * WIDTH;
        const inner = top ? HALF_H - SEAL : -HALF_H + SEAL;
        const outer = top ? HALF_H + 0.004 : -HALF_H - 0.004;
        let y = inner + (outer - inner) * rv;
        const saw = 0.5 + 0.5 * Math.cos(u * Math.PI * 2 * RIBS * 2);
        y += (top ? -1 : 1) * 0.008 * rv * rv * saw;
        const rib = Math.sin(u * Math.PI * 2 * RIBS);
        const z = side * (THICKNESS / 2 + 0.0035 + 0.0065 * rv + 0.0034 * rib * (0.35 + 0.65 * rv));
        position[p++] = x;
        position[p++] = y;
        position[p++] = z;
        uv[q++] = u * RIBS * 1.0;
        uv[q++] = rv;
      }
    }
  }

  const index: number[] = [];
  const stride = cols + 1;
  for (let side = 0; side < 2; side += 1) {
    const base = side * perSide;
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const a = base + j * stride + i;
        const b = a + 1;
        const c = a + stride + 1;
        const d = a + stride;
        if (side === 0) index.push(a, b, c, a, c, d);
        else index.push(a, c, b, a, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1));
  geometry.computeVertexNormals();
  return geometry;
}

/* ── raised emblem ────────────────────────────────────────── */

function shieldShape(size: number) {
  const k = size / 64;
  const p = (x: number, y: number) => [ (x - 32) * k, (32 - y) * k ] as const;
  const shape = new THREE.Shape();
  const a = p(32, 6);
  const b = p(55, 17);
  const c = p(55, 36);
  const d = p(32, 59);
  const e = p(9, 36);
  const f = p(9, 17);
  const bez = (cp1: readonly number[], cp2: readonly number[], to: readonly number[]) =>
    shape.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], to[0], to[1]);

  shape.moveTo(a[0], a[1]);
  shape.lineTo(b[0], b[1]);
  shape.lineTo(c[0], c[1]);
  bez(p(55, 47), p(45, 55), d);
  bez(p(19, 55), p(9, 47), e);
  shape.lineTo(f[0], f[1]);
  shape.closePath();
  return shape;
}

function crownShapes(size: number) {
  const k = size / 64;
  const p = (x: number, y: number) => [ (x - 32) * k, (32 - y) * k ] as const;
  const crown = new THREE.Shape();
  const pts = [p(20, 40), p(22.5, 24), p(29, 31), p(32, 20), p(35, 31), p(41.5, 24), p(44, 40)];
  crown.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) crown.lineTo(pts[i][0], pts[i][1]);
  crown.closePath();

  const bar = new THREE.Shape();
  const b0 = p(21, 45.6);
  const b1 = p(43, 43);
  bar.moveTo(b0[0], b0[1]);
  bar.lineTo(b1[0], b0[1]);
  bar.lineTo(b1[0], b1[1]);
  bar.lineTo(b0[0], b1[1]);
  bar.closePath();

  return [crown, bar];
}

export function buildEmblem(colorway: PackColorway) {
  const size = WIDTH * 0.305;
  const group = new THREE.Group();

  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shieldShape(size), {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 2,
      curveSegments: 18,
    }),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colorway.accent),
      metalness: 1,
      roughness: 0.24,
      clearcoat: 0.6,
      clearcoatRoughness: 0.24,
      envMapIntensity: 1.6,
    }),
  );
  plate.castShadow = true;

  const crownMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorway.accent).lerp(new THREE.Color("#ffffff"), 0.35),
    metalness: 1,
    roughness: 0.19,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.8,
  });

  for (const shape of crownShapes(size)) {
    const crown = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.007,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 2,
        curveSegments: 12,
      }),
      crownMat,
    );
    crown.position.z = 0.0135;
    crown.castShadow = true;
    group.add(crown);
  }

  group.add(plate);
  return group;
}

/* ── seal button ──────────────────────────────────────────── */

export function buildButton(colorway: PackColorway) {
  const profile = [
    new THREE.Vector2(0, 0.043),
    new THREE.Vector2(0.026, 0.042),
    new THREE.Vector2(0.055, 0.035),
    new THREE.Vector2(0.078, 0.023),
    new THREE.Vector2(0.092, 0.009),
    new THREE.Vector2(0.098, -0.002),
    new THREE.Vector2(0.099, -0.028),
  ];
  const geometry = new THREE.LatheGeometry(profile, 72);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colorway.accent),
      metalness: 1,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.7,
    }),
  );
  mesh.castShadow = true;
  return mesh;
}

/* ── assembly ─────────────────────────────────────────────── */

let crimpTexture: THREE.Texture | null = null;

function getCrimpNormal() {
  if (!crimpTexture) {
    const t = new THREE.CanvasTexture(crimpNormalCanvas());
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    t.userData.shared = true;
    crimpTexture = t;
  }
  return crimpTexture;
}

export type FoilSet = {
  foil: THREE.MeshPhysicalMaterial;
  seal: THREE.MeshPhysicalMaterial;
  rim: THREE.MeshPhysicalMaterial;
};

/** The metallised film, crimp and folded edge, shared by every pack instance. */
export function createFoilSet(look: PackLook): FoilSet {
  const art: PackArtInput = {
    key: look.key,
    wordmark: look.wordmark,
    colorway: look.colorway,
    setName: look.setName,
    label: look.label,
  };
  const textures = buildPackTextures(art);

  const foil = new THREE.MeshPhysicalMaterial({
    map: textures.map,
    roughnessMap: textures.orm,
    metalnessMap: textures.orm,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    metalness: 1,
    roughness: 1,
    clearcoat: 0.22,
    clearcoatRoughness: 0.5,
    envMapIntensity: 1.45,
  });

  const sealMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(look.colorway.top).lerp(new THREE.Color(look.colorway.mid), 0.35),
    metalness: 1,
    roughness: 0.3,
    normalMap: getCrimpNormal(),
    normalScale: new THREE.Vector2(0.7, 0.7),
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
    envMapIntensity: 1.35,
  });

  const rimMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(look.colorway.mid).lerp(new THREE.Color(look.colorway.top), 0.3),
    metalness: 1,
    roughness: 0.26,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    envMapIntensity: 1.3,
  });

  return { foil, seal: sealMaterial, rim: rimMaterial };
}

export function createPackModel(look: PackLook): THREE.Group {
  const { foil, seal: sealMaterial, rim: rimMaterial } = createFoilSet(look);

  const group = new THREE.Group();
  group.name = "booster-pack";

  const { body, rim } = buildShell();
  const shell = new THREE.Mesh(body, foil);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const edge = new THREE.Mesh(rim, rimMaterial);
  edge.castShadow = true;
  edge.receiveShadow = true;
  group.add(edge);

  for (const top of [true, false]) {
    const seal = new THREE.Mesh(buildSeal(top), sealMaterial);
    seal.castShadow = true;
    seal.receiveShadow = true;
    group.add(seal);
  }

  const emblemY = HEIGHT * 0.09;
  const emblem = buildEmblem(look.colorway);
  const dz = 0.06;
  const slope = (surfaceZ(0, emblemY + dz) - surfaceZ(0, emblemY - dz)) / (2 * dz);
  emblem.position.set(0, emblemY, surfaceZ(0, emblemY) - 0.007);
  emblem.rotation.x = Math.atan(slope);
  group.add(emblem);

  const buttonY = -HEIGHT * 0.135;
  const button = buildButton(look.colorway);
  button.position.set(0, buttonY, surfaceZ(0, buttonY) - 0.012);
  button.rotation.x = Math.atan((surfaceZ(0, buttonY + dz) - surfaceZ(0, buttonY - dz)) / (2 * dz));
  group.add(button);

  return group;
}

export function disposePackModel(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        if (value instanceof THREE.Texture && !value.userData.shared) textures.add(value);
      }
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

/* ── studio ───────────────────────────────────────────────── */

export function createStudioLights() {
  const group = new THREE.Group();
  group.name = "studio-lights";

  const key = new THREE.DirectionalLight(0xfff3ea, 3);
  key.position.set(-2.2, 3, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -2.4;
  key.shadow.camera.right = 2.4;
  key.shadow.camera.top = 2.8;
  key.shadow.camera.bottom = -2.8;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 12;
  key.shadow.blurSamples = 16;
  group.add(key);

  const rim = new THREE.DirectionalLight(0xcbb0ff, 2.6);
  rim.position.set(3.4, 1.6, -3);
  group.add(rim);

  // broad frontal fill so the face of the film is never reading as black
  const fill = new THREE.DirectionalLight(0xd7cdf2, 1.15);
  fill.position.set(1.2, -0.4, 4.6);
  group.add(fill);

  group.add(new THREE.AmbientLight(0x6d5c8e, 0.7));
  return group;
}

let equirect: THREE.CanvasTexture | null = null;

function studioEquirect() {
  if (equirect) return equirect;
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#6d6488");
  sky.addColorStop(0.3, "#352d47");
  sky.addColorStop(0.5, "#1d1729");
  sky.addColorStop(0.72, "#110c1a");
  sky.addColorStop(1, "#090610");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const box = (x: number, y: number, w: number, h: number, color: string, blur: number, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  };

  // the studio wall: a broad horizon panel that every frontal surface mirrors
  box(0, 192, W, 168, "#cfc4e8", 52, 0.5);
  // large key softbox, upper left
  box(60, 30, 340, 200, "#ffffff", 34, 1);
  // tall left panel, gives the foil a clean vertical reflection
  box(104, 150, 118, 250, "#ffffff", 26, 0.6);
  // overhead strip
  box(300, 4, 580, 30, "#f8f3ff", 13, 0.9);
  // right rim light
  box(858, 60, 60, 320, "#ffffff", 18, 0.95);
  // cool fill from the far left
  box(0, 140, 44, 220, "#cabbef", 22, 0.6);
  // violet bounce off the table
  box(200, 444, 640, 68, "#6c3cff", 46, 0.45);
  // hot spots for tight specular glints on the seals and emblem
  box(688, 116, 22, 22, "#ffffff", 9, 1);
  box(432, 168, 14, 14, "#ffffff", 6, 0.85);

  equirect = new THREE.CanvasTexture(canvas);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.colorSpace = THREE.SRGBColorSpace;
  equirect.userData.shared = true;
  return equirect;
}

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

export function getStudioEnv(renderer: THREE.WebGLRenderer) {
  const cached = envCache.get(renderer);
  if (cached) return cached;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(studioEquirect());
  envCache.set(renderer, target.texture);
  pmrem.dispose();
  return target.texture;
}

export function applyStudio(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  scene.environment = getStudioEnv(renderer);
  scene.environmentIntensity = 1.15;
}

export function createShadowCatcher() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.ShadowMaterial({ color: 0x05010a, opacity: 0.42, transparent: true }),
  );
  mesh.position.set(0, 0, -0.85);
  mesh.receiveShadow = true;
  return mesh;
}

export function packSize() {
  return { width: WIDTH, height: HEIGHT, aspect: PACK_ASPECT };
}

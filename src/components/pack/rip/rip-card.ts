"use client";

/*
  3D card, rarity ribbon and reveal particles.

  The card is a real slab: a bevelled core with printed faces, iridescent
  laminate and a holographic sheen that moves as it turns.
*/

import * as THREE from "three";
import type { Rarity } from "@/lib/domain";
import { rarityVisual } from "@/lib/rarity-visuals";
import { reelTexture } from "./card-textures";

const CARD_W = 0.66;
const CARD_H = 0.92;
const CORNER = 0.034;

function roundedRect(w: number, h: number, r: number) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function faceGeometry() {
  const geometry = new THREE.ShapeGeometry(roundedRect(CARD_W, CARD_H, CORNER), 14);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(i, (position.getX(i) + CARD_W / 2) / CARD_W, (position.getY(i) + CARD_H / 2) / CARD_H);
  }
  uv.needsUpdate = true;
  return geometry;
}

export type CardAssets = {
  group: THREE.Group;
  front: THREE.Mesh;
  back: THREE.Mesh;
  /**
   * The card is printed with the house back on BOTH faces until the reveal, so
   * no camera angle, spin or reflection can leak the artwork early. Swapping
   * the map keeps the same geometry and lighting.
   */
  setFace: (revealed: boolean) => void;
  dispose: () => void;
};

export function createCard(frontMap: THREE.Texture, backMap: THREE.Texture): CardAssets {
  const group = new THREE.Group();
  group.name = "pull-card";

  const core = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(CARD_W, CARD_H, CORNER), {
      depth: 0.004,
      bevelEnabled: true,
      bevelThickness: 0.0018,
      bevelSize: 0.0018,
      bevelSegments: 2,
      curveSegments: 14,
    }),
    new THREE.MeshStandardMaterial({ color: 0x1b1026, roughness: 0.48, metalness: 0.55 }),
  );
  core.position.z = -0.002;
  group.add(core);

  const face = faceGeometry();

  // Printed card, not a mirror: the art has to stay readable, with only a
  // whisper of laminate sheen so the holo reads when the card turns.
  const frontMaterial = new THREE.MeshPhysicalMaterial({
      map: frontMap,
      roughness: 0.56,
      metalness: 0.02,
      clearcoat: 0.28,
      clearcoatRoughness: 0.42,
      iridescence: 0.16,
      iridescenceIOR: 1.32,
      iridescenceThicknessMinimum: 140,
      iridescenceThicknessMaximum: 380,
      envMapIntensity: 0.42,
  });
  const front = new THREE.Mesh(face, frontMaterial);
  front.position.z = 0.0056;
  group.add(front);

  const back = new THREE.Mesh(
    face,
    new THREE.MeshPhysicalMaterial({
      map: backMap,
      roughness: 0.4,
      metalness: 0.28,
      clearcoat: 0.55,
      clearcoatRoughness: 0.26,
      iridescence: 0.12,
      iridescenceIOR: 1.3,
      iridescenceThicknessMinimum: 140,
      iridescenceThicknessMaximum: 420,
      envMapIntensity: 0.75,
    }),
  );
  back.position.z = -0.0056;
  back.rotation.y = Math.PI;
  group.add(back);

  // Starts face-down: the back is printed on both sides until the reveal.
  let revealed = false;
  frontMaterial.map = backMap;
  frontMaterial.needsUpdate = true;
  const setFace = (showFront: boolean) => {
    if (showFront === revealed) return;
    revealed = showFront;
    frontMaterial.map = revealed ? frontMap : backMap;
    frontMaterial.needsUpdate = true;
  };

  return {
    group,
    front,
    back,
    setFace,
    dispose: () => {
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const material of list) material.dispose();
      });
      frontMap.dispose();
      backMap.dispose();
    },
  };
}

/* ── roulette ribbon ──────────────────────────────────────── */

export type Reel = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  opacity: { value: number };
  texture: THREE.Texture;
  count: number;
  visible: number;
  landIndex: number;
  centerOffset: (index: number) => number;
};

export function createReel(bands: Rarity[]): Reel {
  const { texture, count } = reelTexture(bands);
  // Five bands fill the ribbon window, so the centred band lines up with the
  // card and the neighbouring rarities stay legible above and below it.
  const visible = 5;
  texture.repeat.set(1, visible / count);
  texture.wrapT = THREE.RepeatWrapping;

  const opacity = { value: 0 };
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uReelOpacity = opacity;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vReelUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvReelUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uReelOpacity;\nvarying vec2 vReelUv;")
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
         float reelMask = smoothstep(0.0, 0.24, vReelUv.y) * smoothstep(1.0, 0.76, vReelUv.y);
         gl_FragColor.a *= reelMask * uReelOpacity;`,
      );
  };
  material.customProgramCacheKey = () => "reel-ribbon";

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.2), material);
  mesh.position.set(0, 0, -1.15);

  /*
    Where to set texture.offset.y so band `index` sits in the middle of the
    ribbon window.

    The canvas texture is uploaded with flipY (the default), so texture V runs
    bottom-up against the drawn band order: the row sampled at V is
    (1 - V) * count. Ignoring that made every draw land on the mirrored band —
    which is index 1.5 of 32, i.e. always Uncommon, whatever card was pulled.
    Solving (1 - (0.5 * repeat + offset)) * count - visible / 2 = index + 0.5
    for offset gives the expression below. The reel has one band of tail after
    the landing band, so wrapping the window past the end is expected.
  */
  const centerOffset = (index: number) =>
    ((1 - (index + 0.5) / count - visible / (2 * count)) % 1 + 1) % 1;

  return {
    mesh,
    material,
    opacity,
    texture,
    count,
    visible,
    landIndex: bands.length - 2,
    centerOffset,
  };
}

/* ── reveal particles ─────────────────────────────────────── */

export type Burst = {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  progress: { value: number };
  color: { value: THREE.Color };
  dispose: () => void;
};

export function createBurst(count: number): Burst {
  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.16 + Math.random() * 0.34;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius * 1.1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.12;

    const spread = 0.55 + Math.random() * 0.45;
    directions[i * 3] = Math.cos(angle) * spread;
    directions[i * 3 + 1] = Math.sin(angle) * spread + 0.25;
    directions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

    speeds[i] = 0.25 + Math.random() * 0.9;
    sizes[i] = 0.6 + Math.random() * 1.9;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aDir", new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const progress = { value: 0 };
  const color = { value: new THREE.Color("#ffffff") };

  const material = new THREE.ShaderMaterial({
    uniforms: { uProgress: progress, uColor: color, uPixelRatio: { value: 1.5 } },
    vertexShader: `
      attribute vec3 aDir;
      attribute float aSpeed;
      attribute float aSize;
      uniform float uProgress;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        float p = uProgress;
        vec3 pos = position + aDir * aSpeed * p * 3.0;
        pos.y -= p * p * 0.9;
        vAlpha = clamp(1.0 - p * 1.15, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * uPixelRatio * (160.0 / max(0.2, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float alpha = smoothstep(0.5, 0.0, length(d)) * vAlpha;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    material,
    progress,
    color,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

export function setBurstColor(burst: Burst, tier: Rarity) {
  const visual = rarityVisual(tier);
  burst.color.value.set(visual.color);
}

export function cardSize() {
  return { width: CARD_W, height: CARD_H };
}

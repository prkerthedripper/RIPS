"use client";

/*
  Off-screen product renders for the small pack thumbnails.

  The catalogue shows up to a dozen packs at once; a WebGL context per tile
  would be wasteful. Instead one shared renderer bakes the same 3D model to a
  cached image, so tiles stay pixel-identical to the live pack on the stage.
*/

import * as THREE from "three";
import {
  CAMERA,
  applyStudio,
  createPackModel,
  createShadowCatcher,
  createStudioLights,
  disposePackModel,
  type PackLook,
} from "./pack-scene";
import { ensurePackFonts } from "./pack-textures";

const W = 620;
const H = 1033;

type Studio = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
};

let studio: Studio | null = null;
let broken = false;

function getStudio(): Studio | null {
  if (studio) return studio;
  if (broken || typeof window === "undefined") return null;
  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA.fov, W / H, 0.1, 40);
    camera.position.set(CAMERA.position[0], CAMERA.position[1], CAMERA.position[2]);
    camera.lookAt(0, 0, 0);

    applyStudio(renderer, scene);
    scene.add(createStudioLights());
    scene.add(createShadowCatcher());

    studio = { renderer, scene, camera };
    return studio;
  } catch {
    broken = true;
    return null;
  }
}

export async function bakePackImage(look: PackLook): Promise<string | null> {
  const s = getStudio();
  if (!s) return null;
  await ensurePackFonts();

  const model = createPackModel(look);
  model.rotation.set(0.05, -0.13, 0);
  s.scene.add(model);
  try {
    s.renderer.render(s.scene, s.camera);
    const url = s.renderer.domElement.toDataURL("image/webp", 0.94);
    return url.startsWith("data:image") ? url : null;
  } catch {
    return null;
  } finally {
    s.scene.remove(model);
    disposePackModel(model);
  }
}

const images = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

export function getPackStill(look: PackLook): Promise<string | null> {
  if (images.has(look.key)) return Promise.resolve(images.get(look.key) ?? null);
  const running = pending.get(look.key);
  if (running) return running;

  const task = queue
    .then(() => bakePackImage(look))
    .then((url) => {
      images.set(look.key, url);
      pending.delete(look.key);
      return url;
    })
    .catch(() => {
      images.set(look.key, null);
      pending.delete(look.key);
      return null;
    });

  pending.set(look.key, task);
  queue = task;
  return task;
}

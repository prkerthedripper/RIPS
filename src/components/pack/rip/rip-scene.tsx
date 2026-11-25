"use client";

/*
  The cinematic rip, in 3D.

  One canvas runs the whole sequence: the pack you tear, the card that slides
  out of the opening, the rarity ribbon, the reveal and its particles. The
  pointer drives the tear front directly; every other motion is choreographed
  from the phase clock.
*/

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Rarity } from "@/lib/domain";
import { rarityVisual, rouletteBands } from "@/lib/rarity-visuals";
import {
  PACK_DIMS,
  applyStudio,
  createShadowCatcher,
  createStudioLights,
  type PackLook,
} from "../three/pack-scene";
import { TEAR_Y, createRipPack, type RipPack } from "./rip-pack";
import { createBurst, createCard, createReel, setBurstColor, type Burst, type CardAssets } from "./rip-card";
import { cardBackTexture, loadCardFront } from "./card-textures";
import type { RipAudio } from "./audio";

export type RipPhase =
  | "intro"
  | "tearing"
  | "committing"
  | "opening"
  | "emerging"
  | "roulette"
  | "landed"
  | "reveal"
  | "result";

export type RipControl = {
  front: number;
  dragging: boolean;
  speed: number;
  keyboard: boolean;
};

export const RIP_PHASE_MS: Record<string, number> = {
  opening: 1000,
  emerging: 1500,
  roulette: 4000,
  landed: 1600,
  reveal: 950,
};

const HALF_W = PACK_DIMS.halfWidth;
const GRAB_MIN_Y = TEAR_Y - 0.08;

const clamp = THREE.MathUtils.clamp;
const easeOutCubic = (p: number) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
const easeInOutCubic = (p: number) => {
  const t = clamp(p, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

type SceneProps = {
  look: PackLook;
  phase: RipPhase;
  phaseStart: number;
  tier: Rarity;
  cardImage: string;
  cardName: string;
  control: { current: RipControl };
  audio: RipAudio;
  onGrab: () => void;
  onTearComplete: () => void;
  onInteract: (active: boolean) => void;
};

function Scene({
  look,
  phase,
  phaseStart,
  tier,
  cardImage,
  cardName,
  control,
  audio,
  onGrab,
  onTearComplete,
  onInteract,
}: SceneProps) {
  const { camera, gl, scene } = useThree();
  const packRef = useRef<THREE.Group>(null);
  const cardRef = useRef<THREE.Group>(null);
  const reelRef = useRef<THREE.Mesh>(null);
  const burstRef = useRef<THREE.Points>(null);
  const rarityLight = useRef<THREE.PointLight>(null);
  const grabGlow = useRef<THREE.Mesh>(null);

  const pack = useMemo<RipPack>(() => createRipPack(look), [look]);
  const reel = useMemo(() => createReel(rouletteBands(tier)), [tier]);
  const burst = useMemo<Burst>(() => createBurst(rarityVisual(tier).particles), [tier]);
  const [card, setCard] = useState<CardAssets | null>(null);
  const lights = useMemo(() => createStudioLights(), []);
  const catcher = useMemo(() => createShadowCatcher(), []);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const grabRef = useRef(onGrab);
  grabRef.current = onGrab;
  const completeRef = useRef(onTearComplete);
  completeRef.current = onTearComplete;
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;

  const clip = useRef({ peel: 0, shake: 0, completed: false, autoFinish: false });
  const camBase = useRef(new THREE.Vector3(0.2, 0.08, 4.95));
  const pointerPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    applyStudio(gl, scene);
    burst.material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  }, [burst, gl, scene]);

  useEffect(() => {
    return () => pack.dispose();
  }, [pack]);

  useEffect(() => {
    return () => {
      reel.mesh.geometry.dispose();
      reel.material.dispose();
      reel.texture.dispose();
    };
  }, [reel]);

  useEffect(() => {
    return () => burst.dispose();
  }, [burst]);

  useEffect(() => {
    setBurstColor(burst, tier);
  }, [burst, tier]);

  // Load the real card artwork ahead of the reveal.
  useEffect(() => {
    if (!cardImage) return undefined;
    let alive = true;
    let made: CardAssets | null = null;
    (async () => {
      const back = cardBackTexture();
      const front = await loadCardFront(cardImage, cardName, tier);
      if (!alive) {
        back.dispose();
        front.dispose();
        return;
      }
      made = createCard(front, back);
      setCard(made);
    })();
    return () => {
      alive = false;
      made?.dispose();
    };
  }, [cardImage, cardName, tier]);

  // ── pointer rip ────────────────────────────────────────────
  useEffect(() => {
    const el = gl.domElement;
    const tmp = new THREE.Vector3();

    const toPack = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(pointerPlane, tmp)) return null;
      packRef.current?.worldToLocal(tmp);
      return tmp;
    };

    const inGrabZone = (point: THREE.Vector3) =>
      point.y > GRAB_MIN_Y && point.y < PACK_DIMS.halfHeight + 0.12 && Math.abs(point.x) < HALF_W + 0.08;

    const overGrabZone = (event: PointerEvent) => {
      const point = toPack(event);
      if (!point) return false;
      return inGrabZone(point);
    };

    const onDown = (event: PointerEvent) => {
      if (phaseRef.current !== "intro" && phaseRef.current !== "tearing") return;
      if (control.current.keyboard) return;
      const point = toPack(event);
      if (!point || !inGrabZone(point)) return;
      event.preventDefault();
      el.setPointerCapture?.(event.pointerId);
      control.current.dragging = true;
      // the tear always begins near the sealed left edge, under the pinch
      control.current.front = Math.max(control.current.front, Math.min(point.x, -HALF_W + 0.38));
      clip.current.completed = false;
      clip.current.autoFinish = false;
      grabRef.current();
      audioRef.current.grab();
      audioRef.current.startTear();
      interactRef.current(true);
    };

    const onMove = (event: PointerEvent) => {
      if (!control.current.dragging) {
        el.style.cursor = overGrabZone(event) && (phaseRef.current === "intro" || phaseRef.current === "tearing") ? "grab" : "default";
        return;
      }
      el.style.cursor = "grabbing";
      const point = toPack(event);
      if (!point) return;
      const next = clamp(point.x, control.current.front, HALF_W);
      control.current.speed = Math.abs(next - control.current.front) * 18;
      control.current.front = next;
      audioRef.current.updateTear((next + HALF_W) / (HALF_W * 2), control.current.speed);
    };

    const onUp = (event: PointerEvent) => {
      if (!control.current.dragging) return;
      control.current.dragging = false;
      control.current.speed = 0;
      el.style.cursor = "grab";
      audioRef.current.stopTear();
      try {
        el.releasePointerCapture?.(event.pointerId);
      } catch {
        /* ignore */
      }
      interactRef.current(false);
      // A pull that lands close enough opens the pack: the foil finishes the
      // last few centimetres itself instead of stranding the user mid-tear.
      if (!clip.current.completed && control.current.front > -HALF_W * 0.4) {
        clip.current.autoFinish = true;
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [camera, control, gl, ndc, pointerPlane, raycaster]);

  const tickRef = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;
    const t = (performance.now() - phaseStart) / 1000;
    const phaseNow = phaseRef.current;
    const tearing = phaseNow === "intro" || phaseNow === "tearing" || phaseNow === "committing";

    // keyboard tearing, and the finishing pull after a short drag
    if (tearing && !control.current.dragging && (control.current.keyboard || clip.current.autoFinish)) {
      control.current.front = Math.min(HALF_W, control.current.front + dt * 1.35);
    }
    if (tearing && !clip.current.completed && control.current.front >= HALF_W - 0.025) {
      control.current.front = HALF_W;
      clip.current.completed = true;
      completeRef.current();
    }

    const progress = (control.current.front + HALF_W) / (HALF_W * 2);
    pack.uniforms.uFront.value = control.current.front;
    const peelGoal =
      phaseNow === "opening" || phaseNow === "emerging" || phaseNow === "roulette" || phaseNow === "landed" || phaseNow === "reveal" || phaseNow === "result"
        ? 1
        : easeOutCubic(clamp((progress - 0.03) / 0.9, 0, 1)) * 0.94;
    clip.current.peel += (peelGoal - clip.current.peel) * Math.min(1, dt * 7);
    pack.uniforms.uPeel.value = clip.current.peel;

    // pack body motion
    const packGroup = packRef.current;
    if (packGroup) {
      if (tearing) {
        const settle = phaseNow === "intro" ? 1 : 0;
        packGroup.position.y += ((settle ? Math.sin(elapsed * 0.55) * 0.02 : 0) - packGroup.position.y) * Math.min(1, dt * 4);
        packGroup.rotation.y += ((-0.04 * settle + Math.sin(elapsed * 0.27) * 0.02 * settle) - packGroup.rotation.y) * Math.min(1, dt * 4);
        packGroup.rotation.x += ((0.04 * settle) - packGroup.rotation.x) * Math.min(1, dt * 4);
        packGroup.scale.setScalar(1);
      } else {
        const sink = phaseNow === "opening" ? easeInOutCubic(clamp(t / 1.05, 0, 1)) : 1;
        packGroup.position.y = -2.9 * sink;
        packGroup.position.z = -1.6 * sink;
        packGroup.rotation.x = -0.12 * sink;
        packGroup.scale.setScalar(1 - 0.1 * sink);
      }
    }

    // grab affordance
    if (grabGlow.current) {
      const mat = grabGlow.current.material as THREE.MeshBasicMaterial;
      const show = phaseNow === "intro" && !control.current.dragging;
      mat.opacity += ((show ? 0.32 + Math.sin(elapsed * 2.4) * 0.12 : 0) - mat.opacity) * Math.min(1, dt * 6);
      grabGlow.current.visible = mat.opacity > 0.01;
    }

    // card choreography
    if (cardRef.current) {
      const node = cardRef.current;
      // Artwork only exists on the card from the flip onwards.
      card?.setFace(phaseNow === "reveal" || phaseNow === "result");
      const baseScale = 0.62;
      if (tearing) {
        node.position.set(0, TEAR_Y - 0.3, -0.015);
        node.rotation.set(0, Math.PI, 0);
        node.scale.setScalar(baseScale);
        node.visible = true;
      } else if (phaseNow === "opening") {
        const p = easeInOutCubic(clamp(t / 1, 0, 1));
        node.position.set(0, TEAR_Y - 0.3 + p * 0.42, -0.015 + p * 0.06);
        node.rotation.set(0, Math.PI, 0);
        node.scale.setScalar(baseScale + p * 0.08);
      } else if (phaseNow === "emerging") {
        const p = easeOutCubic(clamp(t / (RIP_PHASE_MS.emerging / 1000), 0, 1));
        node.position.set(0, TEAR_Y + 0.12 + p * (0.06 - (TEAR_Y + 0.12)), -0.0 + p * 0.64);
        node.rotation.set(-0.12 * (1 - p), Math.PI + 0.3 * (1 - p), 0);
        node.scale.setScalar(baseScale + 0.08 + p * (1 - baseScale - 0.08));
      } else if (phaseNow === "roulette") {
        const p = clamp(t / (RIP_PHASE_MS.roulette / 1000), 0, 1);
        const spin = easeOutCubic(p) * Math.PI * 12;
        node.position.set(0, 0.06 + Math.sin(elapsed * 1.3) * 0.012, 0.64);
        node.rotation.set(Math.sin(elapsed * 0.9) * 0.04, Math.PI - spin, Math.sin(elapsed * 0.7) * 0.02);
        node.scale.setScalar(1);
        // ribbon
        const start = reel.centerOffset(reel.landIndex) + 3;
        const target = reel.centerOffset(reel.landIndex);
        reel.texture.offset.y = start + (target - start) * easeOutCubic(p);
        const bandP = (1 - Math.pow(1 - p, 3)) * 24;
        if (bandP - tickRef.current >= 1) {
          tickRef.current = bandP;
          audioRef.current.tick(Math.floor(bandP));
        }
        if (reelRef.current) {
          reel.opacity.value = Math.min(1, reel.opacity.value + dt * 4);
          reelRef.current.visible = true;
        }
      } else if (phaseNow === "landed") {
        const hit = Math.exp(-t * 7);
        node.position.set(0, 0.06 + Math.sin(elapsed * 1.2) * 0.008 + hit * Math.sin(t * 46) * 0.012, 0.64);
        node.rotation.set(hit * Math.sin(t * 40) * 0.03, Math.PI, 0);
        node.scale.setScalar(1 + hit * 0.035);
        if (reelRef.current) {
          reel.texture.offset.y = reel.centerOffset(reel.landIndex);
          // Hold the landed band dimmed behind the card through the pause, so
          // the spinner visibly stops on the rarity that was actually drawn.
          const settled = reel.opacity.value - dt * 1.6;
          reel.opacity.value = Math.max(0.42, settled);
          reelRef.current.visible = true;
        }
        clip.current.shake = hit;
      } else if (phaseNow === "reveal" || phaseNow === "result") {
        const p = phaseNow === "reveal" ? easeInOutCubic(clamp(t / 0.85, 0, 1)) : 1;
        node.position.set(0, 0.04 + Math.sin(elapsed * 0.9) * 0.012, 0.66 + p * 0.08);
        node.rotation.set(0, Math.PI + Math.PI * p, 0);
        node.scale.setScalar(1 + p * 0.1);
        if (reelRef.current) {
          reel.opacity.value = Math.max(0, reel.opacity.value - dt * 2.4);
          reelRef.current.visible = reel.opacity.value > 0.01;
        }
        if (phaseNow === "reveal") {
          node.visible = true;
          burst.progress.value = clamp(t / 1.9, 0, 1.4);
          if (burstRef.current) burstRef.current.visible = true;
        }
      }
      node.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = phaseNow === "emerging" || phaseNow === "roulette";
        }
      });
    }

    // rarity light
    if (rarityLight.current) {
      const visual = rarityVisual(tier);
      rarityLight.current.color.set(visual.color);
      const lit = phaseNow === "reveal" || phaseNow === "result" ? 1 : phaseNow === "landed" ? 0.55 : 0;
      rarityLight.current.intensity += (lit * 6.5 - rarityLight.current.intensity) * Math.min(1, dt * 4);
    }

    // camera
    let targetZ = 4.95;
    let targetY = 0.08;
    let targetX = 0.18;
    switch (phaseNow) {
      case "tearing":
        targetZ = 4.55;
        targetX = 0.06;
        targetY = 0.04;
        break;
      case "committing":
        targetZ = 4.55;
        targetX = 0.06;
        targetY = 0.04;
        break;
      case "opening":
        targetZ = 4.15;
        targetX = 0;
        targetY = 0.04;
        break;
      case "emerging":
        targetZ = 3.7;
        targetX = 0;
        targetY = 0.02;
        break;
      case "roulette":
        targetZ = 3.3;
        targetX = 0;
        targetY = 0;
        break;
      case "landed":
        targetZ = 3.12;
        targetX = 0;
        targetY = 0;
        break;
      case "reveal":
        targetZ = 2.98;
        targetX = 0;
        targetY = 0.02;
        break;
      case "result":
        targetZ = 3.04;
        targetX = 0;
        targetY = 0.02;
        break;
      default:
        break;
    }
    const k = Math.min(1, dt * 2.6);
    camBase.current.x += (targetX - camBase.current.x) * k;
    camBase.current.y += (targetY - camBase.current.y) * k;
    camBase.current.z += (targetZ - camBase.current.z) * k;

    const shake = phaseNow === "landed" ? Math.exp(-t * 7) * 0.05 : clip.current.shake * 0.02;
    camera.position.set(
      camBase.current.x + Math.sin(t * 140) * shake,
      camBase.current.y + Math.cos(t * 113) * shake * 0.7,
      camBase.current.z,
    );
    camera.lookAt(0, phaseNow === "intro" || tearing ? 0.12 : 0.02, 0);
  });

  return (
    <>
      <primitive object={lights} />
      <primitive object={catcher} />
      <pointLight ref={rarityLight} position={[0, 0, 2.2]} intensity={0} distance={8} color="#ffffff" />
      <group ref={packRef}>
        <primitive object={pack.group} />
        <mesh ref={grabGlow} position={[0, TEAR_Y + 0.16, 0.088]} visible={false}>
          <planeGeometry args={[1.16, 0.18]} />
          <meshBasicMaterial color="#f4e8ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {card ? (
        <group ref={cardRef}>
          <primitive object={card.group} />
        </group>
      ) : null}
      <primitive object={reel.mesh} ref={reelRef} visible={false} />
      <primitive object={burst.points} ref={burstRef} visible={false} position={[0, 0.04, 0.9]} />
    </>
  );
}

export function RipCanvas(props: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 30, position: [0.18, 0.08, 4.95], near: 0.1, far: 40 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none" }}
      onCreated={({ gl, scene }) => {
        applyStudio(gl, scene);
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}

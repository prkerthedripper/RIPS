"use client";

/*
  Live pack: a real WebGL scene with a soft studio key, a rim light and a
  procedural environment. The pack floats, breathes and follows the pointer
  by a few degrees, which is what makes the foil read as a physical object.
*/

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
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

const BASE_PITCH = 0.05;
const BASE_YAW = -0.13;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function CameraSetup() {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.position.set(CAMERA.position[0], CAMERA.position[1], CAMERA.position[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function Rig({ model, interactive }: { model: THREE.Group; interactive: boolean }) {
  const node = useRef<THREE.Group>(null);
  const gl = useThree((state) => state.gl);
  const target = useRef(new THREE.Vector2(0, 0));
  const eased = useRef(new THREE.Vector2(0, 0));
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!interactive) return;
    const element = gl.domElement;
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      target.current.set(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
    };
    const onLeave = () => target.current.set(0, 0);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("pointercancel", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      element.removeEventListener("pointercancel", onLeave);
    };
  }, [gl, interactive]);

  useFrame((state, delta) => {
    const group = node.current;
    if (!group) return;
    eased.current.lerp(target.current, Math.min(1, Math.max(delta, 0) * 4.2));

    if (reduced) {
      group.rotation.set(BASE_PITCH, BASE_YAW, 0);
      group.position.set(0, 0, 0);
      return;
    }

    const t = state.clock.elapsedTime;
    const px = eased.current.x;
    const py = eased.current.y;

    group.rotation.set(
      BASE_PITCH - py * 0.1 + Math.sin(t * 0.37) * 0.014,
      BASE_YAW - px * 0.17 + Math.sin(t * 0.27) * 0.026,
      Math.sin(t * 0.21) * 0.007 + px * 0.018,
    );
    group.position.set(px * 0.03, Math.sin(t * 0.6) * 0.018 + py * 0.014, 0);
  });

  return (
    <group ref={node}>
      <primitive object={model} />
    </group>
  );
}

/** One soft shadow is all this pack needs; freeze it after the first frames. */
function ShadowSettle() {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 2) gl.shadowMap.autoUpdate = false;
  });
  return null;
}

function PackScene({ look, interactive }: { look: PackLook; interactive: boolean }) {
  const lights = useMemo(() => createStudioLights(), []);
  const catcher = useMemo(() => createShadowCatcher(), []);
  const model = useMemo(() => createPackModel(look), [look]);

  useEffect(() => {
    return () => {
      disposePackModel(model);
    };
  }, [model]);

  return (
    <>
      <CameraSetup />
      <primitive object={lights} />
      <primitive object={catcher} />
      <Rig model={model} interactive={interactive} />
      <ShadowSettle />
    </>
  );
}

export function PackCanvas({
  look,
  interactive = true,
  className = "",
}: {
  look: PackLook;
  interactive?: boolean;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);

  // Fonts first, then wait for idle: authoring the foil textures is the most
  // expensive work on the page and it must never delay the first paint.
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const start = () => {
      if (alive) setReady(true);
    };
    ensurePackFonts()
      .catch(() => undefined)
      .then(() => {
        const idle = window.requestIdleCallback;
        if (typeof idle === "function") idle(start, { timeout: 1200 });
        else timer = window.setTimeout(start, 120);
      });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  // The pack box is sized by CSS; measure it so the drawing buffer matches the
  // device pixels of the slot instead of the canvas default of 300 x 150.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width <= 0 || height <= 0) return;
      setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`pack-frame ${className}`} ref={frame}>
      {ready && box.width > 0 && box.height > 0 ? (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{
            fov: CAMERA.fov,
            position: [CAMERA.position[0], CAMERA.position[1], CAMERA.position[2]],
            near: 0.1,
            far: 40,
          }}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          style={{ width: box.width, height: box.height, background: "transparent", touchAction: "pan-y" }}
          onCreated={({ gl, scene }) => {
            applyStudio(gl, scene);
          }}
        >
          <PackScene look={look} interactive={interactive} />
        </Canvas>
      ) : (
        <span
          className="pack-mesh-placeholder"
          style={{
            background: `radial-gradient(120% 70% at 38% 12%, rgba(255,255,255,0.16), transparent 62%), linear-gradient(170deg, ${look.colorway.top}, ${look.colorway.mid} 46%, ${look.colorway.bottom})`,
          }}
        />
      )}
    </div>
  );
}

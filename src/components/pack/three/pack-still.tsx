"use client";

import { useEffect, useState } from "react";
import { getPackStill } from "./pack-bake";
import type { PackLook } from "./pack-scene";

/*
  Baked pack art for thumbnails: the same model, camera and lighting as the
  live stage, rendered once and cached.
*/

export function PackStill({ look }: { look: PackLook }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    getPackStill(look)
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [look]);

  if (!src) {
    return (
      <span
        className="pack-mesh-placeholder"
        style={{
          background: `radial-gradient(120% 70% at 38% 12%, rgba(255,255,255,0.18), transparent 62%), linear-gradient(170deg, ${look.colorway.top}, ${look.colorway.mid} 46%, ${look.colorway.bottom})`,
        }}
      />
    );
  }

  return <img src={src} alt="" className="pack-mesh-img" draggable={false} />;
}

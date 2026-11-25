"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { COLORWAYS, colorwayFor, type PackColorway } from "@/lib/pack-colorways";
import type { PackLook } from "@/components/pack/three/pack-scene";

export { COLORWAYS, colorwayFor, type PackColorway };

/*
  Pack artwork.

  A real 3D booster: pillowed metallised film with crimped seals, a raised
  shield emblem and a domed seal, lit by a studio environment. One large pack
  renders live so it floats; everything else uses the same model baked to a
  cached image.

  Both renderers pull in three.js, so they are loaded as separate chunks: the
  page paints immediately and the artwork pops in a beat later instead of
  blocking first paint behind the whole 3D stack.
*/

const PackCanvas = dynamic(() => import("@/components/pack/three/pack-canvas").then((m) => m.PackCanvas), {
  ssr: false,
});
const PackStill = dynamic(() => import("@/components/pack/three/pack-still").then((m) => m.PackStill), {
  ssr: false,
});

const WIDTHS: Record<string, number> = { xs: 76, sm: 128, md: 196, lg: 248, xl: 300 };

export function PackArt({
  name = "RIPS",
  setName = "Pokemon",
  label = "Basic Pack",
  colorway = "plum",
  size = "md",
  live,
  className = "",
}: {
  name?: string;
  setName?: string;
  label?: string;
  colorway?: PackColorway | keyof typeof COLORWAYS;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Force the live renderer on or off. Defaults to live for large packs. */
  live?: boolean;
  className?: string;
}) {
  const cw = typeof colorway === "string" ? COLORWAYS[colorway] ?? COLORWAYS.plum : colorway;

  const look = useMemo<PackLook>(
    () => ({
      key: [name, setName, label, cw.top, cw.mid, cw.bottom, cw.accent].join("|"),
      wordmark: name,
      colorway: cw,
      setName,
      label,
    }),
    [name, setName, label, cw],
  );

  const isLive = live ?? (size === "md" || size === "lg" || size === "xl");

  return (
    <div
      className={`pack-art ${className}`}
      style={{ width: WIDTHS[size] ?? WIDTHS.md, aspectRatio: "0.6" }}
      aria-hidden="true"
    >
      {isLive ? <PackCanvas look={look} /> : <PackStill look={look} />}
    </div>
  );
}

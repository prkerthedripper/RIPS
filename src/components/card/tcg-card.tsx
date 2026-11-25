"use client";

import { useRef } from "react";
import type { Rarity } from "@/lib/domain";

/*
  Real Pokémon card artwork with a live foil finish.

  Pointer position drives a 3D tilt and a moving specular highlight. The
  shine strength follows the card's rarity tier, so a common card stays
  matte and a secret rare glints.
*/

export function TcgCard({
  src,
  alt,
  tier = "rare",
  className = "",
  tilt = true,
  priority = false,
}: {
  src: string;
  alt: string;
  tier?: Rarity;
  className?: string;
  tilt?: boolean;
  priority?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={`tcg-card ${className}`}
      data-tier={tier}
      onPointerMove={(event) => {
        if (!tilt) return;
        const el = event.currentTarget;
        const rect = el.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        el.style.setProperty("--rx", `${-y * 12}deg`);
        el.style.setProperty("--ry", `${x * 12}deg`);
        el.style.setProperty("--px", `${(x + 0.5) * 100}%`);
        el.style.setProperty("--py", `${(y + 0.5) * 100}%`);
      }}
      onPointerLeave={(event) => {
        if (!tilt) return;
        const el = event.currentTarget;
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--px", "50%");
        el.style.setProperty("--py", "50%");
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
      />
      <span className="tcg-shine" aria-hidden="true" />
    </div>
  );
}

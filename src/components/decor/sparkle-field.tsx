"use client";

import { useEffect, useMemo, useState } from "react";

/*
  Ambient sparkle field for the hero — the reference's background is a dark
  plum wash with sparse warm pinpricks. Positions are seeded so the server
  and client render the same markup.
*/

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

export function SparkleField({ count = 26 }: { count?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const stars = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${(rand() * 100).toFixed(2)}%`,
      top: `${(rand() * 100).toFixed(2)}%`,
      size: 1 + Math.round(rand() * 2),
      delay: `${(rand() * 4).toFixed(2)}s`,
      duration: `${(3 + rand() * 4).toFixed(2)}s`,
    }));
  }, [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((star) => (
        <span
          key={star.id}
          className="sparkle"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            animationDuration: mounted ? star.duration : undefined,
          }}
        />
      ))}
    </div>
  );
}

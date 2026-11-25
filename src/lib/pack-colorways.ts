/*
  Pack colourways. Kept out of the client component so server components can
  resolve a pack's foil colours without importing a client module.

  These are foil *tints*, not print colours: the 3D material is metallic, so
  `top`, `mid` and `bottom` become the vertical reflection ramp of the purple
  metallised film, `accent` is the polished metal used for the raised emblem
  and seal button, and `ink` is the printed wordmark.
*/

export type PackColorway = {
  top: string;
  mid: string;
  bottom: string;
  accent: string;
  ink: string;
};

export const COLORWAYS: Record<string, PackColorway> = {
  plum: { top: "#9a5ad8", mid: "#57208a", bottom: "#1b0729", accent: "#e7c3ff", ink: "#fff8ff" },
  rose: { top: "#e8a794", mid: "#9c5445", bottom: "#2a100a", accent: "#ffe0d2", ink: "#fff5ef" },
  copper: { top: "#e9a67a", mid: "#a45c37", bottom: "#30160b", accent: "#ffd9b5", ink: "#fff6ee" },
  silver: { top: "#e2e0ec", mid: "#8d8a9e", bottom: "#22202b", accent: "#ffffff", ink: "#ffffff" },
  violet: { top: "#9b6bff", mid: "#4a2aae", bottom: "#130929", accent: "#d5c4ff", ink: "#f9f4ff" },
  teal: { top: "#63e6ef", mid: "#146c7a", bottom: "#041c22", accent: "#ccfbff", ink: "#f0feff" },
  emerald: { top: "#67e4aa", mid: "#0f6047", bottom: "#04190f", accent: "#c9ffe8", ink: "#f0fff8" },
  gold: { top: "#f6d27c", mid: "#9a651b", bottom: "#2a1a06", accent: "#ffedb5", ink: "#fffaec" },
};

/* The purple 151 pack is the brand's flagship: keep it plum on every surface. */
const PINNED: Record<string, keyof typeof COLORWAYS> = {
  "booster-151": "plum",
  "route-151": "violet",
  "first-spark": "plum",
};

export function colorwayFor(slug: string): PackColorway {
  const pinned = PINNED[slug];
  if (pinned) return COLORWAYS[pinned];
  const keys = Object.keys(COLORWAYS);
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return COLORWAYS[keys[hash % keys.length]];
}

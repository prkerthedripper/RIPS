/*
  The single source of truth for rarity.

  Every rarity-driven thing in the app reads from here: names, short labels,
  accent/deep/bright colours, particle counts, background washes, the order the
  roulette spins through, and the simulated buyback rate used when a card is
  sold. Nothing else should hardcode a rarity colour or label.

  Pack probabilities are intentionally NOT defined here: each pack stores its
  own per-card weights in the database, and the odds page/receipts read those
  exact numbers. A second copy of the odds in this file would be a second
  source of truth that could silently disagree with the draw.
*/

export const RARITIES = ["common", "uncommon", "rare", "ultra", "secret"] as const;
export type Rarity = (typeof RARITIES)[number];

export type RarityTheme = {
  key: Rarity;
  /** Full label, e.g. "Ultra Rare". */
  label: string;
  /** Compact label used on the roulette ribbon and chips. */
  name: string;
  /** Short label for tight UI. */
  short: string;
  /** Accent colour: ribbon bands, glow, particles, buttons. */
  color: string;
  /** Deep wash behind the card. */
  deep: string;
  /** Flash/bright variant for the landing frame. */
  bright: string;
  /** Translucent version for ambient glows. */
  glow: string;
  /** Particle budget for the reveal burst. */
  particles: number;
  /** One line of copy for the result screen. */
  note: string;
};

export const RARITY: Record<Rarity, RarityTheme> = {
  common: {
    key: "common",
    label: "Common",
    name: "Common",
    short: "Common",
    color: "#a9b1bd",
    deep: "#14171d",
    bright: "#e4e9f2",
    glow: "rgba(169,177,189,0.35)",
    particles: 160,
    note: "A steady pull from the pool.",
  },
  uncommon: {
    key: "uncommon",
    label: "Uncommon",
    name: "Uncommon",
    short: "Uncommon",
    color: "#4ade80",
    deep: "#07180f",
    bright: "#b6ffd4",
    glow: "rgba(74,222,128,0.32)",
    particles: 220,
    note: "Green light on the foil.",
  },
  rare: {
    key: "rare",
    label: "Rare",
    name: "Rare",
    short: "Rare",
    color: "#38bdf8",
    deep: "#051524",
    bright: "#b9ecff",
    glow: "rgba(56,189,248,0.32)",
    particles: 300,
    note: "A holo rare in the pack.",
  },
  ultra: {
    key: "ultra",
    label: "Ultra Rare",
    name: "Ultra Rare",
    short: "Ultra",
    color: "#c084fc",
    deep: "#150826",
    bright: "#eed9ff",
    glow: "rgba(192,132,252,0.38)",
    particles: 420,
    note: "A premium hit — the room changes colour.",
  },
  secret: {
    key: "secret",
    label: "Secret Rare",
    name: "Secret Rare",
    short: "Secret",
    color: "#fbbf24",
    deep: "#1b1002",
    bright: "#fff0bd",
    glow: "rgba(251,191,36,0.4)",
    particles: 560,
    note: "Top of the sheet. Rainbow foil.",
  },
};

export const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  ultra: 3,
  secret: 4,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: RARITY.common.label,
  uncommon: RARITY.uncommon.label,
  rare: RARITY.rare.label,
  ultra: RARITY.ultra.label,
  secret: RARITY.secret.label,
};

/** Tailwind-ready text classes per rarity. */
export const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-common",
  uncommon: "text-uncommon",
  rare: "text-rare",
  ultra: "text-ultra",
  secret: "text-secret",
};

/** The ribbon order the roulette scrolls through. */
export const RARITY_SEQUENCE: Rarity[] = [...RARITIES];

/**
 * Simulated platform buyback: the share of a card's collection value a sale
 * pays out. Disclosed in the sell confirmation and the credits page.
 */
export const SELL_RATE = 0.85;

export function sellValue(collectionCents: number): number {
  return Math.max(0, Math.floor(collectionCents * SELL_RATE));
}

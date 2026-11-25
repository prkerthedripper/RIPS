/*
  Domain vocabulary shared by client and server.

  Rarity lives in `rarities.ts` (one config for the whole app) and money is
  stored and formatted as integer CENTS of simulated virtual USD.
*/

export {
  RARITIES,
  RARITY,
  RARITY_LABEL,
  RARITY_ORDER,
  RARITY_SEQUENCE,
  RARITY_TEXT,
  SELL_RATE,
  sellValue,
} from "./rarities";
export type { Rarity, RarityTheme } from "./rarities";

import type { Rarity } from "./rarities";

export const PACK_CATEGORIES = [
  "free",
  "starter",
  "standard",
  "premium",
  "legendary",
  "special",
] as const;
export type PackCategory = (typeof PACK_CATEGORIES)[number];

export const PACK_CATEGORY_LABEL: Record<PackCategory, string> = {
  free: "Free Packs",
  starter: "Starter Packs",
  standard: "Standard Packs",
  premium: "Premium Packs",
  legendary: "Legendary Packs",
  special: "Special Packs",
};

export type SessionUser = {
  id: string;
  username: string;
  avatar: string;
  credits: number;
  isAdmin: boolean;
};

/* ── Money ─────────────────────────────────────────────────── */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Cents -> "$12.50". Every money value in the UI goes through this. */
export function fmtUsd(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "—";
  return USD.format(cents / 100);
}

/** Cents -> "$12.50"; alias kept for older call sites. */
export const fmtCredits = fmtUsd;

/** Compact money for dense rows: "$1.2K". */
export function fmtUsdShort(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (dollars >= 10_000) return `$${(dollars / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return fmtUsd(cents);
}

export function fmtCreditsShort(cents: number): string {
  return fmtUsdShort(cents);
}

export const CREDIT_LABEL = "virtual USD";

/** A pack price, free packs spelled out. */
export function fmtPrice(cents: number): string {
  return cents === 0 ? "Free" : fmtUsd(cents);
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Shelf label for a pack category, e.g. "standard" -> "Standard pack". */
export const PACK_KIND_LABEL: Record<string, string> = {
  free: "Free pack",
  starter: "Starter pack",
  standard: "Standard pack",
  premium: "Premium pack",
  legendary: "Legendary pack",
  special: "Special pack",
};

export function packKindLabel(category: string): string {
  return PACK_KIND_LABEL[category] ?? category;
}

/** Pack names are long on the artwork; trim the series suffix. */
export function packArtLabel(name: string): string {
  return name.replace(/\s*Booster$/i, "").replace(/\s*Heritage$/i, "");
}

export type { Rarity as RarityTier };

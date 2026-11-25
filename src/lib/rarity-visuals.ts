/*
  Rarity presentation, derived from the single config in `rarities.ts`.

  The roulette, the reveal lighting, the result screen and the collection all
  read from here so one edit re-themes every rarity in the app.
*/

import type { Rarity } from "@/lib/domain";
import {
  RARITY,
  RARITY_SEQUENCE,
  sellValue,
  type RarityTheme,
} from "@/lib/rarities";

export type RarityVisual = RarityTheme;

export const RARITY_VISUALS: Record<Rarity, RarityVisual> = RARITY;

export { RARITY_SEQUENCE, sellValue };

export function rarityVisual(tier: Rarity | string): RarityVisual {
  return RARITY[(tier as Rarity) ?? "common"] ?? RARITY.common;
}

/** The ribbon of rarity bands the roulette scrolls past. */
export function rouletteBands(landing: Rarity, cycles = 6): Rarity[] {
  const bands: Rarity[] = [];
  for (let i = 0; i < cycles; i += 1) {
    for (const tier of RARITY_SEQUENCE) bands.push(tier);
  }
  // Land on the requested rarity, with one more band after it so the ribbon
  // keeps moving past the frame instead of stopping dead at the end.
  bands.push(landing);
  const tail = RARITY_SEQUENCE[(RARITY_SEQUENCE.indexOf(landing) + 1) % RARITY_SEQUENCE.length];
  bands.push(tail);
  return bands;
}

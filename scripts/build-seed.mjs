/*
  Builds src/db/seed/cards.json from the raw Pokémon TCG API snapshots.

  - Maps every card to a slim record with an AURIC rarity tier and a
    virtual-credit value.
  - Value model: within each tier, cards are ranked by real market price
    (tcgplayer mid) and spread across the tier's virtual-value band. The
    result is a self-consistent virtual economy where chase cards lead
    their tiers, without importing real-money numbers directly.
  - Excludes basic Energy cards (not collectible pulls).
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEED_DIR = path.join(ROOT, "src", "db", "seed");

const SETS = [
  { file: "raw-base1.json", code: "base1", name: "Base", series: "Base" },
  { file: "raw-sv3pt5.json", code: "sv3pt5", name: "151", series: "Scarlet & Violet" },
  { file: "raw-swsh12pt5.json", code: "swsh12pt5", name: "Crown Zenith", series: "Sword & Shield" },
  { file: "raw-sv4pt5.json", code: "sv4pt5", name: "Paldean Fates", series: "Scarlet & Violet" },
];

/*
  Rarity (API value) -> AURIC tier, per set where needed. Anything unmapped
  is reported and dropped so the odds tables stay clean.
*/
const TIER_BY_RARITY = {
  Common: { tier: "common" },
  Uncommon: { tier: "uncommon" },
  Rare: { tier: "rare" },
  "Rare Holo": { tier: "rare", sets: ["swsh12pt5"] }, // regular holos in modern sets
  "Radiant Rare": { tier: "rare" },
  "Shiny Rare": { tier: "rare" },
  "Double Rare": { tier: "ultra" },
  "Ultra Rare": { tier: "ultra" },
  "Rare Ultra": { tier: "ultra" },
  "Rare Holo V": { tier: "ultra" },
  "Rare Holo VMAX": { tier: "ultra" },
  "Rare Holo VSTAR": { tier: "ultra" },
  "Shiny Ultra Rare": { tier: "ultra" },
  "Illustration Rare": { tier: "secret" },
  "Special Illustration Rare": { tier: "secret" },
  "Hyper Rare": { tier: "secret" },
  "Rare Secret": { tier: "secret" },
  // Base Set (1999): holofoils are the chase cards of the legendary pool
  "Rare Holo:base1": { tier: "secret" },
};

const VALUE_BANDS = {
  common: [10, 25],
  uncommon: [40, 120],
  rare: [150, 500],
  ultra: [700, 2500],
  secret: [2500, 12000],
};

const TIER_DEFAULT_VALUE = {
  common: 14,
  uncommon: 60,
  rare: 220,
  ultra: 1100,
  secret: 4000,
};

function midPrice(card) {
  const prices = card?.tcgplayer?.prices ?? {};
  let max = null;
  for (const group of Object.values(prices)) {
    const mid = group?.mid;
    if (typeof mid === "number" && mid > 0 && (max === null || mid > max)) max = mid;
  }
  return max;
}

function tierFor(card, setCode) {
  const rarity = card.rarity ?? "";
  if (rarity === "Rare Holo" && setCode === "base1") return TIER_BY_RARITY["Rare Holo:base1"].tier;
  const entry = TIER_BY_RARITY[rarity];
  if (!entry) return null;
  if (entry.sets && !entry.sets.includes(setCode)) return null;
  return entry.tier;
}

const all = [];
for (const set of SETS) {
  const cards = JSON.parse(fs.readFileSync(path.join(SEED_DIR, set.file), "utf8"));
  for (const c of cards) {
    if (c.supertype === "Energy") continue;
    const tier = tierFor(c, set.code);
    if (!tier) continue;
    all.push({
      id: c.id,
      name: c.name,
      setCode: set.code,
      setName: set.name,
      number: c.number ?? "",
      rarity: c.rarity ?? "",
      tier,
      price: midPrice(c),
      images: c.images ?? {},
      artist: c.artist ?? null,
      supertype: c.supertype,
      subtypes: c.subtypes ?? [],
    });
  }
}

// Rank within (setCode, tier) by market price and spread across the band.
const valueByTierSet = {};
const groups = new Map();
for (const c of all) {
  const key = `${c.setCode}:${c.tier}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(c);
}
for (const [, members] of groups) {
  members.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const n = members.length;
  members.forEach((c, i) => {
    const [lo, hi] = VALUE_BANDS[c.tier];
    if (c.price === null || n === 1) {
      c.value = c.price === null ? TIER_DEFAULT_VALUE[c.tier] : lo;
    } else {
      const pct = n > 1 ? i / (n - 1) : 0;
      c.value = Math.round(lo + (hi - lo) * Math.pow(pct, 1.15));
    }
    valueByTierSet[`${c.setCode}:${c.tier}`] = (valueByTierSet[`${c.setCode}:${c.tier}`] ?? 0) + c.value;
  });
}

// Slim output
const slim = all
  .sort((a, b) => a.setCode.localeCompare(b.setCode) || a.number.localeCompare(b.number, undefined, { numeric: true }))
  .map((c) => ({
    id: c.id,
    name: c.name,
    setCode: c.setCode,
    setName: c.setName,
    number: c.number,
    rarity: c.rarity,
    tier: c.tier,
    value: c.value,
    image: c.images.large ?? c.images.small ?? "",
    thumb: c.images.small ?? "",
    artist: c.artist,
  }));

fs.writeFileSync(path.join(SEED_DIR, "cards.json"), JSON.stringify(slim, null, 0));

// Report
const byTier = {};
for (const c of slim) byTier[c.tier] = (byTier[c.tier] ?? 0) + 1;
console.log("cards:", slim.length, JSON.stringify(byTier));
for (const set of SETS) {
  const members = slim.filter((c) => c.setCode === set.code);
  const tiers = new Map();
  for (const c of members) {
    const t = tiers.get(c.tier) ?? { n: 0, avg: 0, min: Infinity, max: -Infinity };
    t.n++; t.avg += c.value; t.min = Math.min(t.min, c.value); t.max = Math.max(t.max, c.value);
    tiers.set(c.tier, t);
  }
  console.log(`\n${set.code} (${members.length} cards)`);
  for (const [tier, t] of [...tiers].sort())
    console.log(`  ${tier.padEnd(8)} n=${String(t.n).padStart(3)} avg=${Math.round(t.avg / t.n).toString().padStart(6)} range=${t.min}..${t.max}`);
  const top = [...members].sort((a, b) => b.value - a.value).slice(0, 3);
  for (const c of top) console.log(`  top: ${c.name} (${c.value})`);
}

/*
  Seed data for AURIC: cards from the curated snapshot, packs with exact
  disclosed odds, daily rewards, settings, and the admin account.

  Pack odds model: each pack declares P(tier) per rarity tier. Per-card
  weight = P(tier) / n_tier, so the database stores the exact probability
  of every individual card (weight / sum-of-weights = displayed odds).
  Prices derive from expected value at a target return ratio, rounded to
  look like shelf prices. The odds report prints at seed time.
*/

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { hashPassword } from "./password.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEED_DIR = path.join(ROOT, "src", "db", "seed");

/* ── Pack shelf ──────────────────────────────────────────────── */

const AVG = { common: 17, uncommon: 77, rare: 313, ultra: 1539, secret: 6760 };

/*
  slug, category, price, accent, copy, pool (sets/tiers), tierP per tier,
  featured, free_per_account.
*/
const PACKS = [
  {
    slug: "first-spark",
    name: "First Spark",
    category: "free",
    price: 0,
    accent: "#ba4bff",
    description:
      "One card, guaranteed to be worth at least $5.00 of simulated collection value. Every card in this pack is a 151 Ultra Rare or Secret Rare — the same physical tear and cinematic reveal as the rest of the shelf. One per account.",
    pool: { sets: ["sv3pt5"], tiers: ["ultra", "secret"] },
    tierP: { ultra: 0.65, secret: 0.35 },
    featured: false,
    freePerAccount: true,
    minValueNote: 500,
    sortOrder: 10,
  },
  {
    slug: "route-151",
    name: "Route 151",
    category: "starter",
    price: 75,
    accent: "#61fff7",
    description:
      "A gentle first step into Kanto. Commons and uncommons from Pokémon 151 with a sprinkle of holo rares — low volatility, honest odds.",
    pool: { sets: ["sv3pt5"], tiers: ["common", "uncommon", "rare"] },
    tierP: { common: 0.637, uncommon: 0.329, rare: 0.034 },
    featured: false,
    sortOrder: 20,
  },
  {
    slug: "booster-151",
    name: "151 Booster",
    category: "standard",
    price: 300,
    accent: "#f9bd13",
    description:
      "The complete Kanto set — all 206 cards including the Charizard ex, Blastoise ex and Venusaur ex illustration rares. The flagship rip of the vault.",
    pool: { sets: ["sv3pt5"], tiers: ["common", "uncommon", "rare", "ultra", "secret"] },
    tierP: { common: 0.565, uncommon: 0.28, rare: 0.1, ultra: 0.043, secret: 0.012 },
    featured: true,
    featuredRank: 1,
    sortOrder: 30,
  },
  {
    slug: "booster-crown-zenith",
    name: "Crown Zenith Booster",
    category: "standard",
    price: 250,
    accent: "#8683ff",
    description:
      "Galar's greatest hits. V, VSTAR and VMAX heavies plus the single-secret Elesa's Sparkle jackpot at the top of the odds sheet.",
    pool: { sets: ["swsh12pt5"], tiers: ["common", "uncommon", "rare", "ultra", "secret"] },
    tierP: { common: 0.55, uncommon: 0.27, rare: 0.132, ultra: 0.04, secret: 0.008 },
    featured: false,
    sortOrder: 40,
  },
  {
    slug: "booster-paldean-fates",
    name: "Paldean Fates Booster",
    category: "premium",
    price: 600,
    accent: "#6cefbd",
    description:
      "The shiny vault. Paldean Fates runs triple the secret rate of a standard pack — Shiny Ultra Rares and Special Illustration Rares live here.",
    pool: { sets: ["sv4pt5"], tiers: ["common", "uncommon", "rare", "ultra", "secret"] },
    tierP: { common: 0.42, uncommon: 0.22, rare: 0.27, ultra: 0.06, secret: 0.03 },
    featured: false,
    sortOrder: 50,
  },
  {
    slug: "base-set-heritage",
    name: "Base Set Heritage",
    category: "legendary",
    price: 1200,
    accent: "#ffb68a",
    description:
      "1999, restored. The original 95-card Base Set with its sixteen holographic chases — Charizard, Blastoise, Venusaur at the top of the sheet.",
    pool: { sets: ["base1"], tiers: ["common", "uncommon", "rare", "secret"] },
    tierP: { common: 0.38, uncommon: 0.3, rare: 0.22, secret: 0.1 },
    featured: false,
    sortOrder: 60,
  },
  {
    slug: "vault-signature",
    name: "Vault Signature",
    category: "special",
    price: 4300,
    accent: "#ffd84a",
    description:
      "No filler, all chase. Every card in this pack is an ultra or secret rare across all four sets — the highest volatility rip AURIC offers.",
    pool: { sets: ["base1", "sv3pt5", "swsh12pt5", "sv4pt5"], tiers: ["ultra", "secret"] },
    tierP: { ultra: 0.72, secret: 0.28 },
    featured: false,
    sortOrder: 70,
  },
];

const DAILY_REWARDS = [
  { day: 1, credits: 150, item: "" },
  { day: 2, credits: 200, item: "" },
  { day: 3, credits: 250, item: "avatar:a5" },
  { day: 4, credits: 300, item: "" },
  { day: 5, credits: 350, item: "" },
  { day: 6, credits: 400, item: "" },
  { day: 7, credits: 600, item: "avatar:a6" },
  { day: 8, credits: 200, item: "" },
  { day: 9, credits: 250, item: "" },
  { day: 10, credits: 300, item: "avatar:a7" },
  { day: 11, credits: 400, item: "" },
  { day: 12, credits: 500, item: "" },
  { day: 13, credits: 650, item: "" },
  { day: 14, credits: 1200, item: "avatar:a8" },
];

/* ── Seed logic ──────────────────────────────────────────────── */

function niceRound(n) {
  if (n < 200) return Math.max(25, Math.round(n / 25) * 25);
  if (n < 1000) return Math.round(n / 50) * 50;
  return Math.round(n / 100) * 100;
}

async function seedIfEmpty(client, log = console.log) {
  const { rows } = await client.query("select count(*)::int as n from cards");
  if (rows[0].n > 0) {
    log("seed data present, skipping");
    return false;
  }

  /* Cards */
  const cards = JSON.parse(fs.readFileSync(path.join(SEED_DIR, "cards.json"), "utf8"));
  let inserted = 0;
  const BATCH = 200;
  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const values = [];
    const params = [];
    batch.forEach((c, j) => {
      const b = j * 11;
      values.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11})`,
      );
      params.push(
        c.id, c.name, c.setCode, c.setName, String(c.number), c.rarity,
        c.tier, c.value, c.image, c.thumb, c.artist,
      );
    });
    await client.query(
      `insert into cards (id, name, set_code, set_name, number, rarity, tier, value, image, thumb, artist)
       values ${values.join(",")} on conflict (id) do nothing`,
      params,
    );
    inserted += batch.length;
  }
  log(`cards inserted: ${inserted}`);

  /* Packs + odds */
  for (const p of PACKS) {
    const poolRes = await client.query(
      `select id, tier from cards where set_code = any($1) and tier = any($2)`,
      [p.pool.sets, p.pool.tiers],
    );
    if (poolRes.rows.length === 0) throw new Error(`empty pool for pack ${p.slug}`);
    const packRes = await client.query(
      `insert into packs (slug, name, category, description, price, accent, featured, featured_rank, free_per_account, min_value_note, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [
        p.slug, p.name, p.category, p.description, p.price, p.accent,
        p.featured ?? false, p.featuredRank ?? null, p.freePerAccount ?? false,
        p.minValueNote ?? null, p.sortOrder,
      ],
    );
    const packId = packRes.rows[0].id;
    // per-card weight = P(tier) / n(tier in this pack pool)
    const byTier = new Map();
    for (const r of poolRes.rows) {
      if (!byTier.has(r.tier)) byTier.set(r.tier, []);
      byTier.get(r.tier).push(r.id);
    }
    const rows = [];
    for (const [tier, ids] of byTier) {
      const prob = p.tierP[tier];
      if (prob == null) throw new Error(`pack ${p.slug} missing tierP for ${tier}`);
      const w = prob / ids.length;
      for (const id of ids) rows.push([packId, id, w]);
    }
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400);
      const values = chunk.map((_, j) => `($${j * 3 + 1},$${j * 3 + 2},$${j * 3 + 3})`).join(",");
      await client.query(
        `insert into pack_cards (pack_id, card_id, weight) values ${values} on conflict do nothing`,
        chunk.flat(),
      );
    }

    /* Odds report + EV */
    const ev = Object.entries(p.tierP)
      .map(([tier, prob]) => prob * (AVG[tier] ?? 0))
      .reduce((a, b) => a + b, 0);
    const tierLine = Object.entries(p.tierP)
      .map(([t, pr]) => `${t} ${(pr * 100).toFixed(pr < 0.01 ? 2 : 1)}%`)
      .join(" · ");
    log(
      `pack ${p.slug}: price ${p.price} EV ${ev.toFixed(0)} (${((ev / Math.max(p.price, 1)) * 100).toFixed(0)}%) | ${tierLine} | pool ${poolRes.rows.length}`,
    );
  }

  /* Daily rewards */
  for (const d of DAILY_REWARDS) {
    await client.query(
      `insert into daily_rewards (day_index, credits, item) values ($1,$2,$3)
       on conflict (day_index) do nothing`,
      [d.day, d.credits, d.item],
    );
  }
  log(`daily rewards: ${DAILY_REWARDS.length} days`);

  /* Settings */
  const settings = [
    ["signup_credits", "0"],
    ["daily_cycle_length", "14"],
  ];
  for (const [k, v] of settings) {
    await client.query(
      `insert into settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value`,
      [k, v],
    );
  }

  /* Admin account */
  const adminPassword = process.env.ADMIN_PASSWORD ?? "auric-admin";
  const admin = await client.query(
    `insert into users (username, password_hash, avatar, credits, is_admin, starter_claimed)
     values ($1,$2,'a1',50000,true,true)
     on conflict do nothing returning id`,
    ["vaultmaster", hashPassword(adminPassword)],
  );
  if (admin.rows.length > 0) log('admin user "vaultmaster" created');

  return true;
}

export { seedIfEmpty, PACKS, DAILY_REWARDS };

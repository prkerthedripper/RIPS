/*
  Fill in real market references for the cards in the pool.

  Source: the Pokémon TCG API (pokemontcg.io), which republishes TCGplayer
  prices per printing. For each printing we take the "market" price of the
  most representative variant (holofoil > 1st edition > reverse > normal) and
  store it in `cards.market_cents` with its currency, source and the price
  feed's own updated-at timestamp.

  Cards without a usable price keep `market_cents` NULL and the UI says the
  price is unavailable instead of inventing one.

  Usage: node scripts/backfill-market.mjs [--dry]
*/

import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/auric";
const API = "https://api.pokemontcg.io/v2/cards";
const PAGE = 250;
const VARIANTS = ["holofoil", "1stEditionHolofoil", "unlimitedHolofoil", "reverseHolofoil", "normal"];

const dry = process.argv.includes("--dry");

const pool = new Pool({ connectionString: DATABASE_URL });

function pickPrice(prices) {
  if (!prices) return null;
  for (const variant of VARIANTS) {
    const entry = prices[variant];
    if (!entry) continue;
    const value = entry.market ?? entry.mid ?? null;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

async function fetchPage(setCode, page, attempt = 1) {
  const url = `${API}?q=set.id:${setCode}&page=${page}&pageSize=${PAGE}&select=id,tcgplayer`;
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    // The public API sometimes reports 502 while still returning the payload,
    // so trust the body when it parses.
    const json = await response.json().catch(() => null);
    if (Array.isArray(json?.data)) return json.data;
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      return fetchPage(setCode, page, attempt + 1);
    }
    throw new Error(`${setCode} page ${page}: ${error.message}`);
  }
}

async function fetchSet(setCode) {
  const out = [];
  for (let page = 1; ; page += 1) {
    const rows = await fetchPage(setCode, page);
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function main() {
  const { rows: sets } = await pool.query(
    "select distinct set_code from cards where set_code <> '' order by set_code",
  );
  let updated = 0;
  let missing = 0;

  for (const { set_code: setCode } of sets) {
    let cards;
    try {
      cards = await fetchSet(setCode);
    } catch (error) {
      console.warn(`[market] ${setCode}: ${error.message}`);
      continue;
    }

    for (const card of cards) {
      const price = pickPrice(card.tcgplayer?.prices);
      if (price == null) {
        missing += 1;
        continue;
      }
      const cents = Math.max(1, Math.round(price * 100));
      const updatedAt = card.tcgplayer?.updatedAt
        ? new Date(card.tcgplayer.updatedAt.replaceAll("/", "-")).toISOString()
        : null;
      if (dry) continue;
      const res = await pool.query(
        `update cards
            set market_cents = $2,
                market_currency = 'USD',
                market_source = 'tcgplayer',
                market_updated_at = coalesce($3::timestamptz, now())
          where id = $1`,
        [card.id, cents, updatedAt],
      );
      updated += res.rowCount;
    }
    console.log(`[market] ${setCode}: ${cards.length} printings read`);
  }

  const { rows } = await pool.query(
    "select count(*)::int as total, count(market_cents)::int as priced from cards",
  );
  console.log(`[market] updated ${updated}, no price ${missing}`);
  console.log(`[market] cards ${rows[0].total}, with a price ${rows[0].priced}`);
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});

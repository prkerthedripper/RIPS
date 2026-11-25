import { one, query, withTransaction } from "@/lib/db";
import type { Rarity } from "@/lib/domain";
import { sellValue } from "@/lib/rarities";
import { refreshUser, type AccountUser } from "@/lib/auth/session";

/*
  Pack shelf, vault and sales.

  All money is integer CENTS of simulated virtual USD. Packs and per-card
  weights live in the database (packs, pack_cards, cards). A rip selects
  exactly ONE card server-side with a single weighted query, debits the price
  and writes the opening inside one transaction.

  An opening is a short-lived pending pull: the user either VAULTS it (it
  becomes part of their collection) or SELLS it (the card is paid out at the
  disclosed simulated buyback rate and leaves the collection). Both decisions
  are idempotent — the row is only updated while its status is 'pending'.
*/

export type ShelfCard = {
  id: string;
  name: string;
  setName: string;
  number: string;
  rarity: string;
  tier: Rarity;
  /** Simulated collection value, in cents. */
  value: number;
  /** Reference market price from an external price source, in cents (null = unavailable). */
  marketCents: number | null;
  marketCurrency: string;
  marketSource: string;
  marketUpdatedAt: string | null;
  /** Simulated platform buyback if sold right now, in cents. */
  sellCents: number;
  image: string;
  thumb: string;
};

export type ShelfPack = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  accent: string;
  featured: boolean;
  freePerAccount: boolean;
  /** Disclosed floor for a pack that guarantees one (cents). */
  guaranteedValue: number | null;
  minValue: number;
  maxValue: number;
  poolSize: number;
  topCards: ShelfCard[];
  tiers: { tier: Rarity; chance: number }[];
};

type PackRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  accent: string;
  featured: boolean;
  free_per_account: boolean;
  min_value_note: number | null;
  pool_size: number;
  min_value: number;
  max_value: number;
};

type CardRow = {
  id: string;
  name: string;
  set_name: string;
  number: string;
  rarity: string;
  tier: Rarity;
  value: number;
  market_cents: number | null;
  market_currency: string | null;
  market_source: string | null;
  market_updated_at: string | null;
  image: string;
  thumb: string;
  pack_slug?: string;
};

const CARD_COLUMNS = `c.id, c.name, c.set_name, c.number, c.rarity, c.tier, c.value,
  c.market_cents, c.market_currency, c.market_source, c.market_updated_at, c.image, c.thumb`;

const toCard = (r: CardRow): ShelfCard => ({
  id: r.id,
  name: r.name,
  setName: r.set_name,
  number: r.number,
  rarity: r.rarity,
  tier: r.tier,
  value: r.value,
  marketCents: r.market_cents == null ? null : Number(r.market_cents),
  marketCurrency: r.market_currency ?? "USD",
  marketSource: r.market_source ?? "",
  marketUpdatedAt: r.market_updated_at ? new Date(r.market_updated_at).toISOString() : null,
  sellCents: sellValue(r.value),
  image: r.image,
  thumb: r.thumb,
});

const PACK_STATS = `
  select p.id, p.slug, p.name, p.category, p.description, p.price, p.accent,
         p.featured, p.free_per_account, p.min_value_note,
         count(pc.card_id)::int as pool_size,
         coalesce(min(c.value), 0)::int as min_value,
         coalesce(max(c.value), 0)::int as max_value
    from packs p
    left join pack_cards pc on pc.pack_id = p.id
    left join cards c on c.id = pc.card_id
   where p.active
   group by p.id
   order by p.sort_order, p.price
`;

export async function getShelf(): Promise<ShelfPack[]> {
  const { rows } = await query<PackRow>(PACK_STATS);
  if (rows.length === 0) return [];

  const { rows: tops } = await query<CardRow>(
    `select p.slug as pack_slug, ${CARD_COLUMNS},
            row_number() over (partition by p.id order by c.value desc) as rn
       from packs p
       join pack_cards pc on pc.pack_id = p.id
       join cards c on c.id = pc.card_id
      where p.active`,
  );
  const byPack = new Map<string, ShelfCard[]>();
  for (const row of tops) {
    if ((row as unknown as { rn: number }).rn > 3) continue;
    const list = byPack.get(row.pack_slug!) ?? [];
    list.push(toCard(row));
    byPack.set(row.pack_slug!, list);
  }

  // Disclosed odds per rarity, shown before a rip rather than after it.
  const { rows: tierRows } = await query<{ pack_slug: string; tier: Rarity; chance: number }>(
    `select p.slug as pack_slug, c.tier,
            (sum(pc.weight) / nullif(sum(sum(pc.weight)) over (partition by p.id), 0))::float as chance
       from packs p
       join pack_cards pc on pc.pack_id = p.id
       join cards c on c.id = pc.card_id
      where p.active
      group by p.id, p.slug, c.tier
      order by c.tier`,
  );
  const byTier = new Map<string, { tier: Rarity; chance: number }[]>();
  for (const row of tierRows) {
    const list = byTier.get(row.pack_slug) ?? [];
    list.push({ tier: row.tier, chance: Number(row.chance) });
    byTier.set(row.pack_slug, list);
  }

  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    description: p.description,
    price: p.price,
    accent: p.accent,
    featured: p.featured,
    freePerAccount: p.free_per_account,
    guaranteedValue: p.min_value_note,
    minValue: p.min_value_note ?? p.min_value,
    maxValue: p.max_value,
    poolSize: p.pool_size,
    topCards: byPack.get(p.slug) ?? [],
    tiers: (byTier.get(p.slug) ?? []).sort((a, b) => b.chance - a.chance),
  }));
}

export type PackDetail = Omit<ShelfPack, "tiers"> & {
  tiers: { tier: Rarity; count: number; chance: number }[];
  pool: (ShelfCard & { chance: number })[];
};

export async function getPack(slug: string): Promise<PackDetail | null> {
  const shelf = await getShelf();
  const base = shelf.find((p) => p.slug === slug);
  if (!base) return null;

  const { rows } = await query<CardRow & { weight: number; total: number }>(
    `select ${CARD_COLUMNS}, pc.weight, sum(pc.weight) over () as total
       from pack_cards pc
       join cards c on c.id = pc.card_id
      where pc.pack_id = $1
      order by c.value desc`,
    [base.id],
  );

  const pool = rows.map((r) => ({
    ...toCard(r),
    chance: Number(r.weight) / Number(r.total),
  }));

  const tierMap = new Map<Rarity, { count: number; chance: number }>();
  for (const card of pool) {
    const entry = tierMap.get(card.tier) ?? { count: 0, chance: 0 };
    entry.count += 1;
    entry.chance += card.chance;
    tierMap.set(card.tier, entry);
  }

  return {
    ...base,
    pool,
    tiers: [...tierMap.entries()]
      .map(([tier, v]) => ({ tier, ...v }))
      .sort((a, b) => b.chance - a.chance),
  };
}

/** The pack quantities a rip can buy at once. */
export const RIP_QUANTITIES = [1, 2, 5, 10] as const;
export type RipQuantity = (typeof RIP_QUANTITIES)[number];

export type OpenResult =
  | {
      ok: true;
      cards: ShelfCard[];
      balance: number;
      openingIds: string[];
      cost: number;
      qty: number;
      /** First card, kept for single-pack callers. */
      card: ShelfCard;
      openingId: string;
    }
  | { ok: false; error: string; balance?: number };

/**
 * Rip one or more packs of the same kind in a single transaction: one weighted
 * draw per pack, one debit, and each card held as its own pending pull.
 */
export async function openPack(user: AccountUser, slug: string, rawQty = 1): Promise<OpenResult> {
  const qty = (RIP_QUANTITIES as readonly number[]).includes(rawQty) ? rawQty : 1;
  return withTransaction(async (client) => {
    const packRes = await client.query<PackRow>(
      `select p.id, p.slug, p.name, p.price, p.free_per_account
         from packs p where p.slug = $1 and p.active for update`,
      [slug],
    );
    const pack = packRes.rows[0];
    if (!pack) return { ok: false, error: "That pack is no longer on the shelf." };

    const userRes = await client.query<{ credits: number; starter_claimed: boolean }>(
      "select credits, starter_claimed from users where id = $1 for update",
      [user.id],
    );
    const account = userRes.rows[0];
    if (!account) return { ok: false, error: "Account not found." };

    if (pack.free_per_account && account.starter_claimed) {
      return { ok: false, error: "Your free starter pack has already been opened." };
    }
    if (pack.free_per_account && qty > 1) {
      return { ok: false, error: "The free starter pack is one pack per account." };
    }
    const cost = pack.price * qty;
    if (account.credits < cost) {
      return {
        ok: false,
        error: `Not enough balance. ${(cost / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} needed.`,
        balance: account.credits,
      };
    }

    // One weighted draw — the database picks the card, the client never does.
    const drawRes = await client.query<CardRow>(
      `select ${CARD_COLUMNS}
         from pack_cards pc
         join cards c on c.id = pc.card_id
        where pc.pack_id = $1
        order by -ln(1 - random()) / pc.weight
        limit $2`,
      [pack.id, qty],
    );
    const drawn = drawRes.rows;
    if (drawn.length === 0) return { ok: false, error: "This pack has no cards configured." };

    const balanceAfter = account.credits - cost;
    await client.query(
      "update users set credits = $2, updated_at = now(), starter_claimed = starter_claimed or $3 where id = $1",
      [user.id, balanceAfter, pack.free_per_account],
    );

    // One opening per pack, so every card gets its own history row and its own
    // vault/sell decision.
    const openingIds: string[] = [];
    for (const row of drawn) {
      const opening = await client.query<{ id: string }>(
        `insert into openings (user_id, pack_id, card_id, cost, balance_after, status)
         values ($1, $2, $3, $4, $5, 'pending') returning id`,
        [user.id, pack.id, row.id, pack.price, balanceAfter],
      );
      openingIds.push(opening.rows[0].id);
    }

    if (cost > 0) {
      await client.query(
        `insert into credit_transactions (user_id, amount, kind, ref, balance_after)
         values ($1, $2, 'pack_open', $3, $4)`,
        [user.id, -cost, qty > 1 ? `${pack.slug} x${qty}` : pack.slug, balanceAfter],
      );
    }

    const cards = drawn.map(toCard);
    return {
      ok: true as const,
      cards,
      balance: balanceAfter,
      openingIds,
      cost,
      qty,
      card: cards[0],
      openingId: openingIds[0],
    };
  });
}

/* ── Vault / sell ───────────────────────────────────────────── */

export type DecisionResult =
  | {
      ok: true;
      status: "vaulted" | "sold";
      balance: number;
      soldCents?: number;
      count: number;
      openingIds: string[];
    }
  | { ok: false; error: string };

type PendingRow = {
  id: string;
  status: string;
  card_id: string;
  name: string;
  value: number;
};

/** Move a pending pull into the collection. Idempotent. */
export async function vaultOpening(userId: string, openingId: string): Promise<DecisionResult> {
  return withTransaction(async (client) => {
    const res = await client.query<PendingRow>(
      `select o.id, o.status, o.card_id, c.name, c.value
         from openings o join cards c on c.id = o.card_id
        where o.id = $1 and o.user_id = $2
        for update of o`,
      [openingId, userId],
    );
    const row = res.rows[0];
    if (!row) return { ok: false, error: "That pull was not found." };
    if (row.status === "vaulted") return { ok: false, error: "That card is already in your vault." };
    if (row.status === "sold") return { ok: false, error: "That card has already been sold." };

    await client.query(
      "update openings set status = 'vaulted', decided_at = now() where id = $1",
      [row.id],
    );
    const balance = await client.query<{ credits: number }>(
      "select credits from users where id = $1",
      [userId],
    );
    return {
      ok: true,
      status: "vaulted",
      balance: balance.rows[0]?.credits ?? 0,
      count: 1,
      openingIds: [row.id],
    };
  });
}

/** Sell a pending pull for the disclosed simulated buyback value. Idempotent. */
export async function sellOpening(userId: string, openingId: string): Promise<DecisionResult> {
  return withTransaction(async (client) => {
    const res = await client.query<PendingRow>(
      `select o.id, o.status, o.card_id, c.name, c.value
         from openings o join cards c on c.id = o.card_id
        where o.id = $1 and o.user_id = $2
        for update of o`,
      [openingId, userId],
    );
    const row = res.rows[0];
    if (!row) return { ok: false, error: "That pull was not found." };
    if (row.status === "sold") return { ok: false, error: "That card has already been sold." };
    if (row.status === "vaulted") {
      return { ok: false, error: "That card is already in your vault." };
    }

    const payout = sellValue(row.value);
    const account = await client.query<{ credits: number }>(
      "select credits from users where id = $1 for update",
      [userId],
    );
    const balanceAfter = (account.rows[0]?.credits ?? 0) + payout;

    await client.query(
      "update openings set status = 'sold', sold_cents = $2, decided_at = now() where id = $1",
      [row.id, payout],
    );
    await client.query("update users set credits = $2, updated_at = now() where id = $1", [
      userId,
      balanceAfter,
    ]);
    await client.query(
      `insert into credit_transactions (user_id, amount, kind, ref, balance_after)
       values ($1, $2, 'sale', $3, $4)`,
      [userId, payout, row.name, balanceAfter],
    );

    return {
      ok: true,
      status: "sold",
      balance: balanceAfter,
      soldCents: payout,
      count: 1,
      openingIds: [row.id],
    };
  });
}

/* ── Bulk vault / sell (multi-pack rips) ───────────────────── */

/** Vault every still-pending pull in `ids`. Idempotent per opening. */
export async function vaultOpenings(userId: string, ids: string[]): Promise<DecisionResult> {
  if (ids.length === 0) return { ok: false, error: "Which pull?" };
  return withTransaction(async (client) => {
    const res = await client.query<{ id: string }>(
      `update openings set status = 'vaulted', decided_at = now()
        where user_id = $1 and id = any($2::uuid[]) and status = 'pending'
        returning id`,
      [userId, ids],
    );
    if (res.rows.length === 0) return { ok: false, error: "Those pulls were already resolved." };
    const balance = await client.query<{ credits: number }>(
      "select credits from users where id = $1",
      [userId],
    );
    return {
      ok: true,
      status: "vaulted",
      balance: balance.rows[0]?.credits ?? 0,
      count: res.rows.length,
      openingIds: res.rows.map((r) => r.id),
    };
  });
}

/** Sell every still-pending pull in `ids`, writing one history row per card. */
export async function sellOpenings(userId: string, ids: string[]): Promise<DecisionResult> {
  if (ids.length === 0) return { ok: false, error: "Which pull?" };
  return withTransaction(async (client) => {
    const res = await client.query<PendingRow>(
      `select o.id, o.status, o.card_id, c.name, c.value
         from openings o join cards c on c.id = o.card_id
        where o.user_id = $1 and o.id = any($2::uuid[]) and o.status = 'pending'
        for update of o`,
      [userId, ids],
    );
    if (res.rows.length === 0) return { ok: false, error: "Those pulls were already resolved." };

    const payouts = res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      cents: sellValue(row.value),
    }));
    const total = payouts.reduce((sum, payout) => sum + payout.cents, 0);

    const account = await client.query<{ credits: number }>(
      "select credits from users where id = $1 for update",
      [userId],
    );
    const balanceAfter = (account.rows[0]?.credits ?? 0) + total;

    for (const payout of payouts) {
      await client.query(
        "update openings set status = 'sold', sold_cents = $2, decided_at = now() where id = $1",
        [payout.id, payout.cents],
      );
    }
    await client.query("update users set credits = $2, updated_at = now() where id = $1", [
      userId,
      balanceAfter,
    ]);
    for (const payout of payouts) {
      await client.query(
        `insert into credit_transactions (user_id, amount, kind, ref, balance_after)
         values ($1, $2, 'sale', $3, $4)`,
        [userId, payout.cents, payout.name, balanceAfter],
      );
    }

    return {
      ok: true,
      status: "sold",
      balance: balanceAfter,
      soldCents: total,
      count: payouts.length,
      openingIds: payouts.map((p) => p.id),
    };
  });
}

/**
 * A pull left undecided (tab closed mid-reveal) is kept, not lost: anything
 * older than this many minutes lands in the vault on the next read.
 */
const STALE_PULL_MINUTES = 15;

async function vaultStalePulls(userId: string) {
  await query(
    `update openings set status = 'vaulted', decided_at = now()
      where user_id = $1 and status = 'pending'
        and created_at < now() - interval '${STALE_PULL_MINUTES} minutes'`,
    [userId],
  );
}

/* ── Collection ─────────────────────────────────────────────── */

export type CollectionEntry = ShelfCard & {
  count: number;
  firstObtained: string;
  lastObtained: string;
  packName: string;
};

export async function getCollection(userId: string): Promise<CollectionEntry[]> {
  await vaultStalePulls(userId).catch(() => undefined);

  const { rows } = await query<
    CardRow & { count: number; first_obtained: string; last_obtained: string; pack_name: string }
  >(
    `select ${CARD_COLUMNS},
            count(*)::int as count,
            min(o.created_at) as first_obtained,
            max(o.created_at) as last_obtained,
            (array_agg(p.name order by o.created_at desc))[1] as pack_name
       from openings o
       join cards c on c.id = o.card_id
       join packs p on p.id = o.pack_id
      where o.user_id = $1 and o.status = 'vaulted'
      group by c.id
      order by max(c.value) desc nulls last, max(o.created_at) desc`,
    [userId],
  );

  return rows.map((r) => ({
    ...toCard(r),
    count: r.count,
    firstObtained: new Date(r.first_obtained).toISOString(),
    lastObtained: new Date(r.last_obtained).toISOString(),
    packName: r.pack_name,
  }));
}

/* ── Activity / transaction history ─────────────────────────── */

export type ActivityRow = {
  id: string;
  kind: "rip" | "vault" | "sell" | "sale" | "daily" | "signup" | "adjust";
  at: string;
  title: string;
  detail: string;
  packName?: string;
  cardName?: string;
  cardTier?: Rarity;
  cardThumb?: string;
  costCents?: number;
  amountCents?: number;
};

const TX_KIND: Record<string, ActivityRow["kind"]> = {
  sale: "sale",
  daily: "daily",
  signup: "signup",
  admin_adjust: "adjust",
  refund: "adjust",
  starter: "signup",
  pack_open: "rip",
};

export async function getActivity(userId: string, limit = 40): Promise<ActivityRow[]> {
  const [openings, txs] = await Promise.all([
    query<
      CardRow & {
        opening_id: string;
        pack_name: string;
        status: string;
        sold_cents: number | null;
        cost: number;
        created_at: string;
        decided_at: string | null;
      }
    >(
      `select ${CARD_COLUMNS}, o.id as opening_id, o.status, o.sold_cents, o.cost,
              o.created_at, o.decided_at, p.name as pack_name
         from openings o
         join cards c on c.id = o.card_id
         join packs p on p.id = o.pack_id
        where o.user_id = $1
        order by o.created_at desc
        limit $2`,
      [userId, limit],
    ),
    query<{ id: string; amount: number; kind: string; ref: string; created_at: string }>(
      `select id, amount, kind, ref, created_at
         from credit_transactions
        where user_id = $1
        order by created_at desc
        limit $2`,
      [userId, limit],
    ),
  ]);

  const rows: ActivityRow[] = [];

  for (const o of openings.rows) {
    const status = o.status;
    rows.push({
      id: `${o.opening_id}-rip`,
      kind: "rip",
      at: new Date(o.created_at).toISOString(),
      title: o.pack_name,
      detail: status === "sold" ? "Pull sold" : status === "vaulted" ? "Pull vaulted" : "Pull opened",
      packName: o.pack_name,
      cardName: o.name,
      cardTier: o.tier,
      cardThumb: o.thumb,
      costCents: o.cost ?? 0,
      amountCents: status === "sold" ? (o.sold_cents ?? 0) : undefined,
    });
    if (status === "sold" && o.decided_at) {
      rows.push({
        id: `${o.opening_id}-sale`,
        kind: "sell",
        at: new Date(o.decided_at).toISOString(),
        title: `Sold ${o.name}`,
        detail: "Simulated buyback",
        cardName: o.name,
        cardTier: o.tier,
        cardThumb: o.thumb,
        amountCents: o.sold_cents ?? 0,
      });
    }
    if (status === "vaulted" && o.decided_at) {
      rows.push({
        id: `${o.opening_id}-vault`,
        kind: "vault",
        at: new Date(o.decided_at).toISOString(),
        title: `Vaulted ${o.name}`,
        detail: "Added to your collection",
        cardName: o.name,
        cardTier: o.tier,
        cardThumb: o.thumb,
      });
    }
  }

  for (const t of txs.rows) {
    if (t.kind === "pack_open") continue; // already represented by the opening
    rows.push({
      id: `tx-${t.id}`,
      kind: TX_KIND[t.kind] ?? "adjust",
      at: new Date(t.created_at).toISOString(),
      title:
        t.kind === "sale"
          ? `Sale · ${t.ref || "card"}`
          : t.kind === "daily"
            ? "Daily reward"
            : t.kind === "signup"
              ? "Account opened"
              : t.kind === "refund"
                ? "Refund"
                : "Balance adjustment",
      detail: t.kind === "sale" ? "Simulated buyback" : "Virtual balance",
      amountCents: t.amount,
    });
  }

  return rows.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

export type OpeningsPage = {
  rows: (ShelfCard & {
    packName: string;
    cost: number;
    status: string;
    soldCents: number | null;
    createdAt: string;
    openingId: string;
  })[];
  total: number;
};

export async function getOpenings(userId: string, limit = 24, offset = 0): Promise<OpeningsPage> {
  const { rows } = await query<
    CardRow & {
      pack_name: string;
      cost: number;
      status: string;
      sold_cents: number | null;
      created_at: string;
      opening_id: string;
      total: number;
    }
  >(
    `select ${CARD_COLUMNS}, p.name as pack_name, o.cost, o.status, o.sold_cents,
            o.created_at, o.id as opening_id, count(*) over ()::int as total
       from openings o
       join cards c on c.id = o.card_id
       join packs p on p.id = o.pack_id
      where o.user_id = $1
      order by o.created_at desc
      limit $2 offset $3`,
    [userId, limit, offset],
  );
  return {
    total: rows[0]?.total ?? 0,
    rows: rows.map((r) => ({
      ...toCard(r),
      packName: r.pack_name,
      cost: r.cost,
      status: r.status,
      soldCents: r.sold_cents,
      createdAt: new Date(r.created_at).toISOString(),
      openingId: r.opening_id,
    })),
  };
}

/* ── Daily rewards ──────────────────────────────────────────── */

export type DailyState = {
  days: { day: number; credits: number; item: string }[];
  today: string;
  claimedToday: boolean;
  streak: number;
  nextDay: number;
};

const today = () => new Date().toISOString().slice(0, 10);

export async function getDailyState(user: AccountUser | null): Promise<DailyState> {
  const { rows } = await query<{ day_index: number; credits: number; item: string }>(
    "select day_index, credits, item from daily_rewards order by day_index",
  );
  const date = today();
  const days = rows.map((r) => ({ day: r.day_index, credits: r.credits, item: r.item }));
  if (!user) {
    return { days, today: date, claimedToday: false, streak: 0, nextDay: 1 };
  }
  const claimed = await one("select 1 from daily_claims where user_id = $1 and claim_date = $2", [
    user.id,
    date,
  ]);
  const cycle = days.length || 14;
  const nextDay = claimed ? ((user.streak - 1) % cycle) + 1 : (user.streak % cycle) + 1;
  return {
    days,
    today: date,
    claimedToday: Boolean(claimed),
    streak: user.streak,
    nextDay,
  };
}

export type ClaimResult =
  | { ok: true; credits: number; balance: number; day: number }
  | { ok: false; error: string };

export async function claimDaily(user: AccountUser): Promise<ClaimResult> {
  return withTransaction(async (client) => {
    const date = today();
    const userRes = await client.query<{ credits: number; daily_streak: number }>(
      "select credits, daily_streak from users where id = $1 for update",
      [user.id],
    );
    const account = userRes.rows[0];
    if (!account) return { ok: false, error: "Account not found." };

    const already = await client.query(
      "select 1 from daily_claims where user_id = $1 and claim_date = $2",
      [user.id, date],
    );
    if (already.rows.length > 0) return { ok: false, error: "Already claimed today." };

    const daysRes = await client.query<{ day_index: number; credits: number; item: string }>(
      "select day_index, credits, item from daily_rewards order by day_index",
    );
    const days = daysRes.rows;
    if (days.length === 0) return { ok: false, error: "No daily rewards configured." };

    // A streak survives one missed day; the cycle restarts after that.
    const last = await client.query<{ claim_date: string }>(
      "select claim_date from daily_claims where user_id = $1 order by claim_date desc limit 1",
      [user.id],
    );
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const continues = last.rows[0]?.claim_date === yesterday;
    const streak = continues ? account.daily_streak + 1 : 1;
    const day = days[(streak - 1) % days.length];
    const balanceAfter = account.credits + day.credits;

    await client.query(
      "update users set credits = $2, daily_streak = $3, updated_at = now() where id = $1",
      [user.id, balanceAfter, streak],
    );
    await client.query(
      "insert into daily_claims (user_id, claim_date, day_index, credits) values ($1,$2,$3,$4)",
      [user.id, date, day.day_index, day.credits],
    );
    await client.query(
      `insert into credit_transactions (user_id, amount, kind, ref, balance_after)
       values ($1, $2, 'daily', $3, $4)`,
      [user.id, day.credits, `day-${day.day_index}`, balanceAfter],
    );

    return { ok: true, credits: day.credits, balance: balanceAfter, day: day.day_index };
  });
}

/* ── Profile extras ─────────────────────────────────────────── */

export type ProfileStats = {
  rips: number;
  cards: number;
  collectionValue: number;
  bestValue: number;
  bestCard: ShelfCard | null;
  spent: number;
  soldTotal: number;
  soldCount: number;
  joined: string;
  recent: { card: ShelfCard; packName: string; createdAt: string }[];
};

export async function getProfileStats(user: AccountUser): Promise<ProfileStats> {
  const summary = await one<{
    rips: number;
    cards: number;
    collection_value: number;
    best_value: number;
    spent: number;
    sold_total: number;
    sold_count: number;
  }>(
    `select
       (select count(*)::int from openings where user_id = $1) as rips,
       (select count(distinct card_id)::int from openings where user_id = $1 and status = 'vaulted') as cards,
       (select coalesce(sum(c.value), 0)::int from (
          select distinct card_id from openings where user_id = $1 and status = 'vaulted') d
          join cards c on c.id = d.card_id) as collection_value,
       (select coalesce(max(c.value), 0)::int from openings o join cards c on c.id = o.card_id
         where o.user_id = $1 and o.status = 'vaulted') as best_value,
       (select coalesce(sum(cost), 0)::int from openings where user_id = $1) as spent,
       (select coalesce(sum(sold_cents), 0)::int from openings where user_id = $1 and status = 'sold') as sold_total,
       (select count(*)::int from openings where user_id = $1 and status = 'sold') as sold_count`,
    [user.id],
  );

  const best = await one<CardRow>(
    `select ${CARD_COLUMNS}
       from openings o join cards c on c.id = o.card_id
      where o.user_id = $1 and o.status = 'vaulted'
      order by c.value desc limit 1`,
    [user.id],
  );

  const recent = await query<CardRow & { pack_name: string; created_at: string }>(
    `select ${CARD_COLUMNS}, p.name as pack_name, o.created_at
       from openings o join cards c on c.id = o.card_id join packs p on p.id = o.pack_id
      where o.user_id = $1 order by o.created_at desc limit 6`,
    [user.id],
  );

  return {
    rips: summary?.rips ?? 0,
    cards: summary?.cards ?? 0,
    collectionValue: summary?.collection_value ?? 0,
    bestValue: summary?.best_value ?? 0,
    bestCard: best ? toCard(best) : null,
    spent: summary?.spent ?? 0,
    soldTotal: summary?.sold_total ?? 0,
    soldCount: summary?.sold_count ?? 0,
    joined: user.createdAt,
    recent: recent.rows.map((r) => ({
      card: toCard(r),
      packName: r.pack_name,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}

/** Latest high-value pulls across all accounts, for the live feed. */
export async function getRecentPulls(limit = 8) {
  const { rows } = await query<
    CardRow & { username: string; pack_name: string; created_at: string }
  >(
    `select ${CARD_COLUMNS}, u.username, p.name as pack_name, o.created_at
       from openings o
       join cards c on c.id = o.card_id
       join users u on u.id = o.user_id
       join packs p on p.id = o.pack_id
      where o.status <> 'sold'
      order by o.created_at desc
      limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    card: toCard(r),
    username: r.username,
    packName: r.pack_name,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export { refreshUser };

"use client";

import { useMemo, useState } from "react";
import { CardTile } from "@/components/pack/pack-tile";
import { fmtDate, fmtUsd, RARITIES, RARITY_LABEL, RARITY_ORDER, type Rarity } from "@/lib/domain";
import type { CollectionEntry } from "@/lib/server/shelf";

type Sort = "value-high" | "value-low" | "newest" | "oldest" | "rarity";

const SORTS: { id: Sort; label: string }[] = [
  { id: "value-high", label: "Highest value" },
  { id: "value-low", label: "Lowest value" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "rarity", label: "Rarity" },
];

export function CollectionBrowser({ entries }: { entries: CollectionEntry[] }) {
  const [tier, setTier] = useState<"all" | Rarity>("all");
  const [sort, setSort] = useState<Sort>("value-high");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map = new Map<Rarity, number>();
    for (const entry of entries) map.set(entry.tier, (map.get(entry.tier) ?? 0) + entry.count);
    return map;
  }, [entries]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = entries.filter(
      (entry) =>
        (tier === "all" || entry.tier === tier) &&
        (term === "" || entry.name.toLowerCase().includes(term) || entry.setName.toLowerCase().includes(term)),
    );
    list = [...list];
    if (sort === "value-high") list.sort((a, b) => b.value - a.value);
    if (sort === "value-low") list.sort((a, b) => a.value - b.value);
    if (sort === "newest") list.sort((a, b) => (a.lastObtained < b.lastObtained ? 1 : -1));
    if (sort === "oldest") list.sort((a, b) => (a.firstObtained < b.firstObtained ? -1 : 1));
    if (sort === "rarity")
      list.sort((a, b) => RARITY_ORDER[b.tier] - RARITY_ORDER[a.tier] || b.value - a.value);
    return list;
  }, [entries, query, sort, tier]);

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line-strong px-6 py-14 text-center">
        <h2 className="display text-[24px]">Nothing in the vault yet</h2>
        <p className="lede mx-auto mt-2 max-w-sm text-[14px]">
          Rip a pack, then choose VAULT on the result screen. The card lands here.
        </p>
        <a href="/packs" className="btn btn-violet mt-5">
          Open a pack
        </a>
      </div>
    );
  }

  const collectionValue = visible.reduce((sum, entry) => sum + entry.value * entry.count, 0);
  const marketValue = visible.reduce((sum, entry) => sum + (entry.marketCents ?? 0) * entry.count, 0);
  const missingMarket = visible.some((entry) => entry.marketCents == null);

  return (
    <div>
      <div className="flex flex-col gap-3 border-y border-line py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          <Chip active={tier === "all"} onClick={() => setTier("all")}>
            All <span className="text-ink-faint">{entries.reduce((sum, entry) => sum + entry.count, 0)}</span>
          </Chip>
          {[...RARITIES].reverse().map((r) => (
            <Chip key={r} active={tier === r} onClick={() => setTier(r)}>
              <span className={"rarity-" + r}>{RARITY_LABEL[r]}</span>
              <span className="text-ink-faint">{counts.get(r) ?? 0}</span>
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cards"
            className="h-9 w-40 rounded-sm border border-line-strong bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-violet-bright"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            aria-label="Sort collection"
            className="h-9 rounded-sm border border-line-strong bg-surface px-2.5 text-[13px] text-ink outline-none hover:border-white/25 focus:border-violet-bright"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12px] text-ink-mute">
        <span>
          {visible.length} {visible.length === 1 ? "card" : "cards"} shown
        </span>
        <span>
          Collection value <span className="num font-semibold text-ink-soft">{fmtUsd(collectionValue)}</span>
        </span>
        <span>
          Market reference{" "}
          <span className="num font-semibold text-ink-soft">
            {marketValue === 0 ? "Unavailable" : fmtUsd(marketValue)}
            {missingMarket && marketValue > 0 ? "+" : ""}
          </span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {visible.map((entry) => (
          <CardTile
            key={entry.id}
            card={{ ...entry, tier: entry.tier as Rarity }}
            footer={
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between gap-1.5 text-[10px]">
                  <span className="text-ink-faint">Market</span>
                  <span className={"num " + (entry.marketCents == null ? "text-ink-faint" : "text-ink-soft")}>
                    {entry.marketCents == null ? "Unavailable" : fmtUsd(entry.marketCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1.5 text-[10px] text-ink-faint">
                  <span className="truncate">{fmtDate(entry.lastObtained)}</span>
                  {entry.count > 1 ? (
                    <span className="num shrink-0 rounded-pill bg-white/[0.07] px-1.5 py-[1px] font-semibold text-ink-soft">
                      x{entry.count}
                    </span>
                  ) : null}
                </div>
              </div>
            }
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-[13px] text-ink-mute">
          No {tier === "all" ? "" : RARITY_LABEL[tier].toLowerCase() + " "}cards match that filter.
        </p>
      ) : null}

      <p className="mt-8 text-[11px] leading-relaxed text-ink-faint">
        Collection value is the platform&rsquo;s simulated valuation. Market reference is an estimate from a
        third-party price feed where one is available, not a guaranteed sale price. Neither is real money.
      </p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-2 text-[13px] font-medium transition-colors " +
        (active ? "bg-violet text-white" : "text-ink-mute hover:bg-white/[0.06] hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

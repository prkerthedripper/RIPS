"use client";

import { useMemo, useState } from "react";
import { PackTile } from "@/components/pack/pack-tile";
import { PACK_CATEGORY_LABEL, type PackCategory } from "@/lib/domain";
import type { ShelfPack } from "@/lib/server/shelf";

type Sort = "featured" | "price-low" | "price-high" | "value";

const CATEGORIES: PackCategory[] = ["free", "starter", "standard", "premium", "legendary", "special"];

export function PackCatalog({ packs }: { packs: ShelfPack[] }) {
  const [filter, setFilter] = useState<"all" | PackCategory>("all");
  const [sort, setSort] = useState<Sort>("featured");

  const present = useMemo(
    () => new Set(packs.map((pack) => pack.category as PackCategory)),
    [packs],
  );

  const visible = useMemo(() => {
    const matching = filter === "all" ? [...packs] : packs.filter((p) => p.category === filter);
    if (sort === "price-low") return matching.sort((a, b) => a.price - b.price);
    if (sort === "price-high") return matching.sort((a, b) => b.price - a.price);
    if (sort === "value") return matching.sort((a, b) => b.maxValue - a.maxValue);
    return matching;
  }, [filter, packs, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 border-y border-line py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All packs
          </FilterChip>
          {CATEGORIES.filter((category) => present.has(category)).map((category) => (
            <FilterChip
              key={category}
              active={filter === category}
              onClick={() => setFilter(category)}
            >
              {PACK_CATEGORY_LABEL[category].replace(" Packs", "")}
            </FilterChip>
          ))}
        </div>

        <label className="flex items-center gap-2.5 self-start text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute lg:self-auto">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="h-9 rounded-sm border border-line-strong bg-surface px-2.5 text-[13px] font-medium normal-case tracking-normal text-ink outline-none transition-colors hover:border-white/25 focus:border-violet-bright"
          >
            <option value="featured">Featured</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="value">Biggest pull</option>
          </select>
        </label>
      </div>

      <p aria-live="polite" className="mt-4 text-[12px] text-ink-mute">
        {visible.length} {visible.length === 1 ? "pack" : "packs"} on the shelf
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((pack, i) => (
          <PackTile key={pack.slug} pack={pack} priority={i < 4} />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
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
        "shrink-0 rounded-sm px-3.5 py-2 text-[13px] font-medium transition-colors " +
        (active ? "bg-violet text-white shadow-[0_6px_16px_rgba(76,29,149,0.45)]" : "text-ink-mute hover:bg-white/[0.06] hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

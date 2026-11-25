import Link from "next/link";
import { TcgCard } from "@/components/card/tcg-card";
import { PackArt } from "@/components/pack/pack-art";
import { colorwayFor } from "@/lib/pack-colorways";
import { fmtCredits, packArtLabel, packKindLabel, RARITY_LABEL, type Rarity } from "@/lib/domain";
import type { ShelfPack } from "@/lib/server/shelf";

/*
  Pack tile for the catalogue: the artwork on a dark stage, then name, price
  and the action row. The whole tile is a link to the pack page.
*/

export function PackTile({ pack, priority = false }: { pack: ShelfPack; priority?: boolean }) {
  return (
    <Link
      href={`/packs/${pack.slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-line bg-surface/70 transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-surface"
    >
      <div className="relative flex h-[228px] items-center justify-center overflow-hidden bg-[radial-gradient(70%_60%_at_50%_40%,rgba(255,255,255,0.06),transparent_70%)]">
        <span className="absolute left-3 top-3 z-10 rounded-pill border border-line-strong bg-black/30 px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.14em] text-ink-soft backdrop-blur-sm">
          {packKindLabel(pack.category)}
        </span>
        <PackArt
          name="RIPS"
          setName="Pokemon"
          label={packArtLabel(pack.name)}
          colorway={colorwayFor(pack.slug)}
          size="sm"
          className="transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </div>

      <div className="flex flex-1 flex-col border-t border-line px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-ink">{pack.name}</div>
            <div className="mt-0.5 truncate text-[11px] text-ink-mute">
              {pack.poolSize} cards · {pack.guaranteedValue != null
                ? `min ${fmtCredits(pack.guaranteedValue)}`
                : `top ${fmtCredits(pack.maxValue)}`}
            </div>
          </div>
          <span className="num shrink-0 text-[13px] font-bold text-ink">
            {pack.price === 0 ? "Free" : fmtCredits(pack.price)}
          </span>
        </div>

        {pack.topCards[0] ? (
          <div className="mt-2.5 flex items-center gap-2">
            <TcgCard
              src={pack.topCards[0].thumb}
              alt=""
              tier={pack.topCards[0].tier as Rarity}
              tilt={false}
              priority={priority}
              className="w-5 shrink-0"
            />
            <span className="truncate text-[11px] text-ink-mute">
              Top pull: <span className="text-ink-soft">{pack.topCards[0].name}</span>
            </span>
          </div>
        ) : null}

        <div className="mt-auto pt-3">
          <span className="flex h-9 w-full items-center justify-center rounded-sm border border-line-strong bg-white/[0.04] text-[12px] font-semibold text-ink transition-colors group-hover:border-violet-bright/60 group-hover:bg-violet/20">
            Open pack
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CardTile({
  card,
  footer,
}: {
  card: { id: string; name: string; image: string; thumb: string; tier: Rarity; value: number; setName: string };
  footer?: React.ReactNode;
}) {
  return (
    <article className="group">
      <TcgCard src={card.image} alt={`${card.name} card`} tier={card.tier} />
      <div className="mt-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">{card.name}</div>
          <div className={"mt-0.5 text-[11px] rarity-" + card.tier}>{RARITY_LABEL[card.tier]}</div>
        </div>
        <span className="num shrink-0 text-[12px] font-semibold text-ink-soft">{fmtCredits(card.value)}</span>
      </div>
      {footer}
    </article>
  );
}

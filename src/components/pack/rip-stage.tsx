"use client";

import { useEffect, useMemo, useState } from "react";
import { TcgCard } from "@/components/card/tcg-card";
import { PackArt } from "@/components/pack/pack-art";
import { colorwayFor } from "@/lib/pack-colorways";
import type { ShelfPack } from "@/lib/server/shelf";
import { fmtUsd, packArtLabel, packKindLabel, type Rarity } from "@/lib/domain";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

/*
  The rips stage.

  Reference structure, in order: the pack carousel (centre pack raised and
  full strength, neighbours dimmed), the quantity selector with the speed
  control beside it, the Min Value / Max Pull / Pack Style row, then the wide
  rose-gold buy button. Picking a neighbour brings it to the centre.
*/

/** Kept in step with the server's RIP_QUANTITIES allow-list. */
const QUANTITIES = [1, 2, 5, 10] as const;
type Props = {
  packs: ShelfPack[];
  initialSlug?: string;
  /** The chosen pack count travels with the pack: 10x rips ten packs. */
  onBuy: (pack: ShelfPack, qty: number) => void;
  busy: boolean;
  message?: string | null;
  signedIn: boolean;
};

export function RipStage({ packs, initialSlug, onBuy, busy, message, signedIn }: Props) {
  const startIndex = Math.max(
    0,
    packs.findIndex((p) => p.slug === initialSlug),
  );
  const [index, setIndex] = useState(startIndex);
  const [qty, setQty] = useState<number>(1);
  const [speed, setSpeed] = useState(true);

  const active = packs[index];

  // Neighbours: the pack before and after, wrapping around.
  const neighbours = useMemo(() => {
    if (packs.length < 3) return [] as ShelfPack[];
    const prev = packs[(index - 1 + packs.length) % packs.length];
    const next = packs[(index + 1) % packs.length];
    return [prev, next];
  }, [index, packs]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setIndex((i) => (i - 1 + packs.length) % packs.length);
      if (event.key === "ArrowRight") setIndex((i) => (i + 1) % packs.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [packs.length]);

  if (!active) return null;

  const hero = active.topCards[0];
  const total = active.price * qty;

  return (
    <div className="relative">
      {/* carousel */}
      <div className="relative mx-auto flex max-w-[860px] items-center justify-center gap-4 px-2 sm:gap-10 md:gap-16">
        {packs.length >= 3 ? (
          <SidePack pack={neighbours[0]} onClick={() => setIndex((index - 1 + packs.length) % packs.length)} />
        ) : null}

        <div className="relative flex flex-col items-center">
          <ChaseBadge card={hero} />
          <button
            type="button"
            onClick={() => onBuy(active, qty)}
            disabled={busy}
            aria-label={`Rip ${active.name} for ${fmtUsd(total)}`}
            className="group relative mt-2 block transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1"
          >
            <PackArt
              name="RIPS"
              setName="Pokemon"
              label={packArtLabel(active.name)}
              colorway={colorwayFor(active.slug)}
              size="lg"
              className="max-w-[46vw] sm:max-w-none"
            />
          </button>
        </div>

        {packs.length >= 3 ? (
          <SidePack pack={neighbours[1]} onClick={() => setIndex((index + 1) % packs.length)} />
        ) : null}
      </div>

      {/* selector row */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-line-strong bg-surface/80">
          {QUANTITIES.map((value) => {
            const selected = qty === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setQty(value)}
                aria-pressed={selected}
                className={
                  "h-11 min-w-[52px] border-r border-white/[0.07] px-3 text-[13px] font-semibold transition-colors last:border-r-0 " +
                  (selected
                    ? "bg-gradient-to-b from-violet-bright to-violet text-white"
                    : "text-ink-mute hover:bg-white/[0.05] hover:text-ink")
                }
              >
                {value}x
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setSpeed((s) => !s)}
          aria-pressed={speed}
          className={
            "flex h-11 items-center gap-2 rounded-md border px-3.5 text-[12px] font-bold uppercase tracking-[0.1em] transition-colors " +
            (speed
              ? "border-violet-bright/60 bg-violet/20 text-ink"
              : "border-line-strong bg-surface/80 text-ink-mute hover:text-ink")
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13 2 4.5 13.5H11l-1 8.5 9-12h-6.5z" />
          </svg>
          Speed
        </button>
      </div>

      {/* stats */}
      <div className="mx-auto mt-7 grid max-w-[560px] grid-cols-3 items-start gap-2 text-center">
        <Stat label="Min Value" value={active.minValue === 0 ? "Free" : fmt(active.minValue)} />
        <Stat label="Max Pull" value={fmt(active.maxValue)} big />
        <Stat label="Pool Size" value={`${active.poolSize}`} />
      </div>

      {/* buy */}
      <div className="mx-auto mt-7 flex w-full max-w-[340px] flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => onBuy(active, qty)}
          disabled={busy}
          className="btn btn-rose h-14 w-full text-[17px] font-bold tracking-[0.01em]"
        >
          {busy ? "Ripping…" : active.price === 0 ? "Rip free pack" : `Buy for ${fmtUsd(total)}`}
        </button>
        <p className="min-h-[16px] text-center text-[12px] text-ink-mute">
          {message
            ? message
            : signedIn
              ? `${active.poolSize} cards in the pool · ${qty === 1 ? "one card" : `${qty} cards`} per rip`
              : "Sign in to rip — new accounts get one free starter pack"}
        </p>
      </div>

      {/* pack name + pager */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Previous pack"
          onClick={() => setIndex((index - 1 + packs.length) % packs.length)}
          className="grid h-8 w-8 place-items-center rounded-full border border-line-strong text-ink-mute transition-colors hover:border-white/30 hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-center">
          <div className="display text-[18px] tracking-[0.02em]">{active.name}</div>
          <div className="label-micro mt-1">{packKindLabel(active.category)}</div>
        </div>
        <button
          type="button"
          aria-label="Next pack"
          onClick={() => setIndex((index + 1) % packs.length)}
          className="grid h-8 w-8 place-items-center rounded-full border border-line-strong text-ink-mute transition-colors hover:border-white/30 hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SidePack({ pack, onClick }: { pack: ShelfPack; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Select ${pack.name}`}
      className="group relative hidden shrink-0 opacity-70 saturate-[0.7] transition-all duration-300 hover:opacity-100 hover:saturate-100 sm:block"
    >
      <PackArt
        name="RIPS"
        setName="Pokemon"
        label={packArtLabel(pack.name)}
        colorway={colorwayFor(pack.slug)}
        size="md"
        live={false}
        className="max-w-[26vw]"
      />
      <span className="pointer-events-none absolute inset-x-0 -bottom-7 text-center text-[11px] font-medium text-ink-mute group-hover:text-ink">
        {pack.name}
      </span>
    </button>
  );
}

function ChaseBadge({ card }: { card?: ShelfPack["topCards"][number] }) {
  if (!card) return null;
  return (
    <div className="mb-3 flex flex-col items-center">
      <div className="relative grid h-14 w-14 place-items-center">
        <span className="absolute inset-0 rounded-full bg-violet/25 blur-md" />
        <TcgCard
          src={card.thumb}
          alt={`${card.name} — top pull`}
          tier={card.tier as Rarity}
          tilt={false}
          priority
          className="w-11 rotate-[-6deg]"
        />
      </div>
      <div className="mt-1.5 rounded-pill bg-gradient-to-b from-violet-bright to-violet-deep px-2.5 py-[3px] text-[9px] font-extrabold uppercase tracking-[0.16em] text-white shadow-[0_4px_12px_rgba(76,29,149,0.6)]">
        Chase
      </div>
      <div className="num mt-1 text-[9px] font-semibold text-ink-mute">{fmt(card.value)}</div>
    </div>
  );
}

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-ink-mute">{label}</div>
      <div
        className={
          "num mt-1 font-bold text-ink " + (big ? "text-[24px] leading-none" : "text-[15px] leading-tight")
        }
      >
        {value}
      </div>
    </div>
  );
}




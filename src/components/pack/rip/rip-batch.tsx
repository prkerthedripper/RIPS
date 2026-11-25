"use client";

/*
  Multi-pack pull layer.

  While the rarity ribbon spins, every card in the batch shows its back and
  spins in a loose stack — you can see how many packs are in play. On the
  reveal the batch deals out into a grid and each card flips to its artwork,
  staggered, so ten packs land as ten separate hits.
*/

import { fmtUsd } from "@/lib/domain";
import type { ShelfCard } from "@/lib/server/shelf";
import type { RipPhase } from "./rip-scene";

export function BatchCards({
  cards,
  phase,
}: {
  cards: ShelfCard[];
  phase: RipPhase;
}) {
  const count = cards.length;
  const spinning = phase === "emerging" || phase === "roulette";
  const dealt = phase === "reveal" || phase === "result";

  const cols = count <= 2 ? 2 : count <= 5 ? count : 5;
  const width = count <= 2 ? 148 : count <= 5 ? 116 : 104;

  // A batch of ten spreads into two rows of five; smaller batches breathe more.
  const spinW = count > 5 ? 122 : 112;
  const spinH = Math.round(spinW * 1.42);
  const spinX = count > 5 ? 150 : 140;
  const spinY = count > 5 ? 206 : 0;

  return (
    <div
      className="pointer-events-none absolute inset-0 flex justify-center overflow-y-auto px-3 py-2"
      style={{ perspective: "1200px" }}
      aria-hidden={spinning}
    >
      {spinning ? (
        <div className="relative flex h-full w-full items-center justify-center">
          {cards.map((card, index) => (
            <div
              key={`${card.id}-spin-${index}`}
              className="absolute"
              style={{
                // A loose two-row spread, so ten packs read as ten spinning
                // cards rather than one stack.
                transform: `translate(${((index % 5) - 2) * spinX}px, ${
                  (Math.floor(index / 5) - (count > 5 ? 0.5 : 0)) * spinY
                }px)`,
              }}
            >
              <div
                className="rip-card-spin rounded-[6px] border border-white/15 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
                style={{
                  width: spinW,
                  height: spinH,
                  animationDelay: `${-index * 0.105}s`,
                  boxShadow: "0 18px 50px rgba(0,0,0,0.55), 0 0 34px rgba(139,92,246,0.22)",
                }}
              >
                <CardBack />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {dealt ? (
        <div
          className={"my-auto grid gap-x-3 gap-y-4 " + (phase === "result" ? "" : "items-start")}
          style={{ gridTemplateColumns: `repeat(${cols}, ${width}px)` }}
        >
          {cards.map((card, index) => (
            <figure
              key={`${card.id}-dealt-${index}`}
              className="rip-card-deal m-0"
              style={{ animationDelay: `${index * 38}ms` }}
            >
              <div className="overflow-hidden rounded-[6px] border border-white/12 bg-black/40 shadow-[0_14px_36px_rgba(0,0,0,0.5)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.image}
                  alt={card.name}
                  width={width}
                  height={Math.round(width * 1.4)}
                  className="block h-auto w-full"
                  loading="eager"
                  decoding="async"
                />
              </div>
              {phase === "result" ? (
                <figcaption className="mt-1.5 text-center">
                  <div className="truncate text-[10px] font-semibold text-ink">{card.name}</div>
                  <div className="num mt-0.5 text-[10px] text-ink-mute">{fmtUsd(card.value)}</div>
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** House card back, drawn in CSS so the batch needs no extra asset. */
function CardBack() {
  return (
    <div className="rip-card-back relative grid h-full w-full place-items-center overflow-hidden rounded-[6px]">
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true" className="opacity-90">
        <path
          d="M32 6 55 17v19c0 12-9 20-23 24C18 56 9 48 9 36V17L32 6Z"
          fill="rgba(20,7,36,0.55)"
          stroke="rgba(233,200,255,0.9)"
          strokeWidth="2.5"
        />
        <path d="M20 40h24l-2.5-16-6.5 7-3-11-3 11-6.5-7L20 40Z" fill="rgba(240,220,255,0.95)" />
      </svg>
    </div>
  );
}

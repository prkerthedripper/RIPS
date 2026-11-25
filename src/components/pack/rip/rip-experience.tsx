"use client";

/*
  The rip experience.

  Intro → pick how many packs (1, 2, 5 or 10) → grab the seal and drag → the
  foil tears under the pointer → the card(s) rise out face-down → the rarity
  ribbon spins and lands on the result the server already picked → a beat on
  the landed rarity → the card(s) turn over → VAULT or SELL.

  The open request fires on the grab, so every card is decided before a single
  frame of the reveal plays: the animation can only ever show that result.
  Until the flip, a single card is printed with its back on both faces and a
  batch shows only card backs, so no angle, spin or reflection can reveal the
  artwork early.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PACK_DIMS, type PackLook } from "@/components/pack/three/pack-scene";
import { colorwayFor } from "@/lib/pack-colorways";
import {
  fmtUsd,
  packArtLabel,
  RARITY_LABEL,
  RARITY_ORDER,
  SELL_RATE,
  type Rarity,
} from "@/lib/domain";
import { rarityVisual } from "@/lib/rarity-visuals";
import type { ShelfCard, ShelfPack } from "@/lib/server/shelf";
import { RipAudio } from "./audio";
import { BatchCards } from "./rip-batch";
import { RIP_PHASE_MS, RipCanvas, type RipControl, type RipPhase } from "./rip-scene";

const HALF_W = PACK_DIMS.halfWidth;

/** Kept in step with the server's RIP_QUANTITIES allow-list. */
const QUANTITIES = [1, 2, 5, 10] as const;

type OpenResponse = {
  cards: ShelfCard[];
  balance: number;
  openingIds: string[];
  cost: number;
  qty: number;
  card: ShelfCard;
  openingId: string;
};

type Stage = { phase: RipPhase; start: number };

type Resolution =
  | { kind: "vault"; balance: number; count: number }
  | { kind: "sell"; balance: number; count: number; soldCents: number };

const PHASE_COPY: Partial<Record<RipPhase, string>> = {
  committing: "Opening the pack…",
  opening: "It's open",
  emerging: "Something is coming out…",
  roulette: "Reading the rarity…",
};

export function RipExperience({
  pack,
  onClose,
  balance = null,
  initialQty = 1,
}: {
  pack: ShelfPack;
  onClose: () => void;
  /** The signed-in balance in cents, when the page knows it. Null skips the check. */
  balance?: number | null;
  /** Packs already chosen before opening (1, 2, 5 or 10). */
  initialQty?: number;
}) {
  const [stage, setStage] = useState<Stage>({ phase: "intro", start: performance.now() });
  const [qty, setQty] = useState(() =>
    (QUANTITIES as readonly number[]).includes(initialQty) ? initialQty : 1,
  );
  const [result, setResult] = useState<OpenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [oddsOpen, setOddsOpen] = useState(false);
  const [confirmSell, setConfirmSell] = useState(false);
  const [working, setWorking] = useState<"vault" | "sell" | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const control = useRef<RipControl>({ front: -HALF_W, dragging: false, speed: 0, keyboard: false });
  const audio = useMemo(() => new RipAudio(), []);
  const started = useRef(false);
  const failed = useRef(false);
  const tearDone = useRef(false);
  const sequenced = useRef(false);
  const resultRef = useRef<OpenResponse | null>(null);
  const timers = useRef<number[]>([]);
  const closing = useRef(false);
  const phaseRef = useRef(stage.phase);
  phaseRef.current = stage.phase;

  const cards = result?.cards ?? [];
  const multi = cards.length > 1;
  const bestTier = useMemo<Rarity>(
    () =>
      cards.reduce<Rarity>(
        (best, card) => (RARITY_ORDER[card.tier] > RARITY_ORDER[best] ? card.tier : best),
        "common",
      ),
    [cards],
  );
  const tier = (multi ? bestTier : (cards[0]?.tier ?? "common")) as Rarity;
  const visual = rarityVisual(tier);

  // What this selection costs, and whether the account can pay for it. A rip
  // that the server is certain to refuse is never started: the whole batch is
  // charged up front, so the count has to be affordable before the tear.
  const cost = pack.price * qty;
  const shortfall = balance == null ? 0 : Math.max(0, cost - balance);
  const affordable = shortfall === 0;

  const totals = useMemo(
    () => ({
      collection: cards.reduce((sum, card) => sum + card.value, 0),
      market: cards.reduce((sum, card) => sum + (card.marketCents ?? 0), 0),
      sell: cards.reduce((sum, card) => sum + card.sellCents, 0),
      missingMarket: cards.some((card) => card.marketCents == null),
    }),
    [cards],
  );

  const look = useMemo<PackLook>(() => {
    const colorway = colorwayFor(pack.slug);
    return {
      key: [pack.slug, pack.name].join("|"),
      wordmark: "RIPS",
      colorway,
      setName: "Pokemon",
      label: packArtLabel(pack.name),
    };
  }, [pack.slug, pack.name]);

  const go = useCallback((phase: RipPhase) => {
    setStage({ phase, start: performance.now() });
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const startSequence = useCallback(() => {
    if (sequenced.current) return;
    sequenced.current = true;
    audio.pop();
    go("opening");
    const opening = RIP_PHASE_MS.opening;
    const emerging = RIP_PHASE_MS.emerging;
    const roulette = RIP_PHASE_MS.roulette;
    const landed = RIP_PHASE_MS.landed;
    schedule(() => {
      go("emerging");
      audio.whoosh(1.5);
    }, opening);
    schedule(() => go("roulette"), opening + emerging);
    schedule(() => {
      go("landed");
      audio.land();
    }, opening + emerging + roulette);
    schedule(() => {
      go("reveal");
      audio.reveal();
    }, opening + emerging + roulette + landed);
    schedule(() => go("result"), opening + emerging + roulette + landed + RIP_PHASE_MS.reveal);
  }, [audio, go, schedule]);

  const beginRip = useCallback(() => {
    if (started.current) return;
    if (!affordable) {
      setError(
        `${fmtUsd(cost)} for ${qty} pack${qty === 1 ? "" : "s"} — you have ${fmtUsd(balance ?? 0)}. ` +
          `You need ${fmtUsd(shortfall)} more: pick fewer packs, or earn more in daily rewards.`,
      );
      return;
    }
    started.current = true;
    failed.current = false;
    tearDone.current = false;
    setError(null);
    setStage((current) => (current.phase === "intro" ? { phase: "tearing", start: performance.now() } : current));

    fetch("/api/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: pack.slug, qty }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.cards?.length) {
          throw new Error(data?.error ?? "The rip did not go through.");
        }
        const payload = data as OpenResponse;
        resultRef.current = payload;
        setResult(payload);
        // If the foil is still in the user's hand, let them finish the pull:
        // the completion handler starts the sequence. Only show the wait when
        // the pack is already open and we are still reading the result.
        if (tearDone.current) startSequence();
      })
      .catch((reason: Error) => {
        started.current = false;
        // The tear completes after the refusal arrives; without this the
        // sequence would advance to "committing" and sit there forever.
        failed.current = true;
        control.current.front = -HALF_W;
        control.current.dragging = false;
        audio.stopTear();
        setError(reason.message || "Something went wrong. Try again.");
        go("intro");
      });
  }, [affordable, audio, balance, cost, go, pack.slug, qty, shortfall, startSequence]);

  const handleComplete = useCallback(() => {
    if (failed.current) return;
    tearDone.current = true;
    audio.pop();
    if (resultRef.current) startSequence();
    else go("committing");
  }, [audio, go, startSequence]);

  const handleGrab = useCallback(() => {
    beginRip();
  }, [beginRip]);

  const handleInteract = useCallback((active: boolean) => {
    if (active) setError(null);
  }, []);

  // focus trap light: escape closes when nothing is in flight
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !started.current) onClose();
      if ((event.key === " " || event.key === "Enter") && phaseRef.current === "intro" && !started.current) {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "BUTTON" || target.tagName === "A")) return;
        event.preventDefault();
        control.current.keyboard = true;
        beginRip();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") control.current.keyboard = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      document.body.style.overflow = "";
    };
  }, [beginRip, onClose]);

  useEffect(() => {
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      audio.dispose();
    };
  }, [audio]);

  useEffect(() => {
    audio.setMuted(muted);
  }, [audio, muted]);

  /** VAULT or SELL the pending pull(s), then hand the user back to the shelf. */
  const decide = useCallback(
    async (kind: "vault" | "sell") => {
      if (!result || working || resolution) return;
      setWorking(kind);
      setActionError(null);
      try {
        const response = await fetch(kind === "vault" ? "/api/vault" : "/api/sell", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ openingIds: result.openingIds }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "That did not go through.");

        setConfirmSell(false);
        setResolution(
          kind === "vault"
            ? { kind: "vault", balance: data.balance, count: data.count ?? result.openingIds.length }
            : {
                kind: "sell",
                balance: data.balance,
                count: data.count ?? result.openingIds.length,
                soldCents: data.soldCents ?? totals.sell,
              },
        );
        if (kind === "sell") audio.land();
        schedule(() => {
          if (closing.current) return;
          closing.current = true;
          onClose();
        }, 1900);
      } catch (reason) {
        setActionError((reason as Error).message || "That did not go through.");
      } finally {
        setWorking(null);
      }
    },
    [audio, onClose, resolution, result, schedule, totals.sell, working],
  );

  const done = stage.phase === "result";
  const busy = stage.phase !== "intro" && !done;
  const showIntro = stage.phase === "intro";
  const showOdds = pack.tiers.filter((entry) => entry.chance > 0);
  const single = cards[0];
  const landed = stage.phase === "landed" || stage.phase === "reveal";
  const batchVisible = multi && ["emerging", "roulette", "reveal", "result"].includes(stage.phase);
  const canChooseQty = !pack.freePerAccount && pack.price > 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#06040a] text-ink"
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${pack.name}`}
      data-phase={stage.phase}
      data-tier={done || landed ? tier : undefined}
      data-qty={qty}
    >
      {/* rarity aura, driven by the real result */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-[1200ms]"
        style={{
          background:
            stage.phase === "reveal" || done
              ? `radial-gradient(80% 70% at 50% 38%, ${visual.color}2e, transparent 62%), radial-gradient(120% 100% at 50% 100%, ${visual.deep}, #05030a 70%)`
              : landed
                ? `radial-gradient(70% 62% at 50% 40%, ${visual.color}22, transparent 66%), radial-gradient(120% 100% at 50% 100%, #0a0512, #040208 70%)`
                : "radial-gradient(60% 55% at 50% 40%, rgba(124,58,237,0.14), transparent 68%), radial-gradient(120% 100% at 50% 100%, #0a0512, #040208 70%)",
        }}
        aria-hidden="true"
      />
      {tier === "secret" && (stage.phase === "reveal" || done) ? (
        <div className="rip-rainbow pointer-events-none absolute inset-0 opacity-[0.13]" aria-hidden="true" />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_40%,rgba(0,0,0,0.55))]" aria-hidden="true" />

      <div className="relative flex h-full flex-col">
        <header className="relative z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <div className="label-micro text-ink-mute">Ripping{multi || qty > 1 ? ` · ${qty} packs` : ""}</div>
            <div className="display truncate text-[19px] leading-tight sm:text-[22px]">{pack.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-pressed={muted}
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-ink-soft transition-colors hover:border-white/35 hover:text-ink"
            >
              {muted ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 9v6h3.5L13 19V5L7.5 9H4Z" strokeLinejoin="round" />
                  <path d="m16.5 9.5 4 5m0-5-4 5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 9v6h3.5L13 19V5L7.5 9H4Z" strokeLinejoin="round" />
                  <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy || Boolean(working) || Boolean(resolution)}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-ink-soft transition-colors hover:border-white/35 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <RipCanvas
            look={look}
            phase={stage.phase}
            phaseStart={stage.start}
            tier={tier}
            cardImage={multi ? "" : (single?.image ?? "")}
            cardName={multi ? pack.name : (single?.name ?? pack.name)}
            control={control}
            audio={audio}
            onGrab={handleGrab}
            onTearComplete={handleComplete}
            onInteract={handleInteract}
          />

          {batchVisible ? <BatchCards cards={cards} phase={stage.phase} /> : null}

          {stage.phase === "reveal" ? <div key="flash" className="rip-flash pointer-events-none absolute inset-0 bg-white" aria-hidden="true" /> : null}

          {/* live region for the sequence */}
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
            {PHASE_COPY[stage.phase] ? (
              <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft backdrop-blur">
                {PHASE_COPY[stage.phase]}
              </span>
            ) : null}
          </div>

          {/* the landed rarity: shown before the card turns over */}
          {landed && !done && !multi ? (
            <div
              className="rip-rise pointer-events-none absolute inset-x-0 top-[14%] flex justify-center px-4"
              data-testid="rarity-landing"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <span
                  className="rounded-pill border px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.28em]"
                  style={{
                    color: visual.bright,
                    borderColor: `${visual.color}88`,
                    background: `${visual.color}1f`,
                    boxShadow: `0 0 40px ${visual.glow}`,
                  }}
                >
                  {visual.name}
                </span>
                <span className="text-[10px] uppercase tracking-[0.24em] text-ink-faint">Rarity locked</span>
              </div>
            </div>
          ) : null}

          {/* grab affordance */}
          {showIntro ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-4">
              <div className="rip-hint flex items-center gap-3 rounded-full border border-white/12 bg-black/45 px-4 py-2 backdrop-blur-md">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="text-violet-bright">
                  <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-.5V5a1.5 1.5 0 0 1 3 0v6m0-.5V7a1.5 1.5 0 0 1 3 0v7.5" strokeLinecap="round" />
                  <path d="M8 12c-1.2-1.6-2.4-2.2-3.2-1.4-.8.8-.3 2.2.5 3.6.9 1.6 2 3.4 3.4 4.4 1.2.9 2.7 1.4 4.3 1.4 3.3 0 5.5-2.3 5.5-5.5" strokeLinecap="round" />
                </svg>
                <span className="text-[12px] font-semibold text-ink-soft">
                  Grab the seal, then <span className="text-ink">drag across</span>
                </span>
                <span className="hidden text-[11px] text-ink-mute sm:inline">or press Space</span>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
              <div
                role="alert"
                className="flex max-w-[520px] flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-sm border border-rose/40 bg-[#2a0f0c]/85 px-3 py-2 text-[12px] font-medium text-rose-bright"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    failed.current = false;
                    started.current = false;
                    tearDone.current = false;
                    control.current.front = -HALF_W;
                    control.current.dragging = false;
                    go("intro");
                  }}
                  className="shrink-0 font-semibold text-ink underline underline-offset-4"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="relative z-20 px-4 pb-5 pt-2 sm:px-6 sm:pb-7">
          {resolution ? (
            <div className="rip-rise mx-auto w-full max-w-[460px] text-center" data-testid="resolution">
              <div
                className="mx-auto grid h-14 w-14 place-items-center rounded-full border"
                style={{ borderColor: `${visual.color}88`, background: `${visual.color}22`, color: visual.bright }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="m4 12.5 5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="display mt-4 text-[30px] leading-none">
                {resolution.kind === "vault"
                  ? resolution.count > 1
                    ? `${resolution.count} cards vaulted`
                    : "Added to your vault"
                  : resolution.count > 1
                    ? `${resolution.count} cards sold`
                    : "Sale complete"}
              </h2>
              <p className="num mt-2 text-[13px] text-ink-soft">
                {resolution.kind === "vault"
                  ? "In your collection now."
                  : `${fmtUsd(resolution.soldCents)} added · balance ${fmtUsd(resolution.balance)}`}
              </p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Returning to the shelf…
              </p>
            </div>
          ) : done && single && !multi ? (
            <div className="rip-rise mx-auto w-full max-w-[460px]" data-testid="result">
              <div className="text-center">
                <div className="label-micro" style={{ color: visual.color }}>
                  {visual.name}
                </div>
                <h2 className="display mt-1.5 text-[28px] leading-none sm:text-[33px]">{single.name}</h2>
                <p className="mt-1.5 text-[12px] text-ink-mute">
                  {single.setName} · #{single.number} · {RARITY_LABEL[single.tier]}
                </p>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 rounded-md border border-white/10 bg-black/35 px-2 py-2.5 backdrop-blur-sm">
                <Value
                  label="Reference market"
                  value={single.marketCents == null ? "Unavailable" : fmtUsd(single.marketCents)}
                  unavailable={single.marketCents == null}
                />
                <Value label="Collection value" value={fmtUsd(single.value)} />
                <Value label="Sell now" value={fmtUsd(single.sellCents)} accent={visual.color} />
              </dl>

              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => decide("vault")}
                  disabled={Boolean(working)}
                  className="btn btn-violet h-[52px] text-[14px] font-bold tracking-[0.12em] disabled:opacity-60"
                >
                  {working === "vault" ? "Vaulting…" : "VAULT"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSell(true)}
                  disabled={Boolean(working)}
                  className="btn btn-quiet h-[52px] border-white/25 text-[14px] font-bold tracking-[0.12em] disabled:opacity-60"
                >
                  {working === "sell" ? "Selling…" : "SELL"}
                </button>
              </div>

              {actionError ? (
                <p role="alert" className="mt-2.5 text-center text-[11px] text-rose-bright">
                  {actionError}
                </p>
              ) : null}

              <p className="mt-3 text-center text-[10px] leading-relaxed text-ink-faint">
                {single.marketSource ? `${marketLabel(single.marketSource)} reference` : "Market reference"} is an
                estimate, not a guaranteed price. Selling pays {Math.round(SELL_RATE * 100)}% of collection
                value in simulated virtual USD — no cash value.
              </p>
            </div>
          ) : done && multi ? (
            <div className="rip-rise mx-auto w-full max-w-[520px]" data-testid="result">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="label-micro" style={{ color: visual.color }}>
                    Best pull · {visual.name}
                  </div>
                  <h2 className="display mt-1 text-[26px] leading-none sm:text-[30px]">
                    {cards.length} cards
                  </h2>
                </div>
                <p className="num text-[11px] text-ink-mute">
                  Spent {fmtUsd(result?.cost ?? 0)} · balance {fmtUsd(result?.balance ?? 0)}
                </p>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 rounded-md border border-white/10 bg-black/35 px-2 py-2.5 backdrop-blur-sm">
                <Value
                  label="Reference market"
                  value={totals.market === 0 ? "Unavailable" : `${fmtUsd(totals.market)}${totals.missingMarket ? "+" : ""}`}
                />
                <Value label="Collection value" value={fmtUsd(totals.collection)} />
                <Value label="Sell all for" value={fmtUsd(totals.sell)} accent={visual.color} />
              </dl>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => decide("vault")}
                  disabled={Boolean(working)}
                  className="btn btn-violet h-[52px] text-[13px] font-bold tracking-[0.1em] disabled:opacity-60"
                >
                  {working === "vault" ? "Vaulting…" : `VAULT ALL ${cards.length}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSell(true)}
                  disabled={Boolean(working)}
                  className="btn btn-quiet h-[52px] border-white/25 text-[13px] font-bold tracking-[0.1em] disabled:opacity-60"
                >
                  {working === "sell" ? "Selling…" : `SELL ALL ${fmtUsd(totals.sell)}`}
                </button>
              </div>

              {actionError ? (
                <p role="alert" className="mt-2.5 text-center text-[11px] text-rose-bright">
                  {actionError}
                </p>
              ) : null}

              <p className="mt-2.5 text-center text-[10px] leading-relaxed text-ink-faint">
                Each pack was drawn separately on the server. Selling pays {Math.round(SELL_RATE * 100)}% of
                collection value per card in simulated virtual USD — no cash value.
              </p>
            </div>
          ) : showIntro ? (
            <div className="mx-auto w-full max-w-[600px]">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px] text-ink-mute">
                <span className="num">
                  {pack.price === 0 ? "Free" : fmtUsd(pack.price)}
                  {qty > 1 ? (
                    <span className="text-ink-faint">
                      {" "}
                      × {qty} · {fmtUsd(cost)} total
                    </span>
                  ) : null}
                </span>
                <span className="hidden h-3 w-px bg-white/15 sm:block" />
                <span>{qty === 1 ? "Exactly one card" : `${qty} packs, ${qty} cards`}, chosen server-side</span>
                <button
                  type="button"
                  onClick={() => setOddsOpen((open) => !open)}
                  aria-expanded={oddsOpen}
                  className="font-semibold text-ink-soft underline underline-offset-4 transition-colors hover:text-ink"
                >
                  Odds
                </button>
                <button
                  type="button"
                  onClick={() => {
                    control.current.keyboard = true;
                    beginRip();
                  }}
                  className="font-semibold text-ink-soft underline underline-offset-4 transition-colors hover:text-ink"
                >
                  Tear without dragging
                </button>
              </div>

              {canChooseQty ? (
                <div className="mt-3">
                  <div className="flex items-center justify-center gap-1.5" role="group" aria-label="How many packs">
                    <span className="mr-1 text-[10px] uppercase tracking-[0.18em] text-ink-faint">Packs</span>
                    {QUANTITIES.map((n) => {
                      const costN = pack.price * n;
                      const short = balance == null ? 0 : Math.max(0, costN - balance);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setQty(n)}
                          aria-pressed={qty === n}
                          aria-label={`${n} pack${n === 1 ? "" : "s"} for ${fmtUsd(costN)}`}
                          title={
                            short > 0
                              ? `${fmtUsd(costN)} — ${fmtUsd(short)} more than your balance`
                              : `${n} pack${n === 1 ? "" : "s"} · ${fmtUsd(costN)}`
                          }
                          className={
                            "num flex h-9 min-w-11 flex-col items-center justify-center rounded-sm border px-2 leading-none transition-colors " +
                            (qty === n
                              ? "border-violet-bright bg-violet text-white"
                              : short > 0
                                ? "border-white/10 text-ink-faint hover:border-white/25 hover:text-ink-mute"
                                : "border-white/15 text-ink-soft hover:border-white/35 hover:text-ink")
                          }
                        >
                          <span className="text-[12px] font-bold">{n}</span>
                          <span className="mt-0.5 text-[9px] font-medium opacity-70">{fmtUsd(costN)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {shortfall > 0 ? (
                    <p className="mt-2 text-center text-[11px] text-ink-mute" data-testid="cost-hint">
                      {qty} packs cost <span className="num text-ink-soft">{fmtUsd(cost)}</span> — your
                      balance is <span className="num text-ink-soft">{fmtUsd(balance ?? 0)}</span>. You
                      need <span className="num font-semibold text-ink">{fmtUsd(shortfall)}</span> more:{" "}
                      <a href="/daily" className="font-semibold text-ink underline underline-offset-4">
                        daily rewards
                      </a>{" "}
                      or a smaller batch.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {pack.guaranteedValue != null ? (
                <p className="mt-2 text-center text-[11px] text-ink-mute">
                  Every card in this pack is worth at least{" "}
                  <span className="num font-semibold text-ink-soft">{fmtUsd(pack.guaranteedValue)}</span> of
                  simulated collection value.
                </p>
              ) : null}

              {oddsOpen ? (
                <div className="rip-rise mt-3 grid grid-cols-2 gap-1.5 rounded-sm border border-white/10 bg-black/40 p-2.5 sm:grid-cols-5">
                  {showOdds.map((entry) => {
                    const entryVisual = rarityVisual(entry.tier);
                    return (
                      <div key={entry.tier} className="flex items-center justify-between gap-2 rounded-sm px-1.5 py-1 sm:flex-col sm:items-start">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: entryVisual.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: entryVisual.color }} />
                          {RARITY_LABEL[entry.tier as Rarity].replace(" Rare", "")}
                        </span>
                        <span className="num text-[12px] text-ink-soft">{(entry.chance * 100).toFixed(2)}%</span>
                      </div>
                    );
                  })}
                  {showOdds.length === 0 ? <span className="col-span-full text-[11px] text-ink-mute">Odds are listed on the pack page.</span> : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[440px] text-center">
              <p className="text-[12px] text-ink-mute">
                {stage.phase === "tearing"
                  ? "Keep pulling across the seal"
                  : stage.phase === "committing"
                    ? "The pack is open — reading the pool…"
                    : ""}
              </p>
            </div>
          )}
        </footer>
      </div>

      {confirmSell && single ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirm sale">
          <div className="rip-rise w-full max-w-[380px] rounded-lg border border-white/12 bg-[#0d0913] p-5 shadow-2xl">
            <div className="label-micro text-ink-mute">
              {multi ? `Confirm simulated sale of ${cards.length} cards` : "Confirm simulated sale"}
            </div>
            {multi ? (
              <div className="mt-3 flex items-center gap-2.5">
                {cards.slice(0, 5).map((card) => (
                  <div key={card.id} className="w-10 overflow-hidden rounded-[3px] border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.thumb} alt="" width={40} height={56} className="h-auto w-full" />
                  </div>
                ))}
                <div className="min-w-0 text-[12px] text-ink-soft">
                  <div className="font-semibold text-ink">{cards.length} cards</div>
                  <div className="mt-0.5 text-[11px] text-ink-mute">Best · {RARITY_LABEL[tier]}</div>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3">
                <div className="w-14 shrink-0 overflow-hidden rounded-[3px] border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={single.thumb} alt="" width={56} height={78} className="h-auto w-full" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-ink">{single.name}</div>
                  <div className="mt-0.5 text-[11px] text-ink-mute">
                    {single.setName} · #{single.number}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: visual.color }}>
                    {RARITY_LABEL[single.tier]}
                  </div>
                </div>
              </div>
            )}

            <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">Reference market</dt>
                <dd className="num text-ink-soft">
                  {multi
                    ? totals.market === 0
                      ? "Unavailable"
                      : `${fmtUsd(totals.market)}${totals.missingMarket ? "+" : ""}`
                    : single.marketCents == null
                      ? "Unavailable"
                      : fmtUsd(single.marketCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">Collection value</dt>
                <dd className="num text-ink-soft">{fmtUsd(multi ? totals.collection : single.value)}</dd>
              </div>
              <div className="flex justify-between gap-3 text-[14px]">
                <dt className="font-semibold text-ink">You receive</dt>
                <dd className="num font-bold" style={{ color: visual.color }}>
                  {fmtUsd(multi ? totals.sell : single.sellCents)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
              Simulated buyback at {Math.round(SELL_RATE * 100)}% of collection value, paid into your virtual
              USD balance. The card{multi ? "s leave" : " leaves"} your vault; the sale stays in your history.
              Not real money.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmSell(false)}
                disabled={Boolean(working)}
                className="btn btn-quiet h-11 text-[13px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => decide("sell")}
                disabled={Boolean(working)}
                className="btn btn-violet h-11 text-[13px] font-bold disabled:opacity-60"
              >
                {working === "sell"
                  ? "Selling…"
                  : `Sell for ${fmtUsd(multi ? totals.sell : single.sellCents)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Value({
  label,
  value,
  accent,
  unavailable = false,
}: {
  label: string;
  value: string;
  accent?: string;
  unavailable?: boolean;
}) {
  return (
    <div className="px-1 text-center">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
      <dd
        className={
          "num mt-1 truncate text-[13px] font-bold " +
          (unavailable ? "text-ink-faint" : "text-ink")
        }
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function marketLabel(source: string): string {
  if (!source) return "Market";
  return source.slice(0, 1).toUpperCase() + source.slice(1);
}

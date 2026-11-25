"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditGlyph } from "@/components/brand/logo";
import { fmtUsd } from "@/lib/domain";

type Day = { day: number; credits: number; item: string };

export function DailyClaim({
  days,
  streak,
  nextDay,
  claimedToday,
  signedIn,
}: {
  days: Day[];
  streak: number;
  nextDay: number;
  claimedToday: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [claimed, setClaimed] = useState(claimedToday);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const claim = async () => {
    if (!signedIn) {
      router.push("/login?next=/daily");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/daily/claim", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data?.error ?? "Could not claim right now.");
      } else {
        setClaimed(true);
        setMessage(`Claimed ${fmtUsd(data.credits)} — day ${data.day} of the cycle.`);
        router.refresh();
      }
    } catch {
      setMessage("Network problem — nothing was claimed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => {
          const isNext = !claimed && day.day === nextDay;
          const done = claimed ? day.day <= nextDay : day.day < nextDay;
          return (
            <div
              key={day.day}
              className={
                "relative rounded-md border px-3 py-3.5 transition-colors " +
                (isNext
                  ? "border-violet-bright bg-violet/20 shadow-[0_10px_30px_rgba(76,29,149,0.45)]"
                  : done
                    ? "border-line bg-surface/40"
                    : "border-line bg-surface/70")
              }
            >
              <div className="label-micro">Day {day.day}</div>
              <div className="num mt-2 flex items-center gap-1 text-[17px] font-bold text-ink">
                <CreditGlyph size={12} className="text-ink-mute" />
                {fmtUsd(day.credits)}
              </div>
              {day.item ? (
                <div className="mt-1 text-[10px] text-ink-faint">{day.item.replace("avatar:", "Avatar ")}</div>
              ) : null}
              {done ? (
                <span className="absolute right-2 top-2 text-[10px] font-semibold text-ink-faint">✓</span>
              ) : null}
              {isNext ? (
                <span className="absolute right-2 top-2 rounded-pill bg-violet px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                  Today
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={claim}
          disabled={busy || claimed}
          className={"btn h-12 px-7 " + (claimed ? "btn-quiet" : "btn-rose")}
        >
          {claimed ? "Claimed today" : busy ? "Claiming…" : `Claim day ${nextDay}`}
        </button>
        <p className="text-[12px] text-ink-mute">
          {message ??
            (signedIn
              ? `Current streak: ${streak} day${streak === 1 ? "" : "s"}. Streaks reset after a missed day.`
              : "Sign in to claim your daily reward.")}
        </p>
      </div>
    </div>
  );
}

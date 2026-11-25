import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getActivity, type ActivityRow } from "@/lib/server/shelf";
import { fmtDateTime, fmtUsd, RARITY_LABEL, type Rarity } from "@/lib/domain";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "History",
  description: "Every pack you ripped, card you vaulted, sale you made and balance change.",
};

const KIND_LABEL: Record<ActivityRow["kind"], string> = {
  rip: "Pack",
  vault: "Vault",
  sell: "Sale",
  sale: "Sale",
  daily: "Daily",
  signup: "Account",
  adjust: "Adjustment",
};

export default async function HistoryPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/history");

  const rows = await getActivity(user.id, 60).catch(() => [] as ActivityRow[]);
  const spent = rows.filter((r) => r.kind === "rip").reduce((sum, r) => sum + (r.costCents ?? 0), 0);
  const earned = rows
    .filter((r) => r.kind === "sell" || r.kind === "sale" || r.kind === "daily" || r.kind === "signup" || r.kind === "adjust")
    .reduce((sum, r) => sum + (r.amountCents ?? 0), 0);

  return (
    <div className="page-bg">
      <div className="shell py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="label-micro text-violet-bright">Account activity</div>
            <h1 className="display mt-3 text-[36px] md:text-[46px]">Transaction history</h1>
            <p className="lede mt-2.5 max-w-lg text-[14px]">
              Pack costs, vaulted pulls, simulated sales and every balance change, newest first.
            </p>
          </div>
          <Link
            href="/profile"
            className="text-[13px] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Back to profile
          </Link>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Balance" value={fmtUsd(user.credits)} hint="virtual USD" />
          <Stat label="Spent on packs" value={fmtUsd(spent)} hint="last 60 events" />
          <Stat label="Credited" value={fmtUsd(earned)} hint="sales and rewards" />
          <Stat label="Events" value={rows.length.toLocaleString("en-US")} hint="recorded" />
        </dl>

        {rows.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed border-line-strong px-6 py-14 text-center">
            <p className="text-[14px] text-ink-soft">Nothing has happened yet.</p>
            <Link href="/packs" className="btn btn-violet mt-4">
              Browse packs
            </Link>
          </div>
        ) : (
          <div className="mt-7 overflow-hidden rounded-md border border-line bg-surface/60">
            <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-4 border-b border-line px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint sm:grid-cols-[64px_minmax(0,1fr)_130px_110px_120px] sm:px-5">
              <span>Type</span>
              <span>Event</span>
              <span className="hidden sm:block">Card</span>
              <span className="text-right">Amount</span>
              <span className="hidden text-right sm:block">When</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line px-4 py-2.5 last:border-none sm:grid-cols-[64px_minmax(0,1fr)_130px_110px_120px] sm:px-5"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                  {KIND_LABEL[row.kind]}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{row.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-mute">{row.detail}</div>
                </div>
                <div className="hidden min-w-0 sm:block">
                  {row.cardName ? (
                    <div className="flex min-w-0 items-center gap-2">
                      {row.cardThumb ? (
                        <div className="w-6 shrink-0 overflow-hidden rounded-[2px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={row.cardThumb} alt="" width={24} height={34} className="h-auto w-full" loading="lazy" />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div className="truncate text-[11px] text-ink-soft">{row.cardName}</div>
                        {row.cardTier ? (
                          <div className={"truncate text-[10px] rarity-" + row.cardTier}>
                            {RARITY_LABEL[row.cardTier as Rarity]}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-ink-faint">—</span>
                  )}
                </div>
                <Amount row={row} />
                <div className="hidden text-right text-[11px] text-ink-faint sm:block">
                  {fmtDateTime(row.at)}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 max-w-2xl text-[11px] leading-relaxed text-ink-faint">
          Balances are simulated virtual USD. Sales pay the disclosed simulated buyback value and are recorded
          here; market references are estimates, not guarantees. Nothing here can be withdrawn.
        </p>
      </div>
    </div>
  );
}

function Amount({ row }: { row: ActivityRow }) {
  // A rip shows what it cost; sales and rewards show what came in.
  const value =
    row.kind === "rip"
      ? row.costCents && row.costCents > 0
        ? `−${fmtUsd(row.costCents)}`
        : "Free"
      : row.amountCents != null
        ? `${row.amountCents >= 0 ? "+" : "−"}${fmtUsd(Math.abs(row.amountCents))}`
        : "—";

  const tone =
    row.kind === "rip"
      ? "text-ink-mute"
      : (row.amountCents ?? 0) > 0
        ? "text-lime"
        : "text-ink-soft";

  return <span className={"num text-right text-[12px] font-semibold " + tone}>{value}</span>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-line bg-surface/60 px-4 py-3.5">
      <dt className="text-[11px] text-ink-mute">{label}</dt>
      <dd className="num mt-1.5 truncate text-[19px] font-bold text-ink">{value}</dd>
      {hint ? <dd className="mt-0.5 truncate text-[11px] text-ink-faint">{hint}</dd> : null}
    </div>
  );
}

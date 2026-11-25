import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/layout/site-header";
import { SignOutButton } from "@/components/auth/sign-out";
import { TcgCard } from "@/components/card/tcg-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileStats } from "@/lib/server/shelf";
import { fmtUsd, fmtDate, RARITY_LABEL, type Rarity } from "@/lib/domain";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your RIPS account: balance, rip history and best pulls.",
};

export default async function ProfilePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/profile");

  const stats = await getProfileStats(user);

  return (
    <div className="page-bg">
      <div className="shell py-10 md:py-14">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.avatar} size={56} />
          <div className="min-w-0">
            <h1 className="display text-[30px] md:text-[38px]">{user.username}</h1>
            <p className="mt-1 text-[12px] text-ink-mute">
              Member since {fmtDate(stats.joined)}
              {user.isAdmin ? " · admin" : ""}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/history" className="btn btn-quiet btn-sm">
              History
            </Link>
            <SignOutButton />
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Balance" value={fmtUsd(user.credits)} hint="virtual USD" />
          <Stat label="Packs ripped" value={stats.rips.toLocaleString("en-US")} hint={`${fmtUsd(stats.spent)} spent`} />
          <Stat label="Unique cards" value={stats.cards.toLocaleString("en-US")} hint="in the vault" />
          <Stat label="Collection" value={fmtUsd(stats.collectionValue)} hint="simulated" />
          <Stat label="Sales" value={fmtUsd(stats.soldTotal)} hint={`${stats.soldCount} sold`} />
          <Stat label="Streak" value={`${user.streak}`} hint="daily claims" />
        </dl>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="h-section">Recent pulls</h2>
            <Link
              href="/collection"
              className="text-[13px] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Collection
            </Link>
          </div>

          {stats.recent.length === 0 ? (
            <div className="mt-5 rounded-md border border-dashed border-line-strong px-6 py-12 text-center">
              <p className="text-[14px] text-ink-soft">No rips yet.</p>
              <Link href="/packs" className="btn btn-violet mt-4">
                Open your first pack
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {stats.recent.map((item, i) => (
                <div key={`${item.card.id}-${i}`}>
                  <TcgCard
                    src={item.card.image}
                    alt={`${item.card.name} card`}
                    tier={item.card.tier as Rarity}
                  />
                  <div className="mt-2 truncate text-[12px] font-semibold">{item.card.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-ink-mute">
                    {item.packName} · <span className={"rarity-" + item.card.tier}>{RARITY_LABEL[item.card.tier as Rarity]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-surface/60 px-5 py-4">
            <h2 className="text-[13px] font-semibold">Virtual USD</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">
              Your balance is simulated virtual USD with no monetary value. It cannot be deposited,
              purchased, withdrawn or exchanged. You have {fmtUsd(user.credits)} to rip with.
            </p>
          </div>
          <div className="rounded-md border border-line bg-surface/60 px-5 py-4">
            <h2 className="text-[13px] font-semibold">Daily reward</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">
              Claim a reward once a day to keep your balance topped up.{" "}
              <Link href="/daily" className="text-ink-soft underline underline-offset-2 hover:text-ink">
                Go to daily rewards
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
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

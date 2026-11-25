import Link from "next/link";
import { RipPanel } from "@/components/pack/rip-panel";
import { PackTile, CardTile } from "@/components/pack/pack-tile";
import { getCurrentUser } from "@/lib/auth/session";
import { getDailyState, getRecentPulls, getShelf } from "@/lib/server/shelf";
import { fmtUsd, type Rarity } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser().catch(() => null);
  const [packs, pulls, daily] = await Promise.all([
    getShelf().catch((error) => {
      console.error("[home] shelf failed:", error);
      return [];
    }),
    getRecentPulls(8).catch(() => []),
    getDailyState(user).catch(() => null),
  ]);

  const featured = packs.find((p) => p.featured) ?? packs[0];
  const freePack = packs.find((p) => p.freePerAccount);
  const totalCards = packs.reduce((sum, pack) => sum + pack.poolSize, 0);

  return (
    <div>
      <RipPanel
        packs={packs}
        signedIn={Boolean(user)}
        balance={user?.credits ?? null}
        initialSlug={featured?.slug}
        freeAvailable={Boolean(freePack) && !user?.starterClaimed}
      />

      {/* live pulls */}
      {pulls.length > 0 ? (
        <section className="border-y border-line bg-bg-deep/60">
          <div className="shell flex items-center gap-4 overflow-hidden py-3">
            <span className="label-micro shrink-0">Latest pulls</span>
            <div className="no-scrollbar flex gap-6 overflow-x-auto">
              {pulls.map((pull, i) => (
                <span
                  key={`${pull.card.id}-${i}`}
                  className="flex shrink-0 items-center gap-2 text-[12px] text-ink-mute"
                >
                  <span className={"h-1.5 w-1.5 rounded-full rarity-" + pull.card.tier} />
                  <span className="text-ink-soft">{pull.username}</span>
                  <span>pulled</span>
                  <span className="font-medium text-ink">{pull.card.name}</span>
                  <span className="num rarity-secret">{fmtUsd(pull.card.value)}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* shelf */}
      <section className="shell py-12 md:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="h-section">The shelf</h2>
            <p className="lede mt-2 max-w-lg text-[14px]">
              {packs.length} packs, {totalCards.toLocaleString("en-US")} possible cards, every
              chance published before you rip.
            </p>
          </div>
          <Link
            href="/packs"
            className="hidden shrink-0 text-[13px] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline sm:block"
          >
            All packs
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {packs.slice(0, 8).map((pack, i) => (
            <PackTile key={pack.slug} pack={pack} priority={i < 4} />
          ))}
        </div>

        <Link
          href="/packs"
          className="mt-5 inline-flex text-[13px] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline sm:hidden"
        >
          All packs
        </Link>
      </section>

      {/* daily strip */}
      {daily ? (
        <section className="shell pb-12 md:pb-16">
          <div className="relative overflow-hidden rounded-md border border-line bg-[linear-gradient(115deg,#1b1030_0%,#120b1d_60%,#170f24_100%)] px-6 py-7 md:flex md:items-center md:justify-between md:px-9 md:py-8">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_120%_at_100%_50%,rgba(217,154,138,0.16),transparent_70%)]"
              aria-hidden="true"
            />
            <div className="relative">
              <div className="label-micro text-violet-bright">Daily reward</div>
              <h2 className="h-section mt-2.5">Come back tomorrow</h2>
              <p className="lede mt-2 max-w-lg text-[14px]">
                {daily.claimedToday
                  ? `Claimed today. Streak at ${daily.streak} — day ${daily.nextDay} unlocks tomorrow.`
                  : `Claim ${fmtUsd(daily.days[daily.nextDay - 1]?.credits ?? 150)} today. Long streaks pay more.`}
              </p>
            </div>
            <Link
              href="/daily"
              className={"btn relative mt-5 md:mt-0 " + (daily.claimedToday ? "btn-quiet" : "btn-violet")}
            >
              {daily.claimedToday ? "View rewards" : "Claim now"}
            </Link>
          </div>
        </section>
      ) : null}

      {/* top cards */}
      {featured && featured.topCards.length > 0 ? (
        <section className="shell pb-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="h-section">Top of the pool</h2>
              <p className="lede mt-2 max-w-lg text-[14px]">
                The highest-value cards currently live inside {featured.name}.
              </p>
            </div>
            <Link
              href={`/packs/${featured.slug}`}
              className="shrink-0 text-[13px] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              See the pool
            </Link>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {featured.topCards.map((card) => (
              <CardTile key={card.id} card={{ ...card, tier: card.tier as Rarity }} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { TcgCard } from "@/components/card/tcg-card";
import { PackHero } from "@/components/pack/pack-hero";
import { getCurrentUser } from "@/lib/auth/session";
import { getPack, getShelf } from "@/lib/server/shelf";
import { fmtCredits, RARITY_LABEL, type Rarity } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/packs/[slug]">) {
  const { slug } = await props.params;
  const pack = await getPack(slug).catch(() => null);
  return {
    title: pack?.name ?? "Pack",
    description: pack?.description,
  };
}

export default async function PackDetailPage(props: PageProps<"/packs/[slug]">) {
  const { slug } = await props.params;
  const [pack, user, shelf] = await Promise.all([
    getPack(slug).catch(() => null),
    getCurrentUser().catch(() => null),
    getShelf().catch(() => []),
  ]);
  if (!pack) notFound();

  const hero = pack.topCards[0];
  const others = shelf.filter((p) => p.slug !== pack.slug).slice(0, 4);
  const odds = (chance: number) =>
    chance >= 0.01 ? `${(chance * 100).toFixed(2)}%` : `${(chance * 100).toFixed(3)}%`;

  return (
    <div>
      <PackHero pack={pack} signedIn={Boolean(user)} balance={user?.credits ?? null} />

      {/* headline card */}
      {hero ? (
        <section className="shell py-12 md:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="order-2 lg:order-1">
              <div className="label-micro text-violet-bright">The headline card</div>
              <h2 className="display mt-3 text-[32px] md:text-[40px]">{hero.name}</h2>
              <p className="lede mt-3 text-[14px]">
                The pack&rsquo;s top pull sits in the disclosed pool alongside every other
                possible card. Check the odds before you rip.
              </p>
              <dl className="mt-7 space-y-3.5 border-t border-line pt-5 text-[13px]">
                <Row label="Collection value" value={fmtCredits(hero.value)} accent />
                <Row
                  label="Market reference"
                  value={hero.marketCents == null ? "Unavailable" : fmtCredits(hero.marketCents)}
                />
                <Row label="Sell value" value={fmtCredits(hero.sellCents)} />
                <Row label="Rarity" value={RARITY_LABEL[hero.tier as Rarity]} />
                <Row label="Set" value={hero.setName} />
                <Row label="Pool size" value={`${pack.poolSize} cards`} />
              </dl>
            </div>
            <div className="order-1 mx-auto w-full max-w-[300px] lg:order-2 lg:max-w-[340px]">
              <TcgCard
                src={hero.image}
                alt={`${hero.name} card`}
                tier={hero.tier as Rarity}
                priority
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* tiers */}
      <section className="shell pb-10">
        <div className="rounded-md border border-line bg-surface/60 p-5">
          <div className="label-micro">Odds by rarity</div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {pack.tiers.map((tier) => (
              <div key={tier.tier}>
                <div className={"text-[12px] font-semibold rarity-" + tier.tier}>
                  {RARITY_LABEL[tier.tier]}
                </div>
                <div className="num mt-1 text-[20px] font-bold text-ink">{odds(tier.chance)}</div>
                <div className="mt-0.5 text-[11px] text-ink-mute">{tier.count} cards</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* full pool */}
      <section id="pool" className="border-t border-line bg-bg-deep/60 py-12 md:py-16">
        <div className="shell">
          <div className="max-w-xl">
            <div className="label-micro text-violet-bright">Disclosed card pool</div>
            <h2 className="h-section mt-3">Every possible pull</h2>
            <p className="lede mt-2.5 text-[14px]">
              Odds are the exact weights used for this pack. The opening system selects
              one card server-side and saves it to your collection.
            </p>
          </div>

          <div className="mt-7 overflow-hidden rounded-md border border-line bg-surface">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-line px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint sm:grid-cols-[52px_minmax(0,1fr)_auto_auto] sm:px-5">
              <span className="hidden sm:block">Card</span>
              <span>Name and set</span>
              <span className="text-right">Value</span>
              <span className="w-16 text-right">Chance</span>
            </div>
            {pack.pool.slice(0, 60).map((card) => (
              <div
                key={card.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-line px-4 py-2.5 last:border-none sm:grid-cols-[52px_minmax(0,1fr)_auto_auto] sm:px-5"
              >
                <div className="hidden w-9 overflow-hidden rounded-[3px] sm:block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.thumb} alt="" width={36} height={50} className="h-auto w-full" loading="lazy" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{card.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-mute">
                    {card.setName} · <span className={"rarity-" + card.tier}>{RARITY_LABEL[card.tier as Rarity]}</span>
                  </div>
                </div>
                <span className="num text-right text-[12px] text-ink-soft">{fmtCredits(card.value)}</span>
                <span className="num w-16 text-right text-[12px] text-ink-mute">{odds(card.chance)}</span>
              </div>
            ))}
          </div>
          {pack.pool.length > 60 ? (
            <p className="mt-4 text-[12px] text-ink-faint">
              Showing the 60 highest-value cards of {pack.pool.length}. The full pool is
              used for every draw.
            </p>
          ) : null}
        </div>
      </section>

      {/* other packs */}
      {others.length > 0 ? (
        <section className="shell py-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="h-section">Other packs</h2>
            <Link href="/packs" className="text-[13px] font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              All packs
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/packs/${other.slug}`}
                className="group rounded-md border border-line bg-surface/60 px-4 py-3 transition-colors hover:border-white/20"
              >
                <div className="truncate text-[13px] font-semibold">{other.name}</div>
                <div className="num mt-1 text-[12px] text-ink-mute">
                  {other.price === 0 ? "Free" : fmtCredits(other.price)} · top {fmtCredits(other.maxValue)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-mute">{label}</dt>
      <dd className={"num font-medium " + (accent ? "text-ink" : "text-ink-soft")}>{value}</dd>
    </div>
  );
}

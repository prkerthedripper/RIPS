import type { Metadata } from "next";
import { getShelf } from "@/lib/server/shelf";
import { fmtUsd, RARITY_LABEL, SELL_RATE, type Rarity } from "@/lib/domain";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Virtual USD, vault & odds",
  description: "How the simulated balance, starter pack, vault, sales and pack odds work.",
};

export default async function CreditsPage() {
  const packs = await getShelf().catch(() => []);

  return (
    <div className="page-bg">
      <div className="shell max-w-3xl py-10 md:py-14">
        <div className="label-micro text-violet-bright">The fine print</div>
        <h1 className="display mt-3 text-[36px] md:text-[46px]">Virtual USD &amp; odds</h1>

        <div className="mt-8 space-y-4">
          <Section title="A simulated dollar balance">
            <p>
              Every balance on RIPS is simulated virtual USD, formatted in dollars for readability. It
              cannot be deposited, purchased, sold, withdrawn or transferred, and it never converts to cash
              or prizes. New accounts start at <span className="num text-ink">$0.00</span>.
            </p>
          </Section>

          <Section title="The starter pack">
            <p>
              Every new account gets one free First Spark pack, opened manually like any other. It awards
              exactly one card and every card in that pool is a 151 Ultra Rare or Secret Rare worth at least{" "}
              <span className="num text-ink">$5.00</span> of simulated collection value — a disclosed floor,
              not a hidden adjustment to the odds. The pool and its weights are published below and on the
              pack page, and one account can open one starter pack.
            </p>
          </Section>

          <Section title="One card per pack">
            <p>
              Every pack awards exactly one card. When you rip, the server draws the card from that
              pack&rsquo;s weighted pool, debits the price and writes the opening in a single database
              transaction, so a card can never be granted twice for one price.
            </p>
          </Section>

          <Section title="Vault or sell">
            <p>
              A pull stays a pending result until you choose. <span className="text-ink">VAULT</span> moves
              it into your collection, where it stays across sessions. <span className="text-ink">SELL</span>{" "}
              pays the simulated buyback value — {Math.round(SELL_RATE * 100)}% of the card&rsquo;s collection
              value — into your virtual balance. A sold card leaves the collection, but the sale stays in
              your history forever. Both decisions are idempotent: the server only resolves a pull once, so
              a card cannot be vaulted or sold twice.
            </p>
          </Section>

          <Section title="Three different numbers">
            <p>
              A card shows up to three values, and they are not the same thing:
            </p>
            <ul className="mt-3 space-y-1.5">
              <li>
                <span className="text-ink">Reference market price</span> — a third-party estimate (TCGplayer
                via the Pokémon TCG API) where a reliable price exists. Shown as unavailable when it does
                not.
              </li>
              <li>
                <span className="text-ink">Simulated collection value</span> — the platform&rsquo;s own
                valuation, used for collection totals.
              </li>
              <li>
                <span className="text-ink">Simulated sell value</span> — what the platform pays if you sell
                now, {Math.round(SELL_RATE * 100)}% of collection value.
              </li>
            </ul>
            <p className="mt-3">
              None of these is a guaranteed sale price and none of them is real money.
            </p>
          </Section>

          <Section title="Odds are published, not estimated">
            <p>
              Each card in a pack has a stored weight. The chance shown on a pack page is that card&rsquo;s
              weight divided by the total weight of the pack, so the published numbers are the exact numbers
              used for the draw.
            </p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {(Object.keys(RARITY_LABEL) as Rarity[]).map((tier) => (
                <li key={tier} className="flex items-center gap-2 text-[13px] text-ink-soft">
                  <span className={"h-1.5 w-1.5 rounded-full rarity-" + tier} />
                  {RARITY_LABEL[tier]}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="On the shelf today">
            <div className="mt-2 overflow-hidden rounded-md border border-line">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-line bg-surface/60 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                <span>Pack</span>
                <span className="text-right">Price</span>
                <span className="text-right">Cards</span>
              </div>
              {packs.map((pack) => (
                <div
                  key={pack.slug}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-line px-4 py-2 text-[13px] last:border-none"
                >
                  <span className="truncate">{pack.name}</span>
                  <span className="num text-right text-ink-soft">
                    {pack.price === 0 ? "Free" : fmtUsd(pack.price)}
                  </span>
                  <span className="num text-right text-ink-mute">{pack.poolSize}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Attribution" id="attribution">
            <p>
              Card images and market references come from the Pokémon TCG Developer API (pokemontcg.io),
              with prices sourced from TCGplayer. Pokémon and Pokémon card images are trademarks and
              copyright of Pokémon, Nintendo, Creatures Inc. and GAME FREAK inc. RIPS by FCargo is an
              unofficial fan-made simulator and is not affiliated with or endorsed by any rights holder.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded-md border border-line bg-surface/50 px-5 py-5">
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      <div className="mt-2 text-[13px] leading-relaxed text-ink-mute">{children}</div>
    </section>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CollectionBrowser } from "@/components/collection/collection-browser";
import { getCurrentUser } from "@/lib/auth/session";
import { getCollection } from "@/lib/server/shelf";
import { fmtUsd, RARITY_LABEL, type Rarity } from "@/lib/domain";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vault",
  description: "Every card you have vaulted, with its rarity, market reference and simulated value.",
};

export default async function CollectionPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/collection");

  const entries = await getCollection(user.id).catch(() => []);
  const total = entries.reduce((sum, entry) => sum + entry.value * entry.count, 0);
  const market = entries.reduce((sum, entry) => sum + (entry.marketCents ?? 0) * entry.count, 0);
  const unique = entries.length;
  const rips = entries.reduce((sum, entry) => sum + entry.count, 0);
  const best = entries.reduce<(typeof entries)[number] | null>(
    (top, entry) => (!top || entry.value > top.value ? entry : top),
    null,
  );

  return (
    <div className="page-bg">
      <div className="shell py-10 md:py-14">
        <div className="label-micro text-violet-bright">Your vault</div>
        <h1 className="display mt-3 text-[40px] md:text-[54px]">Collection</h1>

        <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Cards" value={unique.toLocaleString("en-US")} hint={`${rips} vaulted`} />
          <Stat label="Collection value" value={fmtUsd(total)} hint="simulated" />
          <Stat
            label="Best pull"
            value={best ? best.name : "—"}
            hint={best ? `${RARITY_LABEL[best.tier as Rarity]} · ${fmtUsd(best.value)}` : "Rip a pack"}
          />
          <Stat
            label="Balance"
            value={fmtUsd(user.credits)}
            hint={market > 0 ? `${fmtUsd(market)} market ref` : "virtual USD"}
          />
        </dl>

        <div className="mt-9">
          <CollectionBrowser entries={entries} />
        </div>
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

"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PackArt } from "@/components/pack/pack-art";
import { colorwayFor } from "@/lib/pack-colorways";
import { SparkleField } from "@/components/decor/sparkle-field";
import { fmtCredits, packArtLabel, packKindLabel } from "@/lib/domain";
import type { PackDetail } from "@/lib/server/shelf";

const RipOverlay = dynamic(() => import("@/components/pack/rip-overlay").then((m) => m.RipOverlay), {
  ssr: false,
});

export function PackHero({
  pack,
  signedIn,
  balance = null,
}: {
  pack: PackDetail;
  signedIn: boolean;
  balance?: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 page-bg" aria-hidden="true" />
        <SparkleField count={18} />

        <div className="shell relative grid gap-8 py-9 md:grid-cols-[minmax(0,1fr)_340px] md:items-center md:py-14">
          <div className="order-2 md:order-1">
            <span className="chip">{packKindLabel(pack.category)}</span>
            <h1 className="display mt-4 text-[40px] md:text-[56px]">{pack.name}</h1>
            <p className="lede mt-4 max-w-xl">{pack.description}</p>

            <dl className="mt-7 grid max-w-md grid-cols-3 gap-3 border-t border-line pt-5">
              <div>
                <dt className="text-[11px] text-ink-mute">Price</dt>
                <dd className="num mt-1 text-[18px] font-bold">
                  {pack.price === 0 ? "Free" : fmtCredits(pack.price)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-mute">Max pull</dt>
                <dd className="num mt-1 text-[18px] font-bold">{fmtCredits(pack.maxValue)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-mute">Pool</dt>
                <dd className="num mt-1 text-[18px] font-bold">{pack.poolSize}</dd>
              </div>
            </dl>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => (signedIn ? setOpen(true) : router.push("/login?next=/packs/" + pack.slug))}
                className="btn btn-rose h-14 px-8 text-[16px] font-bold"
              >
                {pack.price === 0 ? "Rip free pack" : `Rip for ${fmtCredits(pack.price)}`}
              </button>
              <a href="#pool" className="btn btn-quiet h-14 px-6">
                See the full pool
              </a>
            </div>

            <p className="mt-4 text-[12px] text-ink-mute">
              One card per pack — rip 1, 2, 5 or 10 at once. Every draw happens on the server.
            </p>
            {pack.guaranteedValue != null ? (
              <p className="mt-1.5 text-[12px] text-ink-soft">
                Guaranteed: every card in this pack is worth at least{" "}
                <span className="num font-semibold text-ink">{fmtCredits(pack.guaranteedValue)}</span> of
                simulated collection value.
              </p>
            ) : null}
          </div>

          <div className="order-1 flex justify-center md:order-2">
            <PackArt
              name="RIPS"
              setName="Pokemon"
              label={packArtLabel(pack.name)}
              colorway={colorwayFor(pack.slug)}
              size="lg"
            />
          </div>
        </div>
      </div>

      {open ? <RipOverlay pack={pack} open balance={balance} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

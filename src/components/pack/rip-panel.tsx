"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RipStage } from "@/components/pack/rip-stage";
import { SparkleField } from "@/components/decor/sparkle-field";
import type { ShelfPack } from "@/lib/server/shelf";

// The rip (three.js, shaders, audio) is its own chunk: nobody pays for it
// until they actually tear a pack.
const RipOverlay = dynamic(() => import("@/components/pack/rip-overlay").then((m) => m.RipOverlay), {
  ssr: false,
});

/*
  Home rips panel: the carousel plus the overlay it opens. Signed-out visitors
  are sent to sign in instead of being shown a dead button.
*/

export function RipPanel({
  packs,
  signedIn,
  initialSlug,
  freeAvailable,
  balance = null,
}: {
  packs: ShelfPack[];
  signedIn: boolean;
  initialSlug?: string;
  freeAvailable: boolean;
  balance?: number | null;
}) {
  const router = useRouter();
  const [active, setActive] = useState<{ pack: ShelfPack; qty: number } | null>(null);
  const [busy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden pb-14 pt-6 md:pb-20 md:pt-10">
      <div className="pointer-events-none absolute inset-0 page-bg" aria-hidden="true" />
      <SparkleField count={30} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" aria-hidden="true" />

      <div className="relative">
        <RipStage
          packs={packs}
          initialSlug={initialSlug}
          signedIn={signedIn}
          busy={busy}
          message={
            message ??
            (signedIn && !freeAvailable ? "Your free pack has been ripped — the shelf is open." : null)
          }
          onBuy={(pack, qty) => {
            if (!signedIn) {
              router.push("/login?next=/");
              return;
            }
            setMessage(null);
            setActive({ pack, qty });
          }}
        />
      </div>

      {active ? (
        <RipOverlay
          pack={active.pack}
          qty={active.qty}
          open
          balance={balance}
          onClose={() => {
            setActive(null);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}

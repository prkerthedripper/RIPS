import type { Metadata } from "next";
import { PackCatalog } from "@/components/pack/pack-catalog";
import { getShelf } from "@/lib/server/shelf";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Packs",
  description: "Every pack on the RIPS shelf, with the full card pool and odds published up front.",
};

export default async function PacksPage() {
  const packs = await getShelf().catch(() => []);

  return (
    <div className="page-bg">
      <div className="shell py-10 md:py-14">
        <div className="max-w-2xl">
          <div className="label-micro text-violet-bright">The complete shelf</div>
          <h1 className="display mt-3 text-[40px] md:text-[54px]">Choose your pack</h1>
          <p className="lede mt-4 text-[15px]">
            Every pack lists its exact pool before it is opened. No hidden multipliers,
            no real-money purchases, no undisclosed odds.
          </p>
        </div>
        <div className="mt-8">
          <PackCatalog packs={packs} />
        </div>
      </div>
    </div>
  );
}

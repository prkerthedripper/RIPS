"use client";

import { useRouter } from "next/navigation";
import type { ShelfPack } from "@/lib/server/shelf";
import { RipExperience } from "./rip/rip-experience";

/*
  The rip, mounted over the page.

  The pack is torn open by dragging the foil itself — there is no open button.
  Everything after the tear is choreography around a result the server already
  chose. Refreshing on close keeps the header balance and history in step.
*/

export function RipOverlay({
  pack,
  open,
  onClose,
  balance = null,
  qty = 1,
}: {
  pack: ShelfPack;
  open: boolean;
  onClose: () => void;
  balance?: number | null;
  /** Pack count chosen before the overlay opened (the home carousel's 1x–10x). */
  qty?: number;
}) {
  const router = useRouter();
  if (!open) return null;

  return (
    <RipExperience
      pack={pack}
      balance={balance}
      initialQty={qty}
      onClose={() => {
        onClose();
        router.refresh();
      }}
    />
  );
}

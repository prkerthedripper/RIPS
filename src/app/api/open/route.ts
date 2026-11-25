import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { openPack, RIP_QUANTITIES } from "@/lib/server/shelf";

/*
  POST { slug, qty } -> { cards, openingIds, card, openingId, balance, cost, qty }

  qty is one of 1/2/5/10: that many packs are ripped in one transaction, each
  with its own weighted draw and its own pending opening. The client never
  chooses the cards and never reports a price.
*/

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to rip a pack." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.slug !== "string") {
    return NextResponse.json({ error: "Which pack?" }, { status: 400 });
  }

  const requested = Number(body.qty ?? 1);
  const qty = (RIP_QUANTITIES as readonly number[]).includes(requested) ? requested : 1;

  const result = await openPack(user, body.slug, qty);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, balance: result.balance }, { status: 402 });
  }
  return NextResponse.json(result);
}

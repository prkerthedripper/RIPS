import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { sellOpenings } from "@/lib/server/shelf";

/*
  SELL — pay the simulated buyback value of one or several pending pulls into
  the virtual balance. Payouts are computed from the card rows inside the
  transaction; the client only names which pulls, never how much they are worth.
*/

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to sell a card." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.openingIds)
    ? body.openingIds.filter((id: unknown): id is string => typeof id === "string")
    : typeof body?.openingId === "string"
      ? [body.openingId]
      : [];
  if (ids.length === 0) return NextResponse.json({ error: "Which pull?" }, { status: 400 });

  const result = await sellOpenings(user.id, ids);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { vaultOpenings } from "@/lib/server/shelf";

/*
  VAULT — move one or several pending pulls into the signed-in user's
  collection. The ids must belong to the session user and still be pending;
  status transitions are guarded in SQL, so a repeated request can never vault
  the same card twice.
*/

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to vault a card." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.openingIds)
    ? body.openingIds.filter((id: unknown): id is string => typeof id === "string")
    : typeof body?.openingId === "string"
      ? [body.openingId]
      : [];
  if (ids.length === 0) return NextResponse.json({ error: "Which pull?" }, { status: 400 });

  const result = await vaultOpenings(user.id, ids);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}

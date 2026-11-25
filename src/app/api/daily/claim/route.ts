import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { claimDaily } from "@/lib/server/shelf";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to claim." }, { status: 401 });
  const result = await claimDaily(user);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

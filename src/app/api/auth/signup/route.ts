import { NextResponse } from "next/server";
import { signUp } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }
  const result = await signUp(body.username, body.password, request.headers.get("user-agent") ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ user: result.user });
}

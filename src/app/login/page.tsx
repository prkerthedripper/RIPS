import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { RipsMark } from "@/components/brand/logo";
import { SparkleField } from "@/components/decor/sparkle-field";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to RIPS by FCargo, or create an account for one free starter pack.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const raw = typeof searchParams.next === "string" ? searchParams.next : "/";
  // only same-site paths, never an absolute URL
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(next);

  return (
    <div className="relative flex min-h-[calc(100vh-14rem)] items-center justify-center overflow-hidden px-4 py-14">
      <div className="pointer-events-none absolute inset-0 page-bg" aria-hidden="true" />
      <SparkleField count={20} />

      <div className="relative flex w-full max-w-[820px] flex-col items-center gap-10 rounded-lg border border-line bg-surface/60 px-6 py-10 backdrop-blur-sm md:flex-row md:items-center md:gap-14 md:px-12 md:py-14">
        <div className="hidden flex-1 md:block">
          <RipsMark size={44} />
          <h1 className="display mt-6 text-[38px] leading-[0.95]">
            Rip packs.
            <br />
            Keep the cards.
          </h1>
          <p className="lede mt-4 text-[14px]">
            Real Pokémon TCG artwork, published odds, and a collection that keeps every pull.
            Every pack awards exactly one card.
          </p>
          <ul className="mt-6 space-y-2.5 text-[13px] text-ink-soft">
            <li>$0.00 balance and one free starter pack</li>
            <li>Starter cards guaranteed at $5.00 or more</li>
            <li>No deposits and no withdrawals</li>
          </ul>
        </div>

        <div className="flex w-full flex-1 flex-col items-center">
          <div className="mb-6 text-center md:hidden">
            <RipsMark size={36} className="mx-auto" />
            <h1 className="display mt-4 text-[28px]">Rip packs. Keep the cards.</h1>
          </div>
          <AuthForm next={next} />
        </div>
      </div>
    </div>
  );
}

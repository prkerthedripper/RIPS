import Link from "next/link";
import { CreditGlyph } from "@/components/brand/logo";
import { fmtUsd, type SessionUser } from "@/lib/domain";

/*
  Balance pill — the reference's top-right control: amount on the left, a
  lime add-credit button on the right. Signed out it shows the signup credit
  and links to sign in.
*/

export function BalancePill({ user }: { user: SessionUser | null }) {
  if (!user) {
    return (
      <Link
        href="/login"
        title="Create an account — one free starter pack, no deposit"
        className="flex h-9 items-center gap-2.5 rounded-pill border border-line-strong bg-surface-2 pl-3.5 pr-1 transition-colors hover:border-white/25"
      >
        <span className="num text-[13px] font-semibold text-ink">{fmtUsd(0)}</span>
        <span className="label-micro hidden text-ink-faint sm:inline">starter free</span>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-lime text-[#16240a]">
          <CreditGlyph size={14} />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      title="Your virtual USD balance"
      className="flex h-9 items-center gap-2.5 rounded-pill border border-line-strong bg-surface-2 pl-3.5 pr-1 transition-colors hover:border-white/25"
    >
      <CreditGlyph size={13} className="text-ink-mute" />
      <span className="num text-[13px] font-semibold text-ink">{fmtUsd(user.credits)}</span>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-lime text-[#16240a]">
        <CreditGlyph size={14} />
      </span>
    </Link>
  );
}

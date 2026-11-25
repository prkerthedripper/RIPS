"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoHome } from "@/components/brand/logo";
import { BalancePill } from "@/components/layout/balance-pill";
import type { SessionUser } from "@/lib/domain";

/*
  Header: brand left, primary nav centred on desktop, balance and account
  right. On mobile the nav moves to the bottom rail and the header keeps only
  the brand and the balance.
*/

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/packs", label: "Packs" },
  { href: "/collection", label: "Collection" },
  { href: "/daily", label: "Daily" },
  { href: "/profile", label: "Profile" },
];

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-bg/80 backdrop-blur-xl">
      <div className="shell flex h-14 items-center gap-6 md:h-16">
        <LogoHome />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "relative rounded-md px-3.5 py-2 text-[14px] font-medium transition-colors " +
                  (active ? "text-ink" : "text-ink-mute hover:text-ink")
                }
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full bg-violet-bright" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <BalancePill user={user} />
          {user ? (
            <Link
              href="/profile"
              aria-label={`Signed in as ${user.username}`}
              className="flex h-10 items-center gap-2 rounded-pill border border-line-strong bg-surface-2 px-1.5 pr-3 transition-colors hover:border-white/25"
            >
              <Avatar name={user.avatar} size={28} />
              <span className="hidden max-w-[110px] truncate text-[13px] font-medium text-ink-soft sm:inline">
                {user.username}
              </span>
            </Link>
          ) : (
            <Link href="/login" className="btn btn-violet btn-sm sm:h-10 sm:px-4 sm:text-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const palette = ["#7c3aed", "#d99a8a", "#0ea5e9", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#a855f7"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const bg = palette[hash % palette.length];
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(145deg, ${bg}, rgba(0,0,0,0.55))`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
      }}
    >
      {name.replace(/^a/, "F")}
    </span>
  );
}

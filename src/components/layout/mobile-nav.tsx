"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/components/layout/site-header";

/*
  Mobile navigation — the reference's bottom rail: five equal items with a
  hairline top border, the RIPS item raised in the middle on a violet badge.
*/

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-violet bg-bg-deep/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid grid-cols-5">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const isCenter = item.href === "/";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-16 flex-col items-center justify-center gap-1.5"
            >
              {isCenter ? (
                <span
                  className={
                    "absolute -top-4 grid h-11 w-11 rotate-45 place-items-center rounded-[10px] border transition-colors " +
                    (active
                      ? "border-violet-bright bg-gradient-to-br from-violet-bright to-violet-deep"
                      : "border-line-strong bg-surface-2")
                  }
                >
                  <span className="-rotate-45">
                    <NavIcon name={item.label} active={active} size={18} />
                  </span>
                </span>
              ) : (
                <NavIcon name={item.label} active={active} size={20} />
              )}
              <span
                className={
                  "text-[10px] font-semibold tracking-[0.04em] " +
                  (isCenter ? "mt-2.5 " : "") +
                  (active ? "text-ink" : "text-ink-mute")
                }
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({ name, active, size = 20 }: { name: string; active: boolean; size?: number }) {
  const stroke = active ? "currentColor" : "currentColor";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: active ? "text-ink" : "text-ink-mute",
  };

  switch (name) {
    case "Home":
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "Packs":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
          <path d="M4 9h16M9 4v5" />
        </svg>
      );
    case "Collection":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="12" height="15" rx="2" />
          <path d="M18.5 7v11.5a2 2 0 0 1-2 2H8" />
        </svg>
      );
    case "Daily":
      return (
        <svg {...common}>
          <path d="M7 3v3M17 3v3" />
          <rect x="3.5" y="6" width="17" height="15" rx="2.5" />
          <path d="M3.5 11h17M12 14.5v3M10.5 16h3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
  }
}

import Link from "next/link";

/*
  RIPS by FCargo brand.

  Mark: a rounded "rip" glyph — a shield cut by a diagonal tear — in violet
  foil. The wordmark is set in the display face with the FCargo credit set
  small beside it.
*/

export function RipsMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="rips-foil" x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c4a0ff" />
          <stop offset="0.55" stopColor="#8b45f5" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.6 L27.4 8.2 V17.1 C27.4 23.2 22.6 27.7 16 29.6 C9.4 27.7 4.6 23.2 4.6 17.1 V8.2 Z"
        fill="url(#rips-foil)"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.1"
      />
      <path
        d="M19.8 6.4 L12.4 16.2 L17.6 16.2 L12.2 25.6 L21.4 14.2 L16.2 14.2 Z"
        fill="#fff"
        fillOpacity="0.94"
      />
    </svg>
  );
}

export function RipsLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span
        className="display text-ink"
        style={{ fontSize: compact ? 22 : 26, letterSpacing: "0.02em" }}
      >
        RIPS
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">
        by FCargo
      </span>
    </span>
  );
}

export function LogoHome({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="RIPS by FCargo — home"
      className="inline-flex items-center gap-2.5 rounded-md outline-offset-4 transition-opacity hover:opacity-90"
    >
      <RipsMark size={compact ? 26 : 30} />
      <RipsLockup compact={compact} />
    </Link>
  );
}

/** Credit coin glyph — used wherever a balance or price is shown. */
export function CreditGlyph({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.2 5.9c-.5-.5-1.3-.8-2.2-.8-1.3 0-2.2.6-2.2 1.5 0 2.1 4.5.9 4.5 3.1 0 .9-1 1.5-2.3 1.5-.9 0-1.8-.3-2.3-.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M8 3.9v8.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

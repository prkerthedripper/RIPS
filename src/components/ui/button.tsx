import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { LinkProps } from "next/link";

/*
  One button component for the whole app. Variants map to the design
  system: violet = action, rose = buy, quiet = secondary, ghost = tertiary.
*/

type Variant = "violet" | "rose" | "quiet" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  violet: "btn-violet",
  rose: "btn-rose",
  quiet: "btn-quiet",
  ghost: "btn-ghost",
};

const SIZES: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export function buttonClasses(variant: Variant = "violet", size: Size = "md", extra = "") {
  return ["btn", VARIANTS[variant], SIZES[size], extra].filter(Boolean).join(" ");
}

export function Button({
  variant = "violet",
  size = "md",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "violet",
  size = "md",
  className = "",
  children,
  href,
  ...rest
}: LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

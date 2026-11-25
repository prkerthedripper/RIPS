import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RIPS by FCargo — Virtual Pack Ripping",
    template: "%s — RIPS by FCargo",
  },
  description:
    "A virtual-credit rip lounge. Open packs of real Pokémon TCG cards, build your collection, earn daily rewards. No deposits, no withdrawals — every credit is virtual.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A database hiccup must never take the whole site down: the shell renders
  // signed-out and the pages that need an account redirect to sign-in.
  const user = await getCurrentUser().catch(() => null);

  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <SiteHeader user={user} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <MobileNav />
      </body>
    </html>
  );
}

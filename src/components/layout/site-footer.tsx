import Link from "next/link";
import { RipsMark } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-bg-deep">
      <div className="shell pb-28 pt-12 md:pb-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <RipsMark size={26} />
              <span className="display text-[20px]">RIPS</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">
                by FCargo
              </span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-mute">
              A virtual-credit rip lounge. No deposits, no withdrawals, no cash
              prizes — every credit is virtual and every card lives in your
              collection only.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3">
            <div>
              <div className="label-micro">Platform</div>
              <ul className="mt-3.5 space-y-2.5 text-[13px]">
                <li>
                  <Link href="/packs" className="text-ink-soft hover:text-ink">
                    Packs
                  </Link>
                </li>
                <li>
                  <Link href="/collection" className="text-ink-soft hover:text-ink">
                    Collection
                  </Link>
                </li>
                <li>
                  <Link href="/daily" className="text-ink-soft hover:text-ink">
                    Daily rewards
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="label-micro">Account</div>
              <ul className="mt-3.5 space-y-2.5 text-[13px]">
                <li>
                  <Link href="/profile" className="text-ink-soft hover:text-ink">
                    Profile
                  </Link>
                </li>
                <li>
                  <Link href="/history" className="text-ink-soft hover:text-ink">
                    Opening history
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-ink-soft hover:text-ink">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="label-micro">About</div>
              <ul className="mt-3.5 space-y-2.5 text-[13px]">
                <li>
                  <Link href="/credits" className="text-ink-soft hover:text-ink">
                    Virtual USD &amp; odds
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-6 text-[11px] leading-relaxed text-ink-faint">
          <p>
            Card images are provided by the Pokémon TCG Developer API
            (pokemontcg.io). Pokémon and Pokémon card images are trademarks and
            copyright of Pokémon, Nintendo, Creatures Inc. and GAME FREAK inc.
            RIPS by FCargo is an unofficial fan-made simulator and is not
            affiliated with or endorsed by any rights holder.
          </p>
          <p className="mt-2">
            RIPS runs on simulated virtual USD with no monetary value. Card
            values are estimates for entertainment — play responsibly.
          </p>
        </div>
      </div>
    </footer>
  );
}

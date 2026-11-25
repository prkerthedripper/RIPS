import type { Metadata } from "next";
import { DailyClaim } from "@/components/daily/daily-claim";
import { SparkleField } from "@/components/decor/sparkle-field";
import { getCurrentUser } from "@/lib/auth/session";
import { getDailyState } from "@/lib/server/shelf";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily rewards",
  description: "Claim simulated virtual USD every day. Longer streaks pay more.",
};

export default async function DailyPage() {
  const user = await getCurrentUser().catch(() => null);
  const state = await getDailyState(user);

  return (
    <div className="page-bg">
      <section className="relative overflow-hidden border-b border-line">
        <SparkleField count={14} />
        <div className="shell relative py-10 md:py-14">
          <div className="label-micro text-violet-bright">Daily vault credit</div>
          <h1 className="display mt-3 text-[40px] md:text-[54px]">Daily rewards</h1>
          <p className="lede mt-4 max-w-xl">
            A virtual USD reward every day across a {state.days.length}-day cycle. Day{" "}
            {state.days.length} pays the most — and a streak is only broken by a missed day.
          </p>
        </div>
      </section>

      <section className="shell py-9 md:py-12">
        <DailyClaim
          days={state.days}
          streak={state.streak}
          nextDay={state.nextDay}
          claimedToday={state.claimedToday}
          signedIn={Boolean(user)}
        />
      </section>

      <section className="shell pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          <Note title="How the cycle works" body="One claim per calendar day. The reward advances one step each day; day 15 starts the cycle again at day 1." />
          <Note title="Streaks" body="Claiming on consecutive days builds your streak. Miss a day and the streak resets to day 1." />
          <Note title="Virtual only" body="Simulated virtual USD has no cash value and cannot be withdrawn. It buys packs, nothing else." />
        </div>
      </section>
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-line bg-surface/50 px-5 py-4">
      <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">{body}</p>
    </div>
  );
}

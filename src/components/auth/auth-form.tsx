"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/*
  One form for sign in and sign up — the reference has a single account entry
  point, so the mode is a toggle rather than a second page.
*/

export function AuthForm({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? "That did not work. Try again.");
        setBusy(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Network problem — try again.");
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[380px]">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-line-strong bg-surface p-1">
        {(["signup", "signin"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            aria-pressed={mode === value}
            className={
              "h-9 rounded-sm text-[13px] font-semibold transition-colors " +
              (mode === value ? "bg-violet text-white" : "text-ink-mute hover:text-ink")
            }
          >
            {value === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label-micro">Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={18}
            className="mt-2 h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-violet-bright"
            placeholder="riplord"
          />
        </label>
        <label className="block">
          <span className="label-micro">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            className="mt-2 h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-violet-bright"
            placeholder="At least 6 characters"
          />
        </label>

        {error ? <p className="text-[12px] font-medium text-rose">{error}</p> : null}

        <button type="submit" disabled={busy} className="btn btn-rose h-12 w-full text-[15px] font-bold">
          {busy ? "One moment…" : mode === "signup" ? "Create account and rip" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">
        {mode === "signup"
          ? "New accounts start at $0.00 with one free starter pack — every card in it is worth at least $5.00."
          : "Simulated virtual USD only. Nothing here can be bought with or turned into money."}
      </p>
    </div>
  );
}

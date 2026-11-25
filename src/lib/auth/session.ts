import crypto from "node:crypto";
import { cookies } from "next/headers";
import { one, query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/domain";

/*
  Session handling: opaque random token in an httpOnly cookie, only the
  sha256 of the token is stored. One row per sign-in in `sessions`.
*/

const COOKIE = "rips_session";
const TTL_DAYS = 30;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

type UserRow = {
  id: string;
  username: string;
  avatar: string;
  bio: string;
  credits: number;
  is_admin: boolean;
  daily_streak: number;
  starter_claimed: boolean;
  created_at: string;
};

export type AccountUser = SessionUser & {
  bio: string;
  streak: number;
  starterClaimed: boolean;
  createdAt: string;
};

function toUser(row: UserRow): AccountUser {
  return {
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    bio: row.bio,
    credits: row.credits,
    isAdmin: row.is_admin,
    streak: row.daily_streak,
    starterClaimed: row.starter_claimed,
    createdAt: row.created_at,
  };
}

const USER_COLUMNS =
  "id, username, avatar, bio, credits, is_admin, daily_streak, starter_claimed, created_at";

/** The signed-in user, or null. Reads the session cookie. */
export async function getCurrentUser(): Promise<AccountUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const row = await one<UserRow>(
    `select u.${USER_COLUMNS.split(", ").join(", u.")}
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()
      limit 1`,
    [hashToken(token)],
  );
  return row ? toUser(row) : null;
}

export async function createSession(userId: string, userAgent = "") {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `insert into sessions (user_id, token_hash, expires_at, user_agent)
     values ($1, $2, $3, $4)`,
    [userId, hashToken(token), expires.toISOString(), userAgent.slice(0, 240)],
  );
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  }
  store.delete(COOKIE);
}

export type SignUpResult =
  | { ok: true; user: AccountUser }
  | { ok: false; error: string };

const USERNAME = /^[a-zA-Z0-9_]{3,18}$/;

export async function signUp(
  rawUsername: string,
  password: string,
  userAgent = "",
): Promise<SignUpResult> {
  const username = rawUsername.trim();
  if (!USERNAME.test(username)) {
    return { ok: false, error: "Username must be 3–18 letters, numbers or underscores." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const taken = await one("select 1 from users where lower(username) = lower($1)", [username]);
  if (taken) return { ok: false, error: "That username is already taken." };

  // New accounts start at $0.00: the first thing they do is open the free
  // starter pack, which is guaranteed to be worth at least $5.00.
  const signupCredits = Number(
    (await one<{ value: string }>("select value from settings where key = 'signup_credits'"))
      ?.value ?? 0,
  );

  const row = await one<UserRow>(
    `insert into users (username, password_hash, avatar, credits)
     values ($1, $2, $3, $4)
     returning ${USER_COLUMNS}`,
    [username, hashPassword(password), `a${1 + Math.floor(Math.random() * 8)}`, signupCredits],
  );
  if (!row) return { ok: false, error: "Could not create that account." };

  if (signupCredits > 0) {
    await query(
      `insert into credit_transactions (user_id, amount, kind, ref, balance_after)
       values ($1, $2, 'signup', 'welcome', $2)`,
      [row.id, signupCredits],
    );
  }

  await createSession(row.id, userAgent);
  return { ok: true, user: toUser(row) };
}

export async function signIn(
  rawUsername: string,
  password: string,
  userAgent = "",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await one<UserRow & { password_hash: string }>(
    `select ${USER_COLUMNS}, password_hash from users where lower(username) = lower($1)`,
    [rawUsername.trim()],
  );
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, error: "Wrong username or password." };
  }
  await createSession(row.id, userAgent);
  return { ok: true };
}

/** Re-read the balance — used after every credit change. */
export async function refreshUser(userId: string): Promise<AccountUser | null> {
  const row = await one<UserRow>(`select ${USER_COLUMNS} from users where id = $1`, [userId]);
  return row ? toUser(row) : null;
}

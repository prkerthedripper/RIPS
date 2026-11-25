import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

/*
  Single pg Pool per process. DATABASE_URL is the only knob — locally the
  embedded cluster (scripts/db.mjs) listens on 127.0.0.1:54329; in production
  this points at the Supabase pooler connection string.
*/

const DEFAULT_URL = "postgres://postgres:postgres@127.0.0.1:54329/auric";

declare global {
  // eslint-disable-next-line no-var
  var __auricPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__auricPool) {
    globalThis.__auricPool = new Pool({
      connectionString: process.env.DATABASE_URL ?? DEFAULT_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: "auric-web",
    });
    globalThis.__auricPool.on("error", (err) => {
      console.error("[db] idle client error", err.message);
    });
  }
  return globalThis.__auricPool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as never[]);
}

export async function one<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const r = await query<T>(text, params);
  return r.rows[0] ?? null;
}

/** Run a callback inside a transaction; rolls back on throw. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}


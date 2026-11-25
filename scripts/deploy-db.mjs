/*
  Production database deployment for Render and other hosted Postgres services.

  This intentionally does not start the embedded local database. It applies each
  SQL migration once, then seeds a brand-new database. It is safe to run on
  every service start because migrations and the seed are both idempotent.
*/

import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATABASE_URL = process.env.DATABASE_URL;
const LOCK_KEY = "rips-production-database-deploy";

function log(message) {
  console.log(`[db:deploy] ${message}`);
}

async function migrate(client) {
  await client.query(`
    create table if not exists schema_migrations (
      id serial primary key,
      name text not null unique,
      applied_at timestamptz not null default now()
    )
  `);

  const migrationDir = path.join(ROOT, "src", "db", "migrations");
  const migrations = fs.readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort();

  for (const name of migrations) {
    const { rowCount } = await client.query(
      "select 1 from schema_migrations where name = $1",
      [name],
    );
    if (rowCount) continue;

    const sql = fs.readFileSync(path.join(migrationDir, name), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [name]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    log(`applied migration ${name}`);
  }
}

async function hasSeedData(client) {
  const { rows } = await client.query("select exists (select 1 from cards) as present");
  return rows[0].present;
}

if (!DATABASE_URL) {
  console.error("[db:deploy] DATABASE_URL is required for a hosted deployment.");
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
  await client.query("select pg_advisory_lock(hashtext($1))", [LOCK_KEY]);

  try {
    await migrate(client);

    if (!(await hasSeedData(client))) {
      if (!process.env.ADMIN_PASSWORD?.trim()) {
        throw new Error("ADMIN_PASSWORD must be set before seeding a new production database.");
      }

      const { seedIfEmpty } = await import("./seed-lib.mjs");
      await seedIfEmpty(client, log);
    } else {
      log("seed data present, skipping");
    }

    log("database ready");
  } finally {
    await client.query("select pg_advisory_unlock(hashtext($1))", [LOCK_KEY]).catch(() => {});
  }
} catch (error) {
  console.error("[db:deploy] failed:");
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

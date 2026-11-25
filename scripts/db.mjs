/*
  AURIC embedded database manager.

  Manages a local PostgreSQL 18 cluster (embedded binaries) for development:
    node scripts/db.mjs up      — start server, migrate, seed if empty
    node scripts/db.mjs down    — stop server
    node scripts/db.mjs reset   — stop, wipe data, start fresh
    node scripts/db.mjs status  — report state

  The server is left running detached after `up`; Next.js connects over TCP
  on 127.0.0.1:54329. DATABASE_URL can override everything for Supabase.
*/

import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = process.env.AURIC_PGDATA ?? path.join(ROOT, ".pgdata");
const PORT = Number(process.env.AURIC_PGPORT ?? 54329);
const USER = "postgres";
const PASSWORD = "postgres";
const DB = "auric";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`;

function log(msg) {
  console.log(`[db] ${msg}`);
}

function portOpen(host, port, timeout = 1200) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port, timeout });
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
}

async function waitForPort(host, port, attempts = 240, delay = 500) {
  for (let i = 0; i < attempts; i++) {
    if (await portOpen(host, port)) return true;
    await new Promise((r) => setTimeout(r, delay));
  }
  return false;
}

async function connect(url, tries = 30, delay = 500) {
  for (let i = 0; i < tries; i++) {
    try {
      const c = new Client({ connectionString: url });
      await c.connect();
      return c;
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function migrate(client) {
  await client.query(`
    create table if not exists schema_migrations (
      id serial primary key,
      name text not null unique,
      applied_at timestamptz not null default now()
    )
  `);
  const dir = path.join(ROOT, "src", "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const { rows } = await client.query(
      "select 1 from schema_migrations where name = $1",
      [file],
    );
    if (rows.length > 0) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await client.query(sql);
    await client.query("insert into schema_migrations (name) values ($1)", [file]);
    log(`applied migration ${file}`);
  }
}

async function serverUp() {
  const running = await portOpen("127.0.0.1", PORT);
  if (running) {
    log(`server already listening on 127.0.0.1:${PORT}`);
    return false;
  }
  const firstRun = !fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: USER,
    password: PASSWORD,
    persistent: true,
    onLog: () => {},
    onError: (m) => console.error("[pg]", m),
  });
  if (firstRun) {
    log("initialising cluster (first run, ~10s)");
    await pg.initialise();
  }
  await pg.start();
  const ok = await waitForPort("127.0.0.1", PORT);
  if (!ok) throw new Error("postgres did not start listening in time");
  log(`server listening on 127.0.0.1:${PORT}`);
  return true;
}

async function up({ seed = true } = {}) {
  await serverUp();
  const adminUrl = `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/postgres`;
  const admin = await connect(adminUrl);
  const { rows } = await admin.query("select 1 from pg_database where datname = $1", [DB]);
  if (rows.length === 0) {
    await admin.query(`create database ${DB}`);
    log(`created database ${DB}`);
  }
  await admin.end();

  const client = await connect(DATABASE_URL);
  await migrate(client);
  await client.end();

  if (seed) {
    const { seedIfEmpty } = await import("./seed-lib.mjs");
    const c = await connect(DATABASE_URL);
    await seedIfEmpty(c, log);
    await c.end();
  }
  log("ready");
}

async function down() {
  // pg_ctl is independent of this script's lifetime — clean stop by data dir.
  const { execFileSync } = await import("node:child_process");
  const bin = path.join(
    ROOT, "node_modules", "@embedded-postgres", "windows-x64", "native", "bin", "pg_ctl.exe",
  );
  try {
    execFileSync(bin, ["stop", "-D", DATA_DIR, "-m", "fast", "-w", "-t", "30"], { stdio: "pipe" });
    log("server stopped");
  } catch {
    log("server was not running (or stop failed) — continuing");
  }
}

async function status() {
  const open = await portOpen("127.0.0.1", PORT);
  log(open ? `listening on ${PORT}` : `not running (port ${PORT} closed)`);
}

const cmd = process.argv[2] ?? "up";
try {
  if (cmd === "up") await up();
  else if (cmd === "down") await down();
  else if (cmd === "reset") { await down(); fs.rmSync(DATA_DIR, { recursive: true, force: true }); log("data dir wiped"); await up(); }
  else if (cmd === "status") await status();
  else { console.error("usage: node scripts/db.mjs [up|down|reset|status]"); process.exit(1); }
  process.exit(0);
} catch (err) {
  console.error("[db] command failed:");
  console.error(err instanceof Error ? err.stack : "non-Error throw:", err);
  process.exit(1);
}

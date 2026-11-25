/*
  One command for local development.

  `npm start` runs this: it brings up the embedded Postgres cluster (creating
  and seeding it on first run), keeps it alive, then runs `next dev` in the
  foreground. Ctrl+C stops both.

  Flags:
    --no-seed   skip seeding on first run
    --reset     wipe the data directory first (destructive)
*/

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = process.env.RIPS_PGDATA ?? process.env.AURIC_PGDATA ?? path.join(ROOT, ".pgdata");
const PORT = Number(process.env.RIPS_PGPORT ?? process.env.AURIC_PGPORT ?? 54329);
const USER = "postgres";
const PASSWORD = "postgres";
const DB = "auric";
const DATABASE_URL =
  process.env.DATABASE_URL ?? `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`;

const log = (msg) => console.log(`\x1b[35m[dev]\x1b[0m ${msg}`);

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const seed = !args.includes("--no-seed");

function portOpen(host, port, timeout = 1000) {
  return new Promise((resolve) => {
    import("node:net").then(({ connect }) => {
      const socket = connect({ host, port, timeout });
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
    });
  });
}

async function waitForPort(attempts = 120, delay = 500) {
  for (let i = 0; i < attempts; i += 1) {
    if (await portOpen("127.0.0.1", PORT)) return true;
    await new Promise((r) => setTimeout(r, delay));
  }
  return false;
}

async function startDatabase() {
  if (await portOpen("127.0.0.1", PORT)) {
    log(`database already listening on 127.0.0.1:${PORT}`);
    return null;
  }

  if (reset) {
    log("--reset: removing the data directory");
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }

  const EmbeddedPostgres = (await import("embedded-postgres")).default;
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

  if (firstRun) log("initialising the database cluster (first run, ~10s)");
  else log("starting the database");
  if (firstRun) await pg.initialise();
  await pg.start();

  if (!(await waitForPort())) throw new Error("postgres did not start listening in time");
  log(`database listening on 127.0.0.1:${PORT}`);
  return pg;
}

async function ensureSchema() {
  // Reuse the migration + seed path so `npm start` is safe on a fresh clone.
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", "db.mjs"), "up"], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL, AURIC_PGPORT: String(PORT) },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`db.mjs exited ${code}`))));
  });
}

async function ping() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const { rows } = await client.query("select count(*)::int as n from packs");
  await client.end();
  return rows[0].n;
}

async function main() {
  const pg = await startDatabase();
  if (seed) await ensureSchema().catch((err) => log(`schema step skipped: ${err.message}`));

  try {
    log(`shelf loaded: ${await ping()} packs`);
  } catch (err) {
    log(`database not ready: ${err.message}`);
  }

  log("starting Next.js on http://localhost:3000");
  // Next's bin directly: spawning npm.cmd needs a shell on Windows.
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const next = spawn(process.execPath, [nextBin, "dev"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL },
  });

  const shutdown = async (signal) => {
    log(`received ${signal}, shutting down`);
    next.kill("SIGINT");
    if (pg) {
      await pg.stop().catch(() => {});
      log("database stopped");
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  next.on("exit", async (code) => {
    if (pg) await pg.stop().catch(() => {});
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

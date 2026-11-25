/* Keeps the embedded Postgres cluster alive for this test session. */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".pgdata");
const PORT = 54329;

const portOpen = () =>
  new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port: PORT, timeout: 1200 });
    s.on("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.on("timeout", () => {
      s.destroy();
      resolve(false);
    });
  });

if (!(await portOpen())) {
  const pidFile = path.join(DATA_DIR, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    fs.rmSync(pidFile, { force: true });
    console.log("[dbkeep] removed stale postmaster.pid");
  }
}

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: "postgres",
  password: "postgres",
  persistent: true,
  onLog: () => {},
  onError: (m) => console.error("[pg]", m),
});

if (!(await portOpen())) await pg.start();

for (let i = 0; i < 120; i += 1) {
  if (await portOpen()) break;
  await new Promise((r) => setTimeout(r, 500));
}

console.log("[dbkeep] listening:", await portOpen());
setInterval(() => {}, 1 << 30);

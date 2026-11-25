/* Count and photograph the spinning card backs of a 10-pack rip. */

import puppeteer from "puppeteer-core";
import { Client } from "pg";

const BASE = "http://localhost:3000";
const db = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:54329/auric" });
await db.connect();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  args: ["--enable-unsafe-swiftshader", "--no-sandbox"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

const username = `spin${Date.now().toString().slice(-7)}`;
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await sleep(400);
await page.evaluate(async (u) => {
  await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: "spintest123" }),
  });
}, username);
const user = (await db.query("select id from users where username=$1", [username])).rows[0];
await db.query("update users set credits=100000 where id=$1", [user.id]);

await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await sleep(600);
const click = (t) =>
  page.evaluate((text) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.replace(/\s+/g, " ").trim() === text);
    b?.click();
    return Boolean(b);
  }, t);
await click("10x");
await sleep(250);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /^Buy for \$/.test(x.textContent.trim()));
  b?.click();
});
await page.waitForSelector("[data-phase]", { timeout: 20000 });
await sleep(500);
await click("Tear without dragging");

let best = 0;
let shot = false;
for (let i = 0; i < 120; i += 1) {
  const state = await page.evaluate(() => ({
    phase: document.querySelector("[data-phase]")?.getAttribute("data-phase"),
    spins: document.querySelectorAll(".rip-card-spin").length,
    visible: [...document.querySelectorAll(".rip-card-spin")].filter((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 30 && r.height > 30 && r.bottom > 0 && r.top < window.innerHeight;
    }).length,
  }));
  best = Math.max(best, state.visible);
  if (state.phase === "roulette" && state.visible >= 10 && !shot) {
    shot = true;
    await sleep(400);
    await page.screenshot({ path: ".shots/home/10-spinning-backs.png" });
  }
  if (state.phase === "result") break;
  await sleep(200);
}

const qty = await page.evaluate(() => document.querySelector("[data-qty]")?.getAttribute("data-qty"));
console.log(`qty=${qty} · max spinning backs on screen=${best} · screenshot=${shot}`);
await page.waitForFunction(
  () => document.querySelector("[data-phase]")?.getAttribute("data-phase") === "result",
  { timeout: 120000 },
);
await sleep(900);
await page.screenshot({ path: ".shots/home/10-result.png" });
const result = await page.evaluate(() => document.querySelector('[data-testid="result"]')?.innerText ?? "");
console.log("result:", result.split("\n").filter(Boolean).slice(0, 4).join(" · "));

await browser.close();
await db.end();
process.exit(best >= 10 && qty === "10" ? 0 : 1);

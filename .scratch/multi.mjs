/* Multi-pack rip checks: 10 packs at once, batch totals, sell all. */

import puppeteer from "puppeteer-core";
import { Client } from "pg";
import fs from "node:fs";

const BASE = "http://localhost:3010";
const db = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:54329/auric" });
await db.connect();
fs.mkdirSync(".shots/multi", { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  args: ["--enable-unsafe-swiftshader", "--no-sandbox"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

let payload = null;
page.on("response", async (r) => {
  if (r.url().endsWith("/api/open") && r.request().method() === "POST") {
    payload = await r.json().catch(() => null);
  }
});

const phaseNow = () => page.evaluate(() => document.querySelector("[data-phase]")?.getAttribute("data-phase"));
const waitPhase = async (want, timeout = 180000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await phaseNow()) === want) return true;
    await sleep(150);
  }
  return false;
};
const clickButton = (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.textContent.replace(/\s+/g, " ").trim().toLowerCase() === t.toLowerCase(),
    );
    if (!b) return false;
    b.click();
    return true;
  }, text);
const clickStarts = (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      x.textContent.replace(/\s+/g, " ").trim().toLowerCase().startsWith(t.toLowerCase()),
    );
    if (!b) return false;
    b.click();
    return true;
  }, text);

const username = `multi${Date.now().toString().slice(-8)}`;
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await sleep(600);
await page.evaluate(async (u) => {
  await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: "multirip123" }),
  });
}, username);
const user = (await db.query("select id, credits from users where username = $1", [username])).rows[0];
await db.query("update users set credits = 100000 where id = $1", [user.id]);

const rip = async ({ slug, qty }) => {
  await page.goto(`${BASE}/packs/${slug}`, { waitUntil: "networkidle2" });
  await sleep(700);
  payload = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickStarts("Rip ");
    try {
      await page.waitForSelector("[data-phase]", { timeout: 6000 });
      break;
    } catch {
      await sleep(1200);
    }
  }
  if (qty > 1) {
    const picked = await clickButton(String(qty));
    check(`qty ${qty} selectable`, picked, picked ? "" : "chip not found");
    await sleep(250);
  }
  await clickStarts("Tear without dragging");
  return payload;
};

/* ── 10 packs at once ───────────────────────────────────────── */
const startCredits = (await db.query("select credits from users where id=$1", [user.id])).rows[0].credits;
await rip({ slug: "route-151", qty: 10 });
await waitPhase("roulette");
await sleep(700);
const stacked = await page.evaluate(() => document.querySelectorAll(".rip-card-spin").length);
await page.screenshot({ path: ".shots/multi/01-spinning-10.png" });
check("10 card backs spin during the reel", stacked === 10, `spinning=${stacked}`);

await waitPhase("landed", 60000);
await waitPhase("result");
await sleep(1800);
const data = payload;
check("ten packs return ten cards", data?.cards?.length === 10, `cards=${data?.cards?.length}`);
check("ten opening ids", data?.openingIds?.length === 10);
check("one debit for ten packs", data?.cost === 750, `cost=${data?.cost}`);

const rows = await db.query(
  "select count(*)::int n, count(*) filter (where status='pending')::int pending from openings where user_id=$1",
  [user.id],
);
check("ten pending openings written", rows.rows[0].n === 10 && rows.rows[0].pending === 10, JSON.stringify(rows.rows[0]));
const debit = await db.query(
  "select count(*)::int n, coalesce(sum(amount),0)::int total from credit_transactions where user_id=$1 and kind='pack_open'",
  [user.id],
);
check("single pack_open transaction", debit.rows[0].n === 1 && debit.rows[0].total === -750, JSON.stringify(debit.rows[0]));
const balanceNow = (await db.query("select credits from users where id=$1", [user.id])).rows[0].credits;
check("balance debited once", balanceNow === startCredits - 750, `${startCredits} -> ${balanceNow}`);

const resultText = await page.evaluate(() => document.querySelector('[data-testid="result"]')?.innerText ?? "");
const dealt = await page.evaluate(() => document.querySelectorAll(".rip-card-deal").length);
await page.screenshot({ path: ".shots/multi/02-result-10.png" });
check("ten cards dealt into the result", dealt === 10, `dealt=${dealt}`);
check("result shows the batch total", /10 cards/i.test(resultText), resultText.split("\n")[0] ?? "");
check("result has VAULT ALL and SELL ALL", /VAULT ALL/i.test(resultText) && /SELL ALL/i.test(resultText));

/* ── sell all ───────────────────────────────────────────────── */
const sellSum = data.cards.reduce((sum, card) => sum + card.sellCents, 0);
await clickStarts("SELL ALL");
await page.waitForFunction(
  () => [...document.querySelectorAll("button")].some((b) => /^Sell for/i.test(b.textContent.trim())),
  { timeout: 20000 },
);
await page.screenshot({ path: ".shots/multi/03-sell-all.png" });
await clickStarts("Sell for");
await page.waitForSelector('[data-testid="resolution"]', { timeout: 40000 });
await page.screenshot({ path: ".shots/multi/04-sold.png" });
await page.waitForFunction(() => !document.querySelector("[data-phase]"), { timeout: 40000 }).catch(() => {});
await sleep(600);

const sold = await db.query(
  "select count(*)::int n, coalesce(sum(sold_cents),0)::int total from openings where user_id=$1 and status='sold'",
  [user.id],
);
const afterSell = (await db.query("select credits from users where id=$1", [user.id])).rows[0].credits;
const saleTx = await db.query(
  "select count(*)::int n, coalesce(sum(amount),0)::int total from credit_transactions where user_id=$1 and kind='sale'",
  [user.id],
);
check("all ten sold", sold.rows[0].n === 10, JSON.stringify(sold.rows[0]));
check("payout equals the batch sell total", sold.rows[0].total === sellSum, `${sold.rows[0].total} vs ${sellSum}`);
check("balance credited once with the batch total", afterSell === balanceNow + sellSum, `${balanceNow} -> ${afterSell}`);
check("one history row per sold card", saleTx.rows[0].n === 10 && saleTx.rows[0].total === sellSum, JSON.stringify(saleTx.rows[0]));

/* ── 2 and 5 packs stay in step ─────────────────────────────── */
for (const qty of [2, 5]) {
  await rip({ slug: "route-151", qty });
  await waitPhase("result");
  await sleep(600);
  const n = payload?.cards?.length;
  check(`${qty}-pack rip returns ${qty} cards`, n === qty, `cards=${n}`);
  await clickStarts("VAULT ALL");
  await page.waitForFunction(() => !document.querySelector("[data-phase]"), { timeout: 40000 }).catch(() => {});
  await sleep(500);
}
const vaulted = await db.query(
  "select count(*)::int n from openings where user_id=$1 and status='vaulted'",
  [user.id],
);
check("vault all kept 7 cards in the collection", vaulted.rows[0].n === 7, `vaulted=${vaulted.rows[0].n}`);

await page.goto(`${BASE}/collection`, { waitUntil: "networkidle2" });
const collection = await page.evaluate(() => document.body.innerText);
check("collection lists the vaulted batch", /vaulted/i.test(collection));

/* ── a single rip still uses the 3D card flow ───────────────── */
await rip({ slug: "route-151", qty: 1 });
await waitPhase("result");
await sleep(700);
const singleText = await page.evaluate(() => document.querySelector('[data-testid="result"]')?.innerText ?? "");
check("single rip shows one card result", payload?.cards?.length === 1 && /VAULT|SELL/.test(singleText));
await page.screenshot({ path: ".shots/multi/05-single.png" });

const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
if (failures.length) console.log("FAILED:", failures.map((f) => f.name).join(" | "));

await browser.close();
await db.end();
process.exit(failures.length ? 1 : 0);

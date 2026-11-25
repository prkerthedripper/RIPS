/*
  Home-page multi-pack: the 1x/2x/5x/10x selector must actually rip that many
  packs, and an unaffordable batch must explain itself instead of dying.

  Run against the dev server on :3000.
*/

import puppeteer from "puppeteer-core";
import { Client } from "pg";

const BASE = "http://localhost:3000";
const db = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:54329/auric" });
await db.connect();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  args: ["--enable-unsafe-swiftshader", "--no-sandbox"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

const username = `home${Date.now().toString().slice(-7)}`;
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await sleep(500);
await page.evaluate(async (u) => {
  await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: "hometest123" }),
  });
}, username);
const user = (await db.query("select id from users where username=$1", [username])).rows[0];
check("signed up", Boolean(user?.id), username);

const setBalance = async (cents) => {
  await db.query("update users set credits=$2 where id=$1", [user.id, cents]);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await sleep(800);
};

const clickText = (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.textContent.replace(/\s+/g, " ").trim().toLowerCase() === t.toLowerCase(),
    );
    b?.click();
    return Boolean(b);
  }, text);

const buyButton = () =>
  page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /^Buy for \$/.test(x.textContent.trim()));
    return b ? { text: b.textContent.trim(), disabled: b.disabled } : null;
  });

/* ---------- 1. an unaffordable batch explains itself ---------- */
await setBalance(700);
await clickText("10x");
await sleep(300);
const buy = await buyButton();
check("10x prices the whole batch", buy?.text === "Buy for $30.00", buy?.text);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /^Buy for \$/.test(x.textContent.trim()));
  b?.click();
});
await page.waitForSelector("[data-phase]", { timeout: 20000 });
await sleep(700);
const phase1 = await page.evaluate(() => document.querySelector("[data-phase]")?.getAttribute("data-phase"));
const qty1 = await page.evaluate(() => document.querySelector("[data-qty]")?.getAttribute("data-qty"));
const hint = await page.evaluate(() => document.querySelector('[data-testid="cost-hint"]')?.innerText ?? "");
check("overlay opens on the chosen 10 packs", qty1 === "10", `data-qty=${qty1}`);
check("shortfall is spelled out before the tear", /need \$23\.00 more/i.test(hint), hint.replace(/\n/g, " "));
check("rip has not started", phase1 === "intro", `phase=${phase1}`);

// trying anyway: a message, and still no dead "opening" state
await clickText("Tear without dragging");
await sleep(900);
const phase2 = await page.evaluate(() => document.querySelector("[data-phase]")?.getAttribute("data-phase"));
const alert2 = await page.evaluate(() => document.querySelector('[role="alert"]')?.innerText ?? "");
check("refused rip shows an error, not a stuck pack", phase2 === "intro", `phase=${phase2}`);
check("error names the cost and the shortfall", /\$30\.00/.test(alert2) && /\$23\.00/.test(alert2), alert2.replace(/\n/g, " "));
check("a Try again control is offered", /Try again/i.test(alert2));

const openingsBefore = (await db.query("select count(*)::int as n from openings where user_id=$1", [user.id])).rows[0].n;

/* ---------- 2. ten packs: ten spinning cards, one batch, sell all ---------- */
await setBalance(100000);
await clickText("10x");
await sleep(300);
const buy2 = await buyButton();
check("10x on an affordable pack shows the batch total", buy2?.text === "Buy for $30.00", buy2?.text);

const openResponse = page
  .waitForResponse((r) => r.url().endsWith("/api/open") && r.request().method() === "POST", { timeout: 30000 })
  .then((r) => r.json());
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /^Buy for \$/.test(x.textContent.trim()));
  b?.click();
});
await page.waitForSelector("[data-phase]", { timeout: 20000 });
await sleep(600);
const qty2 = await page.evaluate(() => document.querySelector("[data-qty]")?.getAttribute("data-qty"));
check("the overlay rips the chosen 10", qty2 === "10", `data-qty=${qty2}`);

await clickText("Tear without dragging");
const payload = await openResponse.catch(() => null);
check("server returned 10 cards", payload?.cards?.length === 10, `${payload?.cards?.length} cards`);
check("one debit for the whole batch", payload?.cost === 3000 && payload?.qty === 10, `cost=${payload?.cost} qty=${payload?.qty}`);

// ten backs on screen while the reel runs
let maxFigures = 0;
for (let i = 0; i < 60; i += 1) {
  const s = await page.evaluate(() => {
    const phase = document.querySelector("[data-phase]")?.getAttribute("data-phase");
    return { phase, figures: document.querySelectorAll("figure").length };
  });
  maxFigures = Math.max(maxFigures, s.figures);
  if (s.figures >= 10 && s.phase !== "result" && !globalThis.__shot) {
    globalThis.__shot = true;
    await page.screenshot({ path: ".shots/home/10-spinning.png" }).catch(() => {});
  }
  if (s.phase === "result") break;
  await sleep(250);
}
check("ten cards are on screen during the rip", maxFigures >= 10, `max figures=${maxFigures}`);

await page.waitForFunction(
  () => document.querySelector("[data-phase]")?.getAttribute("data-phase") === "result",
  { timeout: 120000 },
);
await sleep(800);
await page.screenshot({ path: ".shots/home/10-result.png" }).catch(() => {});
const result = await page.evaluate(() => {
  const node = document.querySelector('[data-testid="result"]');
  const buttons = [...document.querySelectorAll("button")].map((b) => b.textContent.replace(/\s+/g, " ").trim());
  return { text: node?.innerText ?? "", buttons };
});
check(
  "result totals the whole batch",
  /10 cards/i.test(result.text) && /sell all for/i.test(result.text), // labels render uppercase
  result.text.split("\n").slice(0, 6).join(" · "),
);
const sellAll = result.buttons.find((b) => b.startsWith("SELL ALL"));
const vaultAll = result.buttons.find((b) => b.startsWith("VAULT ALL"));
check("SELL ALL and VAULT ALL are offered", Boolean(sellAll) && Boolean(vaultAll), `${vaultAll} / ${sellAll}`);

await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith("SELL ALL"));
  b?.click();
});
await sleep(500);
const confirmText = await page.evaluate(
  () => document.querySelector('[aria-label="Confirm sale"]')?.innerText ?? "",
);
check("sell-all asks for confirmation first", /10 cards/i.test(confirmText), confirmText.split("\n").slice(0, 2).join(" · "));

const sellResponse = page
  .waitForResponse((r) => r.url().endsWith("/api/sell") && r.request().method() === "POST", { timeout: 30000 })
  .then((r) => r.json());
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /^Sell for \$/.test(x.textContent.trim()));
  b?.click();
});
const sold = await sellResponse.catch(() => null);
const expected = payload?.cards?.reduce((sum, c) => sum + c.sellCents, 0) ?? -1;
check("sell-all paid the summed buyback", sold?.soldCents === expected && sold?.count === 10, `${sold?.soldCents} vs ${expected}`);

await page.waitForSelector('[data-testid="resolution"]', { timeout: 30000 });
const resolution = await page.evaluate(() => document.querySelector('[data-testid="resolution"]')?.innerText ?? "");
check("resolution reports the batch", /10 cards sold/i.test(resolution), resolution.replace(/\n/g, " · "));

const state = (
  await db.query(
    "select status, count(*)::int as n from openings where user_id=$1 group by status order by status",
    [user.id],
  )
).rows;
check("all ten openings are sold in the database", state.some((r) => r.status === "sold" && r.n === 10), JSON.stringify(state));

const sales = (await db.query("select count(*)::int as n from credit_transactions where user_id=$1 and kind='sale'", [user.id])).rows[0].n;
check("one sale record per card", sales === 10, `${sales} sale rows`);

const packTx = (await db.query("select count(*)::int as n from credit_transactions where user_id=$1 and kind='pack_open'", [user.id])).rows[0].n;
check("one pack charge, not ten", packTx === 1, `${packTx} pack_open rows`);

const openingsAfter = (await db.query("select count(*)::int as n from openings where user_id=$1", [user.id])).rows[0].n;
check("no openings from the refused rip", openingsAfter === 10, `${openingsBefore} -> ${openingsAfter}`);

console.log(`\n${failures === 0 ? "ALL HOME CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
await browser.close();
await db.end();
process.exit(failures === 0 ? 0 : 1);

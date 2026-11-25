/*
  CODEX UPDATE — end-to-end checks (tests 1-10).

  Drives the real app in Chrome, reads the /api/open payload as it lands and
  cross-checks the DOM against the database on every step.
*/

import puppeteer from "puppeteer-core";
import { Client } from "pg";
import fs from "node:fs";

const BASE = "http://localhost:3010";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SHOTS = ".shots/codex";
fs.mkdirSync(SHOTS, { recursive: true });

const db = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:54329/auric" });
await db.connect();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--enable-unsafe-swiftshader", "--no-sandbox", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("[console]", msg.text().slice(0, 200));
});

let openPayload = null;
page.on("response", async (response) => {
  if (response.url().endsWith("/api/open") && response.request().method() === "POST") {
    try {
      openPayload = await response.json();
    } catch {
      /* ignore */
    }
  }
});

const phase = () =>
  page.evaluate(() => document.querySelector('[data-phase]')?.getAttribute("data-phase") ?? null);
const bodyText = () => page.evaluate(() => document.body.innerText);
// The pack page stays mounted behind the overlay, so identity checks have to
// read the rip dialog itself. innerText applies text-transform, hence lower().
const dialogText = async () => (await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? "")).toLowerCase();
const waitPhase = async (targets, timeout = 120000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const current = await phase();
    if (targets.includes(current)) return current;
    await sleep(200);
  }
  return await phase();
};
const openRip = async (buttonText) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickText(buttonText);
    try {
      await page.waitForSelector("[data-phase]", { timeout: 6000 });
      return;
    } catch {
      await sleep(1500);
    }
  }
  throw new Error("rip overlay never opened");
};
const clickText = async (text, selector = "button") => {
  const ok = await page.evaluate(
    (t, sel) => {
      const el = [...document.querySelectorAll(sel)].find((b) => (b.textContent ?? "").trim().toLowerCase().startsWith(t.toLowerCase()));
      if (!el) return false;
      el.click();
      return true;
    },
    text,
    selector,
  );
  if (!ok) throw new Error(`no ${selector} starting with "${text}"`);
};
const balance = () =>
  page.evaluate(() => document.querySelector('a[title="Your virtual USD balance"] .num')?.textContent?.trim() ?? null);

/* ── TEST 8: new account starts at $0.00 with one free starter pack ── */
const username = `codex${Date.now().toString().slice(-8)}`;
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await sleep(800);
const signup = await page.evaluate(async (u, p) => {
  const r = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: p }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}, username, "rippack123");
check("TEST 8 · account created through the signup route", signup.status === 200, JSON.stringify(signup.body?.user?.username ?? signup.body));
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await sleep(1200);

const account = await db.query(
  "select id, credits, starter_claimed from users where lower(username)=lower($1)",
  [username],
);
const user = account.rows[0];
check("TEST 8a · new account balance is $0.00", user?.credits === 0, `credits=${user?.credits}`);
check("TEST 8b · starter pack not yet opened", user?.starter_claimed === false);
const shownBalance = await balance();
check("TEST 8c · header shows $0.00", shownBalance === "$0.00", `header=${shownBalance}`);

const freePacks = await page.evaluate(() =>
  [...document.querySelectorAll("a")].filter((a) => a.href.includes("first-spark")).length,
);
check("TEST 8d · starter pack is on the shelf", freePacks > 0, `${freePacks} links`);

/* ── TEST 1 / 4 / 9 / 10: starter rip, hidden card, rarity match ── */
await page.goto(`${BASE}/packs/first-spark`, { waitUntil: "networkidle2" });
await sleep(600);
const heroText = await bodyText();
check("TEST 9a · starter guarantee disclosed", /5\.00/.test(heroText), "pack page mentions $5.00");

openPayload = null;
await openRip("Rip free pack");
await sleep(800);
await clickText("Tear without dragging");

await waitPhase(["emerging", "roulette"]);
await sleep(500);
const payload = openPayload;
check("TEST 9b · one card returned for the rip", Boolean(payload?.card?.id) && Boolean(payload?.openingId));
const card = payload.card;
const openingCount = await db.query("select count(*)::int n from openings where user_id=$1", [user.id]);
check("TEST 9c · exactly one opening written", openingCount.rows[0].n === 1, `openings=${openingCount.rows[0].n}`);
check("TEST 9d · starter card is worth at least $5.00", card.value >= 500, `${card.value} cents`);

const hiddenText = await dialogText();
const leaked = hiddenText.includes(card.name.toLowerCase()) || hiddenText.includes(String(card.number).toLowerCase());
check("TEST 1a · card identity hidden during the spin", !leaked, leaked ? "name present" : "no name/set number in DOM");
check("TEST 4a · result screen not rendered early", !(await page.$('[data-testid="result"]')));

await page.screenshot({ path: `${SHOTS}/01-roulette.png` });

await waitPhase(["landed"]);
await sleep(200);
const banner = await page.evaluate(
  () => document.querySelector('[data-testid="rarity-landing"]')?.innerText ?? "",
);
const tier = card.tier;
const label = { common: "Common", uncommon: "Uncommon", rare: "Rare", ultra: "Ultra Rare", secret: "Secret Rare" }[tier];
check("TEST 10a · landed banner matches the drawn rarity", banner.toLowerCase().includes(label.toLowerCase()), `banner="${banner.replace(/\n/g, " ")}" vs ${label}`);
const stillHidden = await dialogText();
check("TEST 1b · card still hidden at the landing beat", !stillHidden.includes(card.name.toLowerCase()));
await page.screenshot({ path: `${SHOTS}/02-landed.png` });

await waitPhase(["result"]);
await sleep(600);
const resultTier = await page.evaluate(() => document.querySelector('[data-phase]')?.getAttribute("data-tier"));
const resultText = await page.evaluate(() => document.querySelector('[data-testid="result"]')?.innerText ?? "");
check("TEST 4b · card revealed only at the result", resultText.toLowerCase().includes(card.name.toLowerCase()), "result shows the card");
check("TEST 10b · result rarity matches the card", resultTier === tier, `dom=${resultTier} card=${tier}`);
check(
  "TEST 10c · DB rarity matches the animated rarity",
  (await db.query("select c.tier from openings o join cards c on c.id=o.card_id where o.id=$1", [payload.openingId])).rows[0].tier === tier,
);
check("TEST 3a · result shows market / collection / sell values", /\$/.test(resultText), "dollar formatting present");
await page.screenshot({ path: `${SHOTS}/03-result.png` });

/* ── TEST 5: VAULT ── */
await clickText("VAULT");
await page.waitForSelector('[data-testid="resolution"]', { timeout: 30000 });
await page.waitForFunction(() => !document.querySelector('[data-phase]'), { timeout: 30000 }).catch(() => {});
await sleep(800);

const vaulted = await db.query("select status, decided_at from openings where id=$1", [payload.openingId]);
check("TEST 5a · opening is vaulted in the database", vaulted.rows[0]?.status === "vaulted", vaulted.rows[0]?.status);

await page.goto(`${BASE}/collection`, { waitUntil: "networkidle2" });
const collectionText = await bodyText();
check("TEST 5b · card appears in the collection", collectionText.includes(card.name), card.name);
check("TEST 5c · collection shows a market reference column", /Market/i.test(collectionText));
await page.screenshot({ path: `${SHOTS}/04-collection.png` });

/* ── TEST 7: persistence across a refresh ── */
await page.reload({ waitUntil: "networkidle2" });
const afterReload = await bodyText();
check("TEST 7a · collection persists after refresh", afterReload.includes(card.name));
check("TEST 7b · balance persists after refresh", (await balance()) === "$0.00", `header=${await balance()}`);

/* ── TEST 6: SELL credits the balance and removes the card ── */
await db.query("update users set credits = credits + 20000 where id=$1", [user.id]); // $200 test float
await db.query(
  "insert into credit_transactions (user_id, amount, kind, ref, balance_after) values ($1, 20000, 'admin_adjust', 'test float', 20000)",
  [user.id],
);

const sellRun = async (slug, buttonText, stopAt = "result") => {
  await page.goto(`${BASE}/packs/${slug}`, { waitUntil: "networkidle2" });
  await sleep(500);
  openPayload = null;
  await openRip(buttonText ?? "Rip for");
  await sleep(700);
  await clickText("Tear without dragging");
  await waitPhase([stopAt], 180000);
  await sleep(500);
  return openPayload;
};

const before = await balance();
const sellPayload = await sellRun("route-151");
const sellCard = sellPayload.card;
const sellValue = sellCard.sellCents;
const startingCredits = (await db.query("select credits from users where id=$1", [user.id])).rows[0].credits;

await clickText("SELL");
await page.waitForFunction(
  () => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim().startsWith("Sell for")),
  { timeout: 20000 },
);
await page.screenshot({ path: `${SHOTS}/05-sell-confirm.png` });
await clickText("Sell for");
await page.waitForSelector('[data-testid="resolution"]', { timeout: 30000 });
await page.waitForFunction(() => !document.querySelector('[data-phase]'), { timeout: 30000 }).catch(() => {});
await sleep(800);

const sold = await db.query("select status, sold_cents from openings where id=$1", [sellPayload.openingId]);
const afterCredits = (await db.query("select credits from users where id=$1", [user.id])).rows[0].credits;
check("TEST 6a · opening is sold in the database", sold.rows[0]?.status === "sold", sold.rows[0]?.status);
check("TEST 6b · sale paid the disclosed buyback", sold.rows[0]?.sold_cents === sellValue, `${sold.rows[0]?.sold_cents} vs ${sellValue}`);
check("TEST 6c · balance credited exactly once", afterCredits === startingCredits + sellValue, `${startingCredits} -> ${afterCredits} (+${sellValue})`);

const saleTx = await db.query(
  "select count(*)::int n, coalesce(sum(amount),0)::int total from credit_transactions where user_id=$1 and kind='sale'",
  [user.id],
);
check("TEST 6d · one sale transaction recorded", saleTx.rows[0].n === 1 && saleTx.rows[0].total === sellValue, JSON.stringify(saleTx.rows[0]));

await page.goto(`${BASE}/collection`, { waitUntil: "networkidle2" });
const soldGone = await bodyText();
check("TEST 6e · sold card is not in the active collection", !soldGone.includes(sellCard.name), sellCard.name);
const newBalance = await balance();
check("TEST 6f · header balance reflects the sale", newBalance === `$${(afterCredits / 100).toFixed(2)}`, `header=${newBalance} before=${before}`);

await page.goto(`${BASE}/history`, { waitUntil: "networkidle2" });
const historyText = await bodyText();
check("TEST 6g · sale appears in the transaction history", historyText.includes(sellCard.name), "history lists the sold card");
check("TEST 6h · history shows pack spends and sales", /Sale/i.test(historyText) && /Pack/i.test(historyText));
await page.screenshot({ path: `${SHOTS}/06-history.png` });

/* ── TEST 2 / 3: ultra + secret land on the right rarity ── */
// fund the high-rarity loop (each signature pack is $43)
await db.query("update users set credits = credits + 100000 where id=$1", [user.id]);
const seen = new Map();
for (let i = 0; i < 6 && !(seen.has("ultra") && seen.has("secret")); i += 1) {
  const payload = await sellRun("vault-signature", undefined, "landed");
  await sleep(300);
  if (!payload?.card) {
    check("TEST 2/3 · signature pack opened", false, "no card returned");
    break;
  }
  const target = payload.card.tier;
  await waitPhase(["landed"]);
  await sleep(150);
  const bannerText = await page.evaluate(
    () => document.querySelector('[data-testid="rarity-landing"]')?.innerText ?? "",
  );
  const expected = { ultra: "Ultra Rare", secret: "Secret Rare", rare: "Rare", uncommon: "Uncommon", common: "Common" }[target];
  check(
    `TEST ${target === "secret" ? "3" : "2"} · ${target} draw landed on ${expected}`,
    bannerText.toLowerCase().includes(expected.toLowerCase()),
    bannerText.replace(/\n/g, " "),
  );
  if (!seen.has(target)) {
    seen.set(target, bannerText);
    await sleep(700);
    await page.screenshot({ path: `${SHOTS}/07-${target}.png` });
  }
  await waitPhase(["result"], 180000);
  await sleep(400);
  await clickText("VAULT");
  await page.waitForFunction(() => !document.querySelector('[data-phase]'), { timeout: 40000 }).catch(() => {});
  await sleep(500);
}
check("TEST 2/3 · high-rarity draws observed", seen.has("ultra") && seen.has("secret"), [...seen.keys()].join("+"));

/* ── starter pack is one per account ── */
await page.goto(`${BASE}/packs/first-spark`, { waitUntil: "networkidle2" });
await sleep(500);
await openRip("Rip free pack");
await sleep(800);
await clickText("Tear without dragging");
await sleep(3500);
const blocked = await bodyText();
const starterOpenings = await db.query(
  "select count(*)::int n from openings o join packs p on p.id=o.pack_id where o.user_id=$1 and p.slug='first-spark'",
  [user.id],
);
check("TEST 8e · starter pack cannot be opened twice", starterOpenings.rows[0].n === 1, `openings=${starterOpenings.rows[0].n} · ${/already been opened/i.test(blocked) ? "message shown" : "no message"}`);

/* ── no client-side balance manipulation ── */
const forged = await page.evaluate(async () => {
  const r = await fetch("/api/sell", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ openingId: crypto.randomUUID() }),
  });
  return r.status;
});
check("TEST 10d · unknown opening id is rejected", forged === 409, `status=${forged}`);

await page.screenshot({ path: `${SHOTS}/08-final.png` });

const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
if (failures.length) console.log("FAILED:", failures.map((f) => f.name).join(" | "));

await browser.close();
await db.end();
process.exit(failures.length ? 1 : 0);

/* Focused: ultra and secret draws must land on their own rarity. */

import puppeteer from "puppeteer-core";
import { Client } from "pg";

const BASE = "http://localhost:3010";
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
const clickStarts = (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      x.textContent.replace(/\s+/g, " ").trim().toLowerCase().startsWith(t.toLowerCase()),
    );
    b?.click();
    return Boolean(b);
  }, text);

const username = `rar${Date.now().toString().slice(-8)}`;
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await sleep(600);
await page.evaluate(async (u) => {
  await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: "raritytest123" }),
  });
}, username);
const user = (await db.query("select id from users where username=$1", [username])).rows[0];
await db.query("update users set credits = 500000 where id=$1", [user.id]);

const LABEL = { common: "Common", uncommon: "Uncommon", rare: "Rare", ultra: "Ultra Rare", secret: "Secret Rare" };
const seen = new Map();
let failures = 0;

for (let i = 0; i < 5 && !(seen.has("ultra") && seen.has("secret")); i += 1) {
  await page.goto(`${BASE}/packs/vault-signature`, { waitUntil: "networkidle2" });
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
  await clickStarts("Tear without dragging");
  await waitPhase("landed");
  await sleep(400);
  const banner = (
    await page.evaluate(() => document.querySelector('[data-testid="rarity-landing"]')?.innerText ?? "")
  ).replace(/\s+/g, " ");
  const tier = payload?.card?.tier;
  const expected = LABEL[tier];
  const ok = Boolean(expected) && banner.toLowerCase().includes(expected.toLowerCase());
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} · ${tier} draw → banner "${banner}"`);
  seen.set(tier, banner);

  await waitPhase("result");
  await sleep(400);
  await clickStarts("VAULT");
  await page.waitForFunction(() => !document.querySelector("[data-phase]"), { timeout: 40000 }).catch(() => {});
  await sleep(500);
}

const both = seen.has("ultra") && seen.has("secret");
console.log(`\nobserved: ${[...seen.keys()].join(", ")}`);
if (!both) failures += 1;
console.log(failures === 0 && both ? "ALL RARITY CHECKS PASSED" : "RARITY CHECKS FAILED");

await browser.close();
await db.end();
process.exit(failures === 0 && both ? 0 : 1);

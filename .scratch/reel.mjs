/* Focused check: does the ribbon visibly land on the drawn rarity? */

import puppeteer from "puppeteer-core";
import { Client } from "pg";
import fs from "node:fs";

const BASE = "http://localhost:3010";
const db = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:54329/auric" });
await db.connect();
fs.mkdirSync(".shots/reel", { recursive: true });
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

const username = `reel${Date.now().toString().slice(-8)}`;
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
await sleep(600);
await page.evaluate(async (u) => {
  await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: u, password: "reeltest123" }),
  });
}, username);
const { rows } = await db.query("select id from users where username = $1", [username]);
await db.query("update users set credits = 500000 where id = $1", [rows[0].id]);

const phaseNow = () => page.evaluate(() => document.querySelector("[data-phase]")?.getAttribute("data-phase"));
const waitPhase = async (want, timeout = 180000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await phaseNow()) === want) return true;
    await sleep(150);
  }
  return false;
};

const runs = [];
for (const slug of ["vault-signature", "vault-signature", "booster-paldean-fates"]) {
  await page.goto(`${BASE}/packs/${slug}`, { waitUntil: "networkidle2" });
  await sleep(700);
  payload = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^Rip/i.test(x.textContent.trim()));
      b?.click();
    });
    try {
      await page.waitForSelector("[data-phase]", { timeout: 6000 });
      break;
    } catch {
      await sleep(1200);
    }
  }
  await sleep(700);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Tear without dragging/i.test(x.textContent));
    b?.click();
  });

  await waitPhase("roulette");
  await sleep(900);
  await page.screenshot({ path: `.shots/reel/${slug}-spinning.png` });

  await waitPhase("landed");
  await sleep(450); // ribbon has settled, still visible for the pause
  const banner = await page.evaluate(
    () => document.querySelector('[data-testid="rarity-landing"]')?.innerText.replace(/\n/g, " ") ?? "",
  );
  await page.screenshot({ path: `.shots/reel/${slug}-landed-${payload?.card?.tier}.png` });
  runs.push({ tier: payload?.card?.tier, name: payload?.card?.name, banner });
  console.log(`tier=${payload?.card?.tier} card=${payload?.card?.name} banner="${banner}"`);

  await waitPhase("result");
  await sleep(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "VAULT");
    b?.click();
  });
  await page.waitForFunction(() => !document.querySelector("[data-phase]"), { timeout: 40000 }).catch(() => {});
  await sleep(700);
}

console.log(JSON.stringify(runs));
await browser.close();
await db.end();

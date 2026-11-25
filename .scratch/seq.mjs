import puppeteer from "puppeteer-core";
import fs from "node:fs";

const MODE = process.argv[2] ?? "a";
const BASE = "http://localhost:3010";
const OUT = `.shots/seq-${MODE}`;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PLAN =
  MODE === "a"
    ? [
        [1500, "a1-opening"],
        [2600, "a2-emerging"],
        [3500, "a3-emerging-late"],
        [4400, "a4-roulette"],
      ]
    : [
        [6000, "b1-roulette"],
        [7200, "b2-roulette-late"],
        [9000, "b3-landed"],
        [10300, "b4-reveal"],
        [11500, "b5-reveal-end"],
        [13000, "b6-result"],
      ];

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars"],
  defaultViewport: { width: 1440, height: 960, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
await page.evaluate(async () => {
  const username = "seqtest" + Math.floor(Math.random() * 1e6);
  await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: "rippass123" }),
  });
});

await page.goto(BASE + "/packs/first-spark", { waitUntil: "networkidle2" });
await sleep(1500);
for (let attempt = 0; attempt < 4; attempt += 1) {
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => /^Rip/.test(b.textContent.trim()));
    button?.click();
    return Boolean(button);
  });
  await sleep(1200);
  const has = await page.evaluate(() => Boolean(document.querySelector("canvas")));
  console.log("open attempt", attempt, clicked, has);
  if (has) break;
}
await page.waitForSelector("canvas", { timeout: 20000 });
await sleep(6000);

await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /Tear without dragging/i.test(b.textContent))
    ?.click();
});
const start = Date.now();
for (const [at, name] of PLAN) {
  const wait = at - (Date.now() - start);
  if (wait > 0) await sleep(wait);
  const phase = await page.evaluate(() => ({
    live: document.querySelector("[aria-live]")?.textContent?.trim() ?? "",
    result: /OPEN ANOTHER PACK/i.test(document.body.innerText),
  }));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, JSON.stringify(phase));
}
console.log("LOGS:", logs.slice(0, 20).join(" | "));
await browser.close();

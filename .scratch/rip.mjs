import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = "http://localhost:3010";
const OUT = ".shots/rip";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars"],
  defaultViewport: { width: 1440, height: 960, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const phase = await page.evaluate(() => document.body.innerText.match(/\b(IT'S OPEN|READING THE RARITY|SEALING|OPENING THE PACK|OPEN ANOTHER PACK)\b/i)?.[0] ?? "-");
  console.log(name, "->", phase);
};

await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
const signup = await page.evaluate(async () => {
  const username = "riptest" + Math.floor(Math.random() * 1e6);
  const r = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: "rippass123" }),
  });
  return { status: r.status, text: (await r.text()).slice(0, 100) };
});
console.log("signup:", signup.status, signup.text);

await page.goto(BASE + "/packs/first-spark", { waitUntil: "networkidle2" });
await sleep(800);
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((b) => /^Rip/.test(b.textContent.trim()));
  button?.click();
});

await page.waitForSelector("canvas", { timeout: 15000 });
await sleep(8000);
await shot("01-intro");

const box = await page.evaluate(() => {
  const rects = [...document.querySelectorAll("canvas")].map((c) => c.getBoundingClientRect());
  rects.sort((a, b) => b.width * b.height - a.width * a.height);
  const r = rects[0];
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log("stage canvas:", box);

const scale = 2.65 / box.h;
const cx = box.x + box.w / 2;
const cy = box.y + box.h / 2;
const grabX = cx + -0.42 / scale;
const grabY = cy - (0.86 - 0.12) / scale;
const endX = box.x + box.w - 24;

await page.mouse.move(grabX, grabY);
await sleep(300);
await shot("02-hover");
await page.mouse.down();
await sleep(150);

const steps = 30;
for (let i = 1; i <= steps; i += 1) {
  await page.mouse.move(grabX + ((endX - grabX) * i) / steps, grabY, { steps: 1 });
  await sleep(28);
  if (i === 6) await shot("03-tearing-early");
  if (i === 16) await shot("04-tearing-mid");
  if (i === 26) await shot("05-tearing-late");
}
await shot("06-torn");
await page.mouse.up();

await sleep(500);
await shot("07-opening");
console.log("after tear:", await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\n/g, " | ")));
await sleep(900);
await shot("08-emerging");
await sleep(1500);
await shot("09-roulette");
await sleep(1500);
await shot("10-roulette-late");
await sleep(1200);
await shot("11-landed");
await sleep(700);
await shot("12-reveal");
await sleep(2600);
await shot("13-result");

const state = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 500).replace(/\n/g, " | "),
  canvas: [...document.querySelectorAll("canvas")].map((c) => `${c.width}x${c.height}`),
}));
console.log("state:", JSON.stringify(state, null, 1));
console.log("LOGS:\n" + logs.slice(0, 80).join("\n"));

await browser.close();

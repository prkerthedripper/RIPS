import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3010";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--hide-scrollbars"],
  defaultViewport: { width: 1440, height: 1000 },
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errs.push("console " + m.text().slice(0, 160));
});

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await sleep(9000);
await page.screenshot({ path: ".shots/perf-home.png" });
const home = await page.evaluate(() => ({
  canvases: document.querySelectorAll("canvas").length,
  imgs: [...document.querySelectorAll(".pack-mesh-img")].length,
  placeholders: [...document.querySelectorAll(".pack-mesh-placeholder, .pack-mesh-img")].length,
}));
console.log("home", JSON.stringify(home));

await page.goto(BASE + "/packs", { waitUntil: "domcontentloaded" });
await sleep(8000);
await page.screenshot({ path: ".shots/perf-packs.png" });

console.log("errors:", errs.slice(0, 6).join(" | ") || "none");
await browser.close();

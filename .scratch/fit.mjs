import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "shell",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860 });
page.on("console", (m) => { const t = m.text(); if (t.includes("pack-fit")) console.log(t); });
await page.evaluateOnNewDocument(() => { window.__packFit = true; });
await page.goto("http://localhost:65510/", { waitUntil: "networkidle2", timeout: 90000 }).catch(()=>{});
await new Promise((r) => setTimeout(r, 9000));
await browser.close();

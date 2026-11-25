import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3010";
const path = process.argv[2] ?? "/";
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--hide-scrollbars"],
  defaultViewport: { width: 1440, height: 960 },
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.__lt = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]);
  }).observe({ entryTypes: ["longtask"] });
});
await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 9000));

const report = await page.evaluate(() => {
  const res = performance.getEntriesByType("resource");
  const js = res.filter((e) => /\.js(\?|$)/.test(e.name));
  const nav = performance.getEntriesByType("navigation")[0] ?? {};
  const lt = (window.__lt ?? []).map((e) => e[1]);
  const spans = (window.__lt ?? []).join(" ");
  return {
    spans,
    scripts: js.length,
    jsKB: Math.round(js.reduce((s, e) => s + (e.transferSize || e.encodedBodySize || 0), 0) / 1024),
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd ?? 0),
    loadEvent: Math.round(nav.loadEventEnd ?? 0),
    longTasks: lt.length,
    longTaskMs: lt.reduce((a, b) => a + b, 0),
    worstTask: lt.length ? Math.max(...lt) : 0,
    canvases: document.querySelectorAll("canvas").length,
    images: document.querySelectorAll("img").length,
  };
});
console.log(path, JSON.stringify(report));
await browser.close();

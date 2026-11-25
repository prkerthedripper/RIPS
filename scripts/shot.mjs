/*
  Reference capture: screenshots a URL at several widths so the design can be
  measured rather than guessed. Usage: node scripts/shot.mjs <url> <outdir> [label]
*/
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const url = process.argv[2] ?? "https://crownrips.com/";
const outDir = process.argv[3] ?? path.join(process.cwd(), ".shots", "ref");
const label = process.argv[4] ?? "ref";
const waitMs = Number(process.env.WAIT_MS ?? 6000);

fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1"],
});

try {
  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 }).catch((e) => console.log("nav:", e.message));
    await new Promise((r) => setTimeout(r, waitMs));

    const file = path.join(outDir, `${label}-${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log("shot", file);

    // Full page, capped so a very long page still produces a readable PNG.
    const full = path.join(outDir, `${label}-${vp.name}-full.png`);
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height <= 6000) {
      await page.screenshot({ path: full, fullPage: true });
      console.log("shot", full, `${vp.width}x${height}`);
    } else {
      console.log("skip full page at", vp.width, "height", height);
    }

    // Structural probe: geometry, colours, type.
    const probe = await page.evaluate(() => {
      const pick = (el, keys) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const out = { tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 160) };
        for (const k of keys) out[k] = cs[k];
        out.box = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
        return out;
      };
      const q = (s) => document.querySelector(s);
      const links = [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))];
      const buttons = [...document.querySelectorAll("button, [role=button], a[class*=btn], a[class*=button]")]
        .slice(0, 14)
        .map((el) => pick(el, ["background", "color", "borderRadius", "fontSize", "fontWeight", "padding", "border", "height"]));
      const cards = [...document.querySelectorAll("[class*=card], article, [class*=pack], [class*=tile]")]
        .slice(0, 10)
        .map((el) => pick(el, ["background", "borderRadius", "border", "boxShadow", "padding"]));
      return {
        title: document.title,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyColor: getComputedStyle(document.body).color,
        bodyFont: getComputedStyle(document.body).fontFamily,
        bodyFontSize: getComputedStyle(document.body).fontSize,
        header: pick(q("header"), ["background", "height", "position", "backdropFilter", "borderBottom", "padding"]),
        h1: pick(q("h1"), ["fontSize", "fontWeight", "lineHeight", "letterSpacing", "color", "fontFamily"]),
        h2: pick(q("h2"), ["fontSize", "fontWeight", "lineHeight", "letterSpacing", "color"]),
        nav: pick(q("nav"), ["display", "gap", "height", "alignItems"]),
        main: pick(q("main"), ["maxWidth", "padding", "margin"]),
        section: pick(q("section"), ["padding", "maxWidth", "display"]),
        links,
        buttons,
        cards,
        imgCount: document.querySelectorAll("img").length,
        text: document.body.innerText.replace(/\n{2,}/g, "\n").slice(0, 4000),
      };
    });
    fs.writeFileSync(path.join(outDir, `${label}-${vp.name}.json`), JSON.stringify(probe, null, 2));
    if (errors.length) console.log("pageerrors", vp.name, errors.slice(0, 4));
    await page.close();
  }
} finally {
  await browser.close();
}
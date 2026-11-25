import puppeteer from "puppeteer-core";
import fs from "node:fs";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "shell",
  args: ["--no-sandbox", "--hide-scrollbars", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("[console]", m.type(), m.text().slice(0, 600)));
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 800)));
page.on("requestfailed", (r) => console.log("[reqfail]", r.url().slice(0, 120), r.failure()?.errorText));
await page.goto("http://localhost:65510/", { waitUntil: "networkidle2", timeout: 90000 }).catch((e) => console.log("nav", e.message));
await new Promise((r) => setTimeout(r, 10000));

const data = await page.evaluate(() => {
  const frame = document.querySelector(".pack-frame");
  const fiber = frame ? Object.keys(frame).filter((k) => k.startsWith("__react")) : [];
  return {
    debug: frame?.getAttribute("data-debug") ?? null,
    fiber,
    canvases: document.querySelectorAll("canvas").length,
    imgs: document.querySelectorAll(".pack-mesh-img").length,
    packDebug: !!window.__packDebug,
    webgl: (() => {
      try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
      } catch {
        return "throw";
      }
    })(),
  };
});
console.log(JSON.stringify(data, null, 2));
await page.screenshot({ path: ".shots/probe3.png" });
await browser.close();

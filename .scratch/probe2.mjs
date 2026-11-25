import puppeteer from "puppeteer-core";
import fs from "node:fs";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "shell",
  args: ["--no-sandbox", "--hide-scrollbars", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("[console]", m.type(), m.text().slice(0, 500)));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 60000 }).catch((e) => console.log("nav", e.message));
await new Promise((r) => setTimeout(r, 9000));

const data = await page.evaluate(() => {
  const face = window.__packFace;
  let faceUrl = null;
  if (face) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 854;
    c.getContext("2d").drawImage(face, 0, 0, 512, 854);
    faceUrl = c.toDataURL("image/png");
  }
  return {
    face: faceUrl,
    arts: [...document.querySelectorAll(".pack-art")].map((el) => {
      const r = el.getBoundingClientRect();
      return { cls: el.className.slice(0, 60), rect: [r.x | 0, r.y | 0, r.width | 0, r.height | 0], html: el.innerHTML.slice(0, 90) };
    }),
    placeholders: document.querySelectorAll(".pack-mesh-placeholder").length,
    canvases: document.querySelectorAll("canvas").length,
    overlay: !!document.querySelector("nextjs-portal"),
  };
});

if (data.face) {
  fs.mkdirSync(".shots", { recursive: true });
  fs.writeFileSync(".shots/face.png", Buffer.from(data.face.split(",")[1], "base64"));
  console.log("wrote .shots/face.png");
}
delete data.face;
console.log(JSON.stringify(data, null, 2));
await browser.close();

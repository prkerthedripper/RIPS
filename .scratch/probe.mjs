import puppeteer from "puppeteer-core";
import fs from "node:fs";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "shell",
  args: ["--no-sandbox", "--hide-scrollbars", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("[console]", m.type(), m.text().slice(0, 400)));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 60000 }).catch((e) => console.log("nav", e.message));
await new Promise((r) => setTimeout(r, 8000));

const data = await page.evaluate(() => {
  const img = document.querySelector(".pack-mesh-img");
  const d = window.__packDebug;
  let info = null;
  if (d) {
    const list = [];
    d.model.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      list.push({
        type: o.geometry.type,
        verts: o.geometry.attributes.position?.count,
        bb: bb ? [bb.min.toArray().map((n) => +n.toFixed(2)), bb.max.toArray().map((n) => +n.toFixed(2))] : null,
        mat: o.material.type,
        hasMap: !!o.material.map,
        mapImg: o.material.map?.image ? [o.material.map.image.width, o.material.map.image.height] : null,
        visible: o.visible,
      });
    });
    info = { list, render: d.gl.info.render, canvas: [d.gl.domElement.width, d.gl.domElement.height] };
  }
  return { img: img ? img.src : null, info, canvases: document.querySelectorAll("canvas").length };
});

if (data.img) {
  fs.mkdirSync(".shots", { recursive: true });
  fs.writeFileSync(".shots/baked.webp", Buffer.from(data.img.split(",")[1], "base64"));
  console.log("wrote .shots/baked.webp");
}
console.log(JSON.stringify({ info: data.info, canvases: data.canvases }, null, 2));
await browser.close();

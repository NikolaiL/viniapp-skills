#!/usr/bin/env node
// Render the opaque miniapp images: public/icon.png (1024×1024), public/splash.png (200×200)
// and public/embed.png (1200×800, 3:2). PNGs are written as RGB (no alpha channel).
// usage: node scripts/miniapp-assets.mjs <icon.svg|icon.html> [embed.svg|embed.html] [--bg "#0b0b10"]
// Without an embed source, the icon is centred on the background colour.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const bgAt = args.indexOf("--bg");
const bg = bgAt >= 0 ? args.splice(bgAt, 2)[1] : "#000000";
const [iconSource, embedSource] = args;
if (!iconSource) {
  console.error('Usage: node scripts/miniapp-assets.mjs <icon.svg|icon.html> [embed.svg|embed.html] [--bg "#0b0b10"]');
  process.exit(1);
}

function markup(file, fit) {
  if (!file.endsWith(".svg")) return readFileSync(file, "utf8");
  const src = `data:image/svg+xml;base64,${readFileSync(file).toString("base64")}`;
  return `<img src="${src}" style="width:100%;height:100%;object-fit:${fit}">`;
}

function rgbPng(width, height, rgba) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4, d = y * stride + 1 + x * 3;
      raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2];
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${bg}">${html}</body></html>`, { waitUntil: "load" });
  const shot = (await page.screenshot({ type: "png" })).toString("base64");
  // Flatten onto the background in a canvas to read plain RGBA bytes, then drop alpha.
  const b64 = await page.evaluate(async ({ shot, width, height, bg }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${shot}`;
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width, height });
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
    const bytes = ctx.getImageData(0, 0, width, height).data;
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  }, { shot, width, height, bg });
  return rgbPng(width, height, Buffer.from(b64, "base64"));
}

mkdirSync("public", { recursive: true });
writeFileSync("public/icon.png", await render(markup(iconSource, "contain"), 1024, 1024));
writeFileSync("public/splash.png", await render(markup(iconSource, "contain"), 200, 200));
const embed = embedSource ? markup(embedSource, "cover") : `<div style="display:grid;place-items:center;width:100%;height:100%"><div style="width:420px;height:420px">${markup(iconSource, "contain")}</div></div>`;
writeFileSync("public/embed.png", await render(embed, 1200, 800));
await browser.close();
console.log("Wrote public/icon.png (1024×1024), public/splash.png (200×200), public/embed.png (1200×800), RGB without alpha.");

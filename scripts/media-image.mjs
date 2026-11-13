#!/usr/bin/env node
// Generate an image with Google's Gemini image models, billed to the app owner's GEMINI_API_KEY
// (read from the environment, else from the app's .env.local/.env; never printed).
// Run from the app directory:
//   node <skill-dir>/scripts/media-image.mjs --prompt "..." --out public/game/ship.png
//     [--cutout] [--key "#00ff00"] [--ref public/game/key-art.webp ...] [--aspect 1:1] [--width 512] [--fast]
// --cutout   generate on a flat chroma-key colour, remove it, trim, and write real alpha (.png/.webp only)
// --ref      reference image(s) for style/character consistency (repeatable)
// --size     1K (default; e.g. 1024² or 768×1376 at 9:16), 2K or 4K (gemini-3-pro-image only; costs more)
// --width    downscale to this width (keeps aspect); never upscales
// --fast     gemini-3.1-flash-image instead of gemini-3-pro-image
// --input    post-process an existing image (e.g. Codex image output) instead of generating; no key needed
// .png/.webp are re-encoded in the app's Playwright Chromium; .jpg is written as returned.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: opts } = parseArgs({
  options: {
    prompt: { type: "string" }, out: { type: "string" }, ref: { type: "string", multiple: true, default: [] },
    aspect: { type: "string", default: "1:1" }, width: { type: "string" }, size: { type: "string", default: "1K" }, cutout: { type: "boolean", default: false },
    key: { type: "string", default: "#00ff00" }, input: { type: "string" }, fast: { type: "boolean", default: false }, quality: { type: "string", default: "0.86" },
  },
});
const ext = path.extname(opts.out ?? "").toLowerCase();
if (!(opts.prompt || opts.input) || ![".png", ".webp", ".jpg", ".jpeg"].includes(ext) || (opts.cutout && ![".png", ".webp"].includes(ext))) {
  console.error('Usage: media-image.mjs --prompt "..." --out <file.png|.webp|.jpg> [--cutout (png/webp)] [--ref img ...] [--aspect 1:1] [--width N] [--fast]');
  process.exit(1);
}

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8").split("\n").find(l => /^\s*GEMINI_API_KEY\s*=/.test(l));
    const value = line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  console.error("GEMINI_API_KEY is not set (environment, .env.local or .env). Image generation is blocked: report it as an owner prerequisite.");
  process.exit(2);
}

const keyHex = opts.key.replace("#", "").toLowerCase();
const keyRgb = [0, 2, 4].map(i => parseInt(keyHex.slice(i, i + 2), 16));
let prompt = opts.prompt;
if (opts.cutout) {
  prompt += `\nIsolated single subject, fully inside the frame with a small margin, on a perfectly flat uniform #${keyHex} background that fills the whole image: no gradient, floor, cast shadow, border, vignette or texture on the background, and no #${keyHex}-coloured areas in the subject. No text.`;
}
const mime = file => ({ ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" })[path.extname(file).toLowerCase()];
const parts = [{ text: prompt }, ...opts.ref.map(file => ({ inlineData: { mimeType: mime(file), data: readFileSync(file).toString("base64") } }))];
const model = opts.fast ? "gemini-3.1-flash-image" : "gemini-3-pro-image";
const body = JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: opts.aspect, ...(opts.size !== "1K" && !opts.fast ? { imageSize: opts.size } : {}) } } });

let image = opts.input && { mimeType: mime(opts.input), data: readFileSync(opts.input).toString("base64") };
for (let attempt = 1; attempt <= 3 && !image; attempt++) {
  const started = Date.now();
  const tick = setInterval(() => console.error(`still waiting for ${model} (${Math.round((Date.now() - started) / 1000)} s)`), 30_000);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": apiKey(), "content-type": "application/json" }, body,
  }).finally(() => clearInterval(tick));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = `HTTP ${res.status}: ${data.error?.message ?? "no message"}`.slice(0, 400);
    if ((res.status === 429 || res.status >= 500) && attempt < 3) { console.error(`${message}; retrying`); await new Promise(r => setTimeout(r, 4000 * attempt)); continue; }
    console.error(message);
    process.exit(1);
  }
  const responseParts = data.candidates?.[0]?.content?.parts ?? [];
  image = responseParts.find(p => p.inlineData)?.inlineData;
  if (!image) {
    console.error(`No image returned (${data.candidates?.[0]?.finishReason ?? "unknown"}): ${responseParts.map(p => p.text).filter(Boolean).join(" ").slice(0, 300)}`);
    process.exit(1);
  }
}

mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
if ([".jpg", ".jpeg"].includes(ext) && image.mimeType === "image/jpeg" && !opts.width) {
  writeFileSync(opts.out, Buffer.from(image.data, "base64"));
} else {
  // Decode and re-encode in the app's Chromium so no image library is needed.
  const { chromium } = createRequire(path.resolve("package.json"))("@playwright/test");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = await page.evaluate(async ({ src, cutout, key, width, type, quality }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    let canvas = Object.assign(document.createElement("canvas"), { width: img.naturalWidth, height: img.naturalHeight });
    let ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    let stats = null;
    if (cutout) {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = pixels.data;
      const keyChannels = [0, 1, 2].filter(c => key[c] > 127), other = [0, 1, 2].filter(c => key[c] <= 127);
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1, clear = 0;
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.hypot(d[i] - key[0], d[i + 1] - key[1], d[i + 2] - key[2]);
        const alpha = Math.max(0, Math.min(1, (dist - 70) / 90));
        // Remove key-colour spill from edges and semi-transparent pixels.
        const spill = Math.min(...keyChannels.map(c => d[i + c])) - Math.max(0, ...other.map(c => d[i + c]));
        if (spill > 0 && (alpha < 1 || dist < 300)) for (const c of keyChannels) d[i + c] -= spill;
        d[i + 3] = Math.round(alpha * 255);
        if (d[i + 3] < 8) clear++;
        else { const p = i / 4, x = p % canvas.width, y = (p - x) / canvas.width; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
      const corners = [0, canvas.width - 1, (canvas.height - 1) * canvas.width, canvas.height * canvas.width - 1].map(p => d[p * 4 + 3]);
      stats = { clearRatio: clear / (d.length / 4), corners };
      if (maxX < 0) return { error: "everything was keyed out" };
      ctx.putImageData(pixels, 0, 0);
      const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
      const [x, y] = [Math.max(0, minX - pad), Math.max(0, minY - pad)];
      const [w, h] = [Math.min(canvas.width, maxX + pad + 1) - x, Math.min(canvas.height, maxY + pad + 1) - y];
      const trimmed = Object.assign(document.createElement("canvas"), { width: w, height: h });
      trimmed.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
      canvas = trimmed;
    }
    if (width && width < canvas.width) {
      const scaled = Object.assign(document.createElement("canvas"), { width, height: Math.round(canvas.height * width / canvas.width) });
      ctx = scaled.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      canvas = scaled;
    }
    return { stats, size: [canvas.width, canvas.height], url: canvas.toDataURL(type, quality) };
  }, {
    src: `data:${image.mimeType};base64,${image.data}`, cutout: opts.cutout, key: keyRgb, width: opts.width ? Number(opts.width) : 0,
    type: ext === ".webp" ? "image/webp" : ext === ".png" ? "image/png" : "image/jpeg", quality: Number(opts.quality),
  });
  await browser.close();
  if (result.error) { console.error(`Cutout failed: ${result.error}. Regenerate, or pick a --key colour absent from the subject.`); process.exit(1); }
  if (result.stats && (result.stats.clearRatio < 0.05 || result.stats.corners.some(a => a > 8))) {
    console.error(`Cutout failed: background not keyed (clear ${(result.stats.clearRatio * 100).toFixed(1)}%, corner alpha ${result.stats.corners}). Regenerate; do not ship it.`);
    process.exit(1);
  }
  writeFileSync(opts.out, Buffer.from(result.url.split(",")[1], "base64"));
  console.log(`Wrote ${opts.out} (${result.size.join("×")}${result.stats ? `, ${(result.stats.clearRatio * 100).toFixed(0)}% transparent` : ""})${opts.input ? "" : ` with ${model}`}.`);
  process.exit(0);
}
console.log(`Wrote ${opts.out}${opts.input ? "" : ` with ${model}`}.`);

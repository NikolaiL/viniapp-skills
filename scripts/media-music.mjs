#!/usr/bin/env node
// Generate music with Google Lyria, billed to the app owner's GEMINI_API_KEY
// (read from the environment, else from the app's .env.local/.env; never printed).
// Run from the app directory:
//   node <skill-dir>/scripts/media-music.mjs --prompt "..." --out public/audio/bgm-loop.mp3 [--loop] [--duration 60] [--bpm 120] [--lyrics "..."]
// --loop      gameplay/menu music: constant energy, no intro/outro/fade, ends the way it begins
// --duration  over 30 s uses lyria-3.5 (length steered by prompt); default is a 30 s clip (lyria-3-clip-preview)
// Instrumental unless --lyrics is given. Output is MP3.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: opts } = parseArgs({
  options: {
    prompt: { type: "string" }, out: { type: "string" }, loop: { type: "boolean", default: false },
    duration: { type: "string" }, bpm: { type: "string" }, lyrics: { type: "string" },
  },
});
if (!opts.prompt || !opts.out?.toLowerCase().endsWith(".mp3")) {
  console.error('Usage: media-music.mjs --prompt "..." --out <file.mp3> [--loop] [--duration 31-300] [--bpm N] [--lyrics "..."]');
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
  console.error("GEMINI_API_KEY is not set (environment, .env.local or .env). Music generation is blocked: report it as an owner prerequisite.");
  process.exit(2);
}

const duration = opts.duration ? Number(opts.duration) : 0;
const model = duration > 30 ? "lyria-3.5" : "lyria-3-clip-preview";
const lines = [opts.prompt];
if (opts.bpm) lines.push(`Tempo: ${Number(opts.bpm)} BPM.`);
if (duration > 30) lines.push(`Total length: about ${duration} seconds.`);
if (opts.loop) lines.push("Seamless loop for a game: constant tempo and energy from the first bar to the last, no intro, no outro, no fade-in or fade-out, no final hit; the ending must flow straight back into the beginning without a pause.");
lines.push(opts.lyrics ? `Lyrics:\n${opts.lyrics}` : "Instrumental only, no vocals.");

for (let attempt = 1; attempt <= 3; attempt++) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey(), "content-type": "application/json" },
    body: JSON.stringify({ model, input: lines.join("\n") }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = `HTTP ${res.status}: ${data.error?.message ?? "no message"}`.slice(0, 400);
    // 429 "limit: 0" means the key's Google project is not on the paid tier: retrying cannot help.
    if ((res.status === 429 && !/limit: 0/.test(message) || res.status >= 500) && attempt < 3) { console.error(`${message}; retrying`); await new Promise(r => setTimeout(r, 4000 * attempt)); continue; }
    console.error(message);
    process.exit(1);
  }
  // Same rule as the SDK's output_audio: the last audio block wins.
  const audio = (data.steps ?? []).flatMap(step => step.content ?? []).filter(block => block.type === "audio").pop();
  if (!audio?.data) { console.error("The response contained no audio."); process.exit(1); }
  const bytes = Buffer.from(audio.data, "base64");
  mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  writeFileSync(opts.out, bytes);
  console.log(`Wrote ${opts.out} (${Math.round(bytes.length / 1024)} KB, about ${Math.round(bytes.length * 8 / 192000)} s at 192 kbps) with ${model}.`);
  process.exit(0);
}

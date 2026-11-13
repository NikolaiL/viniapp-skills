// Drop-in app/game audio: a gapless crossfaded music loop, tiny synthesized SFX and a persisted mute.
// Copy to lib/audio.ts. Call unlockAudio() inside the first tap/click/key handler (browsers block audio
// until a user gesture), then playMusic("/audio/bgm-loop.mp3") and sfx(SFX.coin) from game events.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
let musicToken = 0;
const buffers = new Map<string, Promise<AudioBuffer>>();
const MUTE_KEY = "audio-muted";

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = isMuted() ? 0 : 1;
    master.connect(ctx.destination);
    document.addEventListener("visibilitychange", () => void (document.hidden ? ctx?.suspend() : ctx?.resume()));
  }
  return ctx;
}

/** Call from the user-gesture handler that starts the game or toggles sound on. */
export function unlockAudio(): void {
  void audio().resume();
}

const muteListeners = new Set<() => void>();

/**
 * For React without a set-state-in-effect: `useSyncExternalStore(subscribeMute, isMuted, () => false)`.
 */
export function subscribeMute(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // storage unavailable: mute still applies for this session
  }
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
  muteListeners.forEach(listener => listener());
}

/**
 * Make a generated track loop cleanly: skip leading silence, drop a quieter tail (generated clips often
 * fade or thin out over the last seconds), cut to whole bars when the tempo is known, and bake an
 * equal-power crossfade from the audio after the loop end, so the loop keeps its exact bar length.
 */
export function seamlessLoop(buffer: AudioBuffer, options: { bpm?: number; beatsPerBar?: number; fadeSeconds?: number } = {}): AudioBuffer {
  const { bpm, beatsPerBar = 4, fadeSeconds = 0.5 } = options;
  const first = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  let start = 0;
  while (start < first.length && Math.abs(first[start]) < 0.003) start++;
  // Loudness per 50 ms window; the usable end is the last window within about 4 dB of the median.
  const win = Math.floor(rate * 0.05);
  const rms: number[] = [];
  for (let i = start; i + win <= first.length; i += win) {
    let sum = 0;
    for (let j = i; j < i + win; j++) sum += first[j] * first[j];
    rms.push(Math.sqrt(sum / win));
  }
  const median = [...rms].sort((a, b) => a - b)[Math.floor(rms.length / 2)] ?? 0;
  let last = rms.length - 1;
  while (last > 0 && rms[last] < median * 0.6) last--;
  const end = start + (last + 1) * win;
  const fade = Math.min(Math.floor(fadeSeconds * rate), Math.floor((end - start) / 4));
  const bar = bpm ? Math.round((60 / bpm) * beatsPerBar * rate) : 0;
  const usable = end - start - fade;
  const length = bar && usable >= bar ? Math.floor(usable / bar) * bar : usable;
  const out = new AudioBuffer({ length, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(start, start + length));
    // The tail after the loop end fades out over the head, so wrapping around continues the tail.
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      dst[i] = src[start + i] * Math.sqrt(t) + src[start + length + i] * Math.sqrt(1 - t);
    }
  }
  return out;
}

function loadLoop(url: string, bpm?: number): Promise<AudioBuffer> {
  let pending = buffers.get(url);
  if (!pending) {
    pending = fetch(url)
      .then(res => res.arrayBuffer())
      .then(data => audio().decodeAudioData(data))
      .then(buffer => seamlessLoop(buffer, { bpm }));
    pending.catch(() => buffers.delete(url));
    buffers.set(url, pending);
  }
  return pending;
}

/** Start (or switch to) a looping track with a short crossfade; pass the generation BPM to loop on bar lines. A later call or stopMusic() wins. */
export async function playMusic(url: string, { volume = 0.45, bpm }: { volume?: number; bpm?: number } = {}): Promise<void> {
  const token = ++musicToken;
  const c = audio();
  let buffer: AudioBuffer;
  try {
    buffer = await loadLoop(url, bpm);
  } catch {
    return; // missing or undecodable file: the game stays playable without music
  }
  if (token !== musicToken || !master) return;
  fadeOut(0.4);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.4);
  gain.connect(master);
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  source.start();
  current = { source, gain };
}

function fadeOut(seconds: number): void {
  if (!ctx || !current) return;
  const { source, gain } = current;
  gain.gain.setTargetAtTime(0, ctx.currentTime, seconds / 4);
  source.stop(ctx.currentTime + seconds);
  current = null;
}

export function stopMusic(fadeSeconds = 0.3): void {
  musicToken++;
  fadeOut(fadeSeconds);
}

export type Sfx = { wave?: OscillatorType; from: number; to?: number; duration: number; volume?: number; noise?: boolean };

/** Starting points; tune pitch/duration to the game's style. */
export const SFX = {
  tap: { wave: "triangle", from: 520, to: 700, duration: 0.05, volume: 0.15 },
  coin: { wave: "square", from: 880, to: 1760, duration: 0.12, volume: 0.12 },
  jump: { wave: "square", from: 260, to: 620, duration: 0.14, volume: 0.12 },
  hit: { noise: true, from: 900, to: 120, duration: 0.12, volume: 0.35 },
  explode: { noise: true, from: 1600, to: 60, duration: 0.5, volume: 0.45 },
  powerup: { wave: "sawtooth", from: 300, to: 1200, duration: 0.35, volume: 0.1 },
  lose: { wave: "sawtooth", from: 440, to: 90, duration: 0.6, volume: 0.14 },
} satisfies Record<string, Sfx>;

let noiseBuffer: AudioBuffer | null = null;

/** Synthesized one-shot: a pitch-swept oscillator, or filtered noise for hits and explosions. */
export function sfx(s: Sfx): void {
  if (!ctx || !master || ctx.state !== "running" || isMuted()) return;
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(s.volume ?? 0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + s.duration);
  gain.connect(master);
  let source: AudioScheduledSourceNode;
  if (s.noise) {
    if (!noiseBuffer) {
      noiseBuffer = new AudioBuffer({ length: ctx.sampleRate, numberOfChannels: 1, sampleRate: ctx.sampleRate });
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(s.from, t);
    filter.frequency.exponentialRampToValueAtTime(s.to ?? s.from, t + s.duration);
    noise.connect(filter).connect(gain);
    source = noise;
  } else {
    const osc = ctx.createOscillator();
    osc.type = s.wave ?? "square";
    osc.frequency.setValueAtTime(s.from, t);
    osc.frequency.exponentialRampToValueAtTime(s.to ?? s.from, t + s.duration);
    osc.connect(gain);
    source = osc;
  }
  source.start(t);
  source.stop(t + s.duration + 0.02);
}

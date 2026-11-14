---
name: media
description: Produce generated graphics, game art, music loops and sound effects that match one art direction, ship as real files, and are verified in the running app. Use when an app or game needs illustrated sprites, backgrounds, key art, a soundtrack, SFX, or "polished/AAA" visuals.
license: MIT
---

# Graphics and sound

Use generated media when the brief asks for illustrated graphics, a themed game,
music or "polished/premium/AAA" visuals, or when the product would read as a
placeholder without them. Quiet utilities need good layout and type, not
illustrations or audio. Never claim generated media exists without the files.

## Credentials and cost

Both tools bill the app owner's `GEMINI_API_KEY` (Google AI Studio, paid tier for
music). They read it from the environment, `.env.local` or `.env` and never print
it. Without a key, say so in the handoff, keep the app complete with hand-drawn
SVG/canvas art and synthesized audio under the same art direction, and list the
key as the prerequisite for generated assets. A Codex host may use its built-in
image generation instead; key its output with `--input` (below).

Generate a planned set once, look at every result, and regenerate only rejects.

## Tools

Run from the app directory (`<skill-dir>` is this pack's root):

```sh
# opaque art: backgrounds, key art, cards (WebP for photos/paintings, PNG for flat art)
node <skill-dir>/scripts/media-image.mjs --prompt "<style lock>. Empty backdrop, no objects, no text. <scene>" --aspect 9:16 --size 2K --width 1080 --out public/game/bg-far.webp
# sprites with real alpha: generated on a flat chroma key, keyed, despilled, trimmed, verified
node <skill-dir>/scripts/media-image.mjs --cutout --ref public/game/key-art.webp --prompt "<style lock>. <subject>" --width 256 --out public/game/player.png
# key out an image from elsewhere (no API call); use --key "#ff00ff" when the subject is green, teal or cyan
node <skill-dir>/scripts/media-image.mjs --input generated.png --cutout --out public/game/coin.png
# a 30 s seamless gameplay loop (lyria-3-clip-preview); --duration 31-300 uses lyria-3.5
node <skill-dir>/scripts/media-music.mjs --loop --bpm 120 --prompt "<genre, mood, instruments>" --out public/audio/bgm-loop.mp3
```

`media-image.mjs` uses `gemini-3-pro-image` (`--fast` for `gemini-3.1-flash-image`)
and needs the app's `@playwright/test` to re-encode PNG/WebP. Default output is
about 1 megapixel (1024², or 768×1376 at 9:16); `--size 2K` for full-screen art,
since `--width` only downscales. A 2K call can take 5–14 minutes: start the
independent assets in parallel in the background and keep building. Requested tile proportions are approximate:
draw sprites at the size the game needs rather than regenerating for exact
ratios. A cutout fails loudly when the background was not keyed; regenerate
rather than ship it.

For playback, copy [audio.ts](../assets/media/audio.ts) to `lib/audio.ts`.
`playMusic(url, { bpm })` (the BPM you generated with) skips leading silence,
drops the quieter tail generated clips often have, cuts to whole bars and bakes
a crossfade so the seam is inaudible. It also swaps tracks with a fade,
synthesizes SFX (`sfx(SFX.coin)`), suspends when the page is hidden, and
persists mute; read it in React with
`useSyncExternalStore(subscribeMute, isMuted, () => false)`. Call
`unlockAudio()` in the first tap/key handler. Show a mute control; never
autoplay before a user gesture.

## Workflow

1. **Art direction.** Read the brand assets and the brief, then write one style
   lock line (medium, rendering, light direction, 5–7 palette hex values,
   outline weight, camera angle, mood) in `GAME_SPEC.md` or `DESIGN_SPEC.md`.
   Prefix every image prompt with it verbatim. Describe rendering, not
   subjects: a lock that names objects ("like enamel toys") puts them into
   every background.
2. **Asset plan.** List each asset with its file, size, opacity (opaque or
   cutout) and where it renders. Keep text, scores and buttons out of images.
   Every asset the brief names is a deliverable: animation frames, parallax
   layers, a specific sound. Ship it, or say in the handoff what replaced it
   and why. A transformed single sprite is not an animation and one flat image
   is not a parallax background.
3. **Key art first.** Generate one scene that shows the style and look at it.
   Pass it as `--ref` to actors, pickups and UI pieces so the set matches. Do
   not pass it to backgrounds: the model copies its composition. Backgrounds
   use the style lock alone plus "empty backdrop, no objects".
4. **Generate and inspect.** View each file (over dark and light backgrounds for
   cutouts), check sizes with `file`, and regenerate mismatches. If your model
   cannot view images, say so: report art and screenshot review as unverified
   and ask for a human or a vision-capable reviewer. Pixel statistics do not
   catch overlapping layouts or mismatched styles.
5. **Integrate and verify** in the running app at phone and desktop sizes, then
   follow the screenshot review in [game art](references/game-art.md).

Icons, splash and share images still come from the miniapp asset script; reuse
the key art as their source so the launch surfaces match the app.

## References

| Reference | Read when |
| --- | --- |
| [Game art](references/game-art.md) | A game or showcase app needs a polished look: asset set, motion, lighting, effects, review |

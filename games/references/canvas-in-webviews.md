# Canvas games in mobile webviews

Read this when a canvas or WebGL game must run inside a phone browser or an
embedded host webview (social-app miniapps, wallet browsers, in-app browsers).
Layout basics are in [mobile](../../mobile/SKILL.md); loop and input rules are
in [loop-input-and-feel.md](loop-input-and-feel.md).

## Context and flicker

- Create the 2D context once, with options, before anything else calls
  `getContext`: `canvas.getContext("2d", { alpha: false })`. Options are fixed
  on the first call; a later call silently returns the existing context.
- Fill the full background as the first draw of every frame. Transparent
  canvases over a contrasting parent flicker or go black on Android WebView.
  For WebGL renderers set an opaque clear colour too.
- Some embedded engines lack newer 2D APIs. Use your own rounded-rect path
  helper (or feature-detect `ctx.roundRect`); one throwing call per frame
  leaves the playfield blank.
- Canvas cannot resolve `var(--x)`; read computed values once and cache them.
- Before `drawImage`, require `img.complete && img.naturalWidth > 0`;
  `complete` is also true after a failed load. Draw a visible fallback for
  optional art, and wrap each optional draw so one bad asset cannot stop the frame.

## Size and pixel ratio

Size from the container, not the window. `window.resize` does not fire when
flex children settle after first paint and is unreliable in webviews, so a
canvas sized from `window` often renders at zero or partial height.

```ts
const ro = new ResizeObserver(() => fit());
ro.observe(container); requestAnimationFrame(fit); // settle after first paint
function fit() {
  const { width, height } = container.getBoundingClientRect();
  if (width < 1 || height < 1) return;             // still laying out
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);          // reset, then scale
  view = { width, height };                        // game math uses CSS px
}
```

- Cap DPR at 2. Phones report 3–4; full DPR multiplies fill cost for no
  visible gain. Use `setTransform`, not a cumulative `scale`, on every resize.
- If a container measurement is missing, fall back to `visualViewport`, then
  `documentElement`, then `window.inner*`. Do not take the largest reported
  value, and do not apply aspect-fit twice.
- Fixed-resolution boards keep their backing size and scale the CSS size by
  `min(1, available / natural)` instead of overflowing.
- Pause or skip drawing while a resize is in flight; recompute every
  derived rect (spawn bounds, clamps, collision edges) from one shared
  playfield helper, especially inside rounded or masked frames.
- Orientation and host-chrome changes arrive as container resizes; pause the
  run on a large change. A portrait-only game shows a rotate message instead
  of a squashed stage.

## Stage and safe areas

During play the stage fills the viewport between the safe-area insets: draw
background art edge to edge and letterbox only the playfield, never the page.
Hide app chrome during a run and overlay the HUD and controls on the art,
inside the playfield above the bottom inset rather than in a separate footer
row. Consume the `--safe-area-inset-*` variables from [mobile](../../mobile/SKILL.md),
never raw `env()` in the game. A full-screen stage must stack above any fixed
navigation, or the nav steals taps from the
bottom of the field.

## Stop browser gestures on the playfield only

```css
.stage {
  touch-action: none; user-select: none; -webkit-user-select: none;
  -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
  overscroll-behavior: contain;
}
```

- In webviews `touch-action` alone may not stop the outer page scrolling.
  Add native `touchstart`/`touchmove` listeners with `{ passive: false }` on
  the stage and `preventDefault()` there. React's synthetic touch handlers are
  passive and cannot do this.
- Block `contextmenu` on the stage so a long press does not open a menu or an
  image save sheet; set `draggable={false}` on in-stage images.
- Prevent double-tap zoom on the game route with a viewport that sets
  `maximumScale: 1, userScalable: false` there only; leave pinch-zoom on for
  the rest of the app.
- Hosts with edge-swipe dismissal: if the game uses horizontal drag, use the
  host's option to disable native gestures during play, and keep controls
  away from screen edges. See [miniapps](../../miniapps/SKILL.md).
- Overlays with buttons own their pointer events and stop propagation. If the
  stage blocks touch defaults, route every overlay action through one helper
  and handle it consistently. Mixing pointer-only and `onClick` buttons
  creates controls that work on desktop but not on phones.

## Audio unlock

An `AudioContext` starts suspended on mobile. Create or `resume()` it
synchronously inside the first real gesture handler (the Start tap), not in a
mount effect or after an `await`. Use one shared context for the app. Keep
concurrent voices around ten. Prefer synthesized SFX or short compressed clips
(ogg/m4a, ≤ ~200 KB, never WAV). Make music start single-flight: a request
token checked after each `await` and bumped on stop, so a stale start cannot
restart music after leaving the screen. Respect a mute toggle and stop audio
when the page is hidden.

## Performance budget

- Target 60 fps (~16 ms) on a mid-range Android: keep sim plus draw under
  ~8 ms on desktop for headroom.
- No allocation in the hot path: pool particles, projectiles, and popups;
  reuse arrays; avoid per-frame closures and string building for the HUD.
- Pre-render static layers (backgrounds, tiles, text) to offscreen canvases
  and blit them. Batch by shared texture and state; avoid per-frame
  `shadowBlur`, `filter`, and full-screen blur passes on low-end devices.
- Canvas 2D starts dropping frames at hundreds of moving sprites; switch to
  a GPU 2D renderer then. For physics engines, enable sleeping, keep bodies in
  the tens to low hundreds, and remove off-screen debris.
- Stop the loop on run-over, pause, and hidden pages.

## Memory and teardown

- On unmount cancel the frame, disconnect the `ResizeObserver`, remove every
  listener, close or suspend audio, and destroy renderers. Under React Strict
  Mode effects run twice in development; guard async init with a `destroyed`
  flag so a late init does not leak.
- WebGL contexts are capped (~16 per page); leaked renderers blank the game
  after a few route visits. Dispose geometries, materials, and textures;
  on `webglcontextlost`, pause and rebuild.
- A 2× full-screen canvas on a tall phone is already several megapixels;
  size offscreen caches to what is drawn and release them on exit.
- Desktop emulation checks geometry only; label real-device results
  separately ([QA](../../qa/SKILL.md)).

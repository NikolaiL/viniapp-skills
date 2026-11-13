# Loop, input, and game feel

Read this when writing or repairing a real-time game's loop, controls, ramp,
feedback, or gameplay tests. Design rules live in [games](../SKILL.md).

## Fixed-step loop

Simulate at a fixed 30–60 Hz with an accumulator and draw every animation frame
interpolated by `alpha = acc / STEP`. A 30 Hz sim drawn without interpolation
judders on 60/120 Hz phones.

```ts
const STEP = 1000 / 30; let acc = 0, last = 0, prev = snapshot(state);
function frame(now: number) {
  const dt = last ? Math.min(now - last, 120) : 0; last = now; // clamp catch-up
  acc += dt * fx.timeScale;                    // 0 = hit-stop, 0.25 = slow-mo
  while (acc >= STEP && state.alive) { prev = snapshot(state); step(state, input); acc -= STEP; }
  draw(prev, state, Math.min(1, acc / STEP));  // lerp positions by alpha
  raf = requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { acc = 0; last = 0; /* and auto-pause */ }
});
```

- Clamp `dt` to ~120 ms and reset the time baseline when the page becomes
  hidden; a clamp alone still lets the first frame back push threats past the
  player. Pause the run on hide and require a tap to resume.
- Never `return` early from the frame callback before rescheduling it: a
  "dead" branch that returns kills the loop. Use a flag or a phase switch.
- Timers (power-ups, cooldowns, invulnerability) are counters decremented in
  `step`, not `setTimeout`, which fires after a restart and corrupts state.
- Keep engine state in refs or a plain module, read it through refs in the
  frame callback, and push HUD summaries to React at most ~5–16 times/s.
- Cap terminal velocity. If `maxSpeed * stepTime` can exceed the smallest
  hitbox dimension, sweep the AABB between the previous and current positions
  (record `prevX/prevY` before moving) instead of patching with rewinds.
  Shrink hitboxes 10–15 % from sprite bounds.

## Input

- One pointer-event path with `setPointerCapture`. Held controls set state on
  `pointerdown` and clear it on `pointerup`, `pointercancel`,
  `lostpointercapture`, window `blur`, and `visibilitychange`. Keys use
  `keydown`/`keyup` with `e.repeat` ignored. The loop reads the held state
  every step; never model movement as a series of taps.
- Input buffer ~100 ms: remember a press so a jump pressed just before it
  becomes legal still fires. Coyote time ~80 ms after leaving a ledge.
- Analog steer: `(x / width - 0.5) * 2` with a ~4 % dead zone, then ease-in.
- Swipe: commit at ~80 px (or a velocity threshold), otherwise snap back.
- To move items between cells, prefer tap-to-select then tap-to-place;
  cross-element touch drag is unreliable.
- Arm launch/confirm on a fresh down event in the current phase, consume it
  on release, and clear it on every phase change, so a finger held from the
  last level (or a late synthetic `click`) cannot start the next.
- Game buttons get instant state; a 200 ms CSS transition is input latency.
  Guard async start/retry buttons with a pending flag; refocus the stage
  after closing an overlay so keys work again.

## Difficulty as data

Keep the ramp in one table keyed by elapsed seconds or score (speed, spawn
density, pattern families, enemy mix), interpolate between rows, and show the
row index in a dev overlay. Start with a 5–10 s acclimatisation row, then a
visibly steeper curve. Step speed up with a "SPEED UP" flash and tone; a
multiplier creeping 1.0 → 1.1 reads as no change. The last row must not
plateau: keep tightening until a competent scripted pilot dies within about
twice the target session length (a common target is a 45–90 s median for a new
player).

Every threat is visible at least ~1.2 s before it can hit at top speed; assert
it from the table in a unit test. Spawn objects staggered across a depth band,
never one row at a time. Rotate pattern families (scatter, slalom, corridor,
gate run, breather) by weighted pick, never the same family three times
running, and test that every plan leaves a passable gap.

## Feel

Every player action and important event gets feedback within ~100 ms. Use at
least two of these on the primary hit/fail event:

| Effect | Values that work |
|---|---|
| Hit-stop | 40–60 ms hit, 80–120 ms kill; over 150 ms feels broken; keep drawing |
| Shake | `trauma += 0.4`, decay 1.5/s, offset `trauma² × 6–10 px`; move the camera, not the DOM |
| Scale punch | 1.0 → 1.25 → 1.0 over ~120 ms on score or hit object |
| Flash | 2–3 frames white, or a 60 ms tint |
| Particles | 8–20 per pickup, 30–60 on death, 0.3–0.6 s life, from a preallocated pool |
| Slow-mo | `timeScale 0.25` for 0.5–0.8 s on death |
| Sound / haptic | a short sound per event; a light haptic where the host offers one |

Near misses (passing within a small margin of a collision) earn a popup, a
chained multiplier, and a whoosh; they make dodging feel skilful.

Run over: hit-stop, shake and particles, slow-mo, then a results card within
~1.5 s total. Show what ended the run and the delta to best. One tap restarts
in under 300 ms with a fresh seed, cleared timers, held pointers, and pending
effects. Never cut straight from play to a static card.

## Fairness and score basics

No-input and held-one-direction runs must end well before an active player's,
typically within ~15–20 s. If one survives, the spawner has a hole
(edge-hugging, corner-camping): add walls reaching both edges and patterns
keyed to the player's lane. A threat-free grace period breaks this rule.

Write the engine as pure `create(seed)` plus `step(state, input)` with a seeded
RNG, so a run is reproducible from `(seed, inputs)`. That also lets a server
replay or bound a submitted run. Never trust a client-sent score: shared or
reward-bearing scores need the server-side rules in
[games](../SKILL.md#scores-and-purchases) and [security](../../security/SKILL.md).

## Verifying gameplay deterministically

Real-time input in a background or unfocused browser tab is unreliable:
`requestAnimationFrame` can be throttled heavily while `visibilityState` still
reports `visible`, so a "hold left for 3 s" script simulates almost nothing.
Test the simulation directly instead.

- Unit-test the engine: `replay` is deterministic and frame-rate independent;
  over 20 seeds no-input and held-direction runs die before the limit; a greedy
  perfect pilot dies before the run cap; each consumable acts exactly once.
- In the browser, expose a test-only hook, off in production:
  `window.__game = { step(n, input), state() }` advances `n` fixed steps
  synchronously with a held input; assert on state, then screenshot. A game
  that is a pure function of time (timing bars, rhythm) instead exposes the
  time until the next hit/miss window and tests tap at it with real input.
- Provide a URL flag (for example `?autostart=1&seed=7`) that boots straight
  into a seeded run, plus stable `data-testid`s on the stage, controls, score,
  run-over card, and retry button.
- The hook must not bypass auth, payments, or score validation. Finish with
  one short real-input pass in a focused window. See [QA](../../qa/SKILL.md).

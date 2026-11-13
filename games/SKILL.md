---
name: games
description: Design and verify complete mobile games with explicit mechanics, deterministic simulation, reliable held input, responsive rendering, feedback, progression, and honest score integrity.
license: MIT
---

# Games that actually play

For a substantial game, write a short `GAME_SPEC.md`: core loop, player verbs,
rules, difficulty progression, feedback, failure/retry, session length, and what
makes another run interesting. Study relevant references when genre details
are unclear; implement the requested depth without imposing an arbitrary
mechanic count on a deliberately simple game.

Choose the simplest fitting renderer: DOM/CSS for quizzes, cards and turn-based
grids; canvas for a real-time loop; an installed game/physics engine when its
capabilities are actually needed. Do not build a custom 3D engine for a 2D brief.

## Engine and input

- Use delta time or a fixed simulation step with bounded catch-up. Movement,
  collision, cooldowns, and difficulty must not depend on frame rate.
- Keep authoritative engine state out of per-frame React rerenders; bridge
  HUD updates at a lower rate. Frame callbacks must not read stale closures.
- Support held input and release/cancel/blur. Do not test a movement game only
  with isolated taps. Resize from the actual container and scale for DPR.
- During a run the game owns the screen. The stage is `position: fixed; inset: 0`
  at the full dynamic viewport height. App chrome (header, nav, side panels, footer) is hidden.
  The HUD and controls overlay the stage inside the safe-area insets. While
  playing, `html` and `body` get `overflow: hidden; overscroll-behavior: none`,
  so no tap or drag anywhere can scroll, bounce or pull the page. Pause,
  game-over and exit restore the normal page. A game card embedded in a
  scrolling page is a menu, not a play surface. Details:
  [canvas in webviews](references/canvas-in-webviews.md#stage-and-safe-areas).
- Keep pause, restart, game-over, inventory consumption, and score transitions
  explicit. Restart clears timers, held pointers, and pending round effects.
- Store difficulty/ramp data once and share relevant caps with server checks.
  Make threats legible with time to react; do not mistake unavoidable deaths
  for increased difficulty.
- Give hits, near misses, progress, purchases, and failure clear feedback.
  Respect reduced motion, audio consent, and browser audio activation rules.
- Use supplied/generated sprites when the brief asks for illustrated graphics;
  follow [media](../media/SKILL.md) for the art set, music loop and SFX. Verify
  the files, transparency, and runtime use rather than claiming an asset
  pipeline exists because placeholders were created.

## Scores and purchases

A local high score is device-local and may be tampered with. Label it honestly.
Ranked/shared/reward-bearing scores need authenticated server sessions and
server-computed or verifiable events; rate limits alone do not prove a score.
Handle mobile request jitter without accepting impossible runs or invalidating
every harmless reorder. Payments must never buy exemption from integrity checks.

Verify paid continues/items through real settlement before applying them, with
idempotent claims. Every offered upgrade must affect the engine, and the engine
must consume it according to the displayed rules. Read
[wallets](../wallets/SKILL.md) and [data](../data/SKILL.md) when applicable.

## Playability evidence

Run at least no-input, held-one-direction, and delayed-input cases. Compare
simulation outcomes at different frame rates. In a browser exercise start,
several seconds of live play, game-over, and restart, including held controls.
At a phone viewport, during a run, check that
`document.scrollingElement.scrollHeight <= innerHeight` and that `scrollY`
stays 0 after taps and drags on the HUD, the controls and the stage.
Capture in-play frames before game-over and assess motion, readability, input
response, and difficulty. A title screen screenshot or a passing build is not
gameplay evidence. Keep test hooks deterministic and free of production auth or
reward bypasses. See [mobile](../mobile/SKILL.md) and [QA](../qa/SKILL.md).

## References

| Reference | Read when |
| --- | --- |
| [Loop, input and feel](references/loop-input-and-feel.md) | Writing or repairing a real-time loop, controls, difficulty ramp, feedback, or gameplay tests |
| [Canvas in webviews](references/canvas-in-webviews.md) | A canvas/WebGL game runs in a phone browser or embedded host |

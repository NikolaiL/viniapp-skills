---
name: mobile
description: Build and verify mobile and embedded layouts with safe areas, reachable CTAs, responsive canvas sizing, and reliable touch input.
license: MIT
---

# Mobile and embedded layout

Export viewport metadata with `width: "device-width"`, `initialScale: 1`, and
`viewportFit: "cover"`. Paint HTML, body, and the shell with the app background.
Use `min-height: 100svh` for a shell affected by browser/host chrome.

Define `--safe-area-inset-top`, `right`, `bottom`, and `left` on `:root`, using
`env(safe-area-inset-*, 0px)` defaults. Components consume these variables.
An embedded-host adapter may raise each to `max(env(...), <host inset>px)`;
keep SDK reads in that adapter rather than spreading them across components.

## Navigation and content

If the app needs fixed bottom navigation, use an outer safe-area-padded footer
plus an inner 56–64px action row. Do not add a footer just to satisfy this guide. Reserve
the measured footer height plus at least 12px for scroll content. Check actual
element bounds: at the initial scroll position the primary action must end at
least 8px above the fixed footer when one exists. End-of-page padding does not prove this.

Test 320px width, 375×760, a typical taller phone, and desktop. No horizontal
overflow or clipped labels, and dense grids (calendars, heatmaps) must not
shrink cells below a readable/tappable size to fit; keyboard opening must not trap the primary input.
Provide a desktop layout when requested. If explicitly mobile-only, gate the
shell once and verify the wider-screen message instead of hiding random parts.

## Canvas and touch

- Size a canvas from its container, preserve its aspect ratio, and scale its
  backing buffer for device pixel ratio. Avoid layout shift when panels change.
- Suppress browser gestures only on the interactive playfield, not the whole
  page. Use one pointer-event path, pointer capture where useful, and clear held
  input on `pointercancel`, blur, and visibility changes.
- Handle simultaneous touches when the game requires them. Avoid triggering
  one action from both `pointerup` and a synthetic `click`.
- Keep controls away from host edges and above the bridged bottom inset.

Desktop Chromium emulation verifies geometry, not the real host bridge or a
mobile wallet. Label host/device coverage separately; read
[miniapps](../miniapps/SKILL.md) for host integration.

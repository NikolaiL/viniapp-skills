---
name: design
description: Establish an app's visual identity, navigation, accessible interaction states, and asset consistency before building its UI.
license: MIT
---

# Design a usable app

Start from the brief and any supplied logo, cover, splash, palette, or reference.
Inspect them before choosing colors or generating replacements. Describe the
palette, typography, spacing, navigation, and main action briefly; for a large
redesign keep that decision in `DESIGN_SPEC.md`.

- Make the main action discoverable on the first screen. Use real routes for
  distinct navigable sections; do not put an entire multi-route app in a giant
  conditional component. Do not add sections to satisfy a screen quota.
- Define semantic foreground/background/action/error tokens in global CSS.
  Apply the chosen theme consistently to HTML, providers, and components; a
  single-theme app needs no nonfunctional theme toggle.
- Use readable contrast, visible keyboard focus, labels, 16px mobile inputs,
  and at least 44px touch targets. No hover-only functionality.
- Specify loading, empty, error, success, disabled, and pending states for each
  async flow. An empty dataset and an unavailable service are different states.
- Guard async actions against duplicate submits. Give an immediate pending
  state and restore controls after cancellation or failure.
- Reuse the app's existing primitives. Check that a CSS utility/component
  library is actually installed; a familiar class name proves nothing.
- For overlays, use the existing accessible dialog primitive or implement
  focus management, Escape, focus restoration, and background isolation. Ensure
  overlays escape clipping/stacking contexts, using a portal when needed.
- Use the app's own name, favicon, and metadata. Asset filenames, metadata,
  splash, share image, and visible palette must agree. Preserve upstream license
  notices even when replacing template product branding.
- Prefer bundled fonts or system fonts when remote font downloads would make
  builds or first render unreliable. Do not invent third-party assets or claim
  generated imagery exists before checking the files; see [media](../media/SKILL.md).
- Decoration (ribbons, glows, stickers) never crosses headline or body text;
  check it in the phone screenshot.

Read [mobile](../mobile/SKILL.md) for layout and
[QA](../qa/SKILL.md) for interaction checks. Match the requested design depth;
avoid turning ordinary UI work into a required branding ceremony.

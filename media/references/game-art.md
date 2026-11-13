# Game art that looks finished

A polished 2D webview game comes from a consistent asset set, motion, light and
feedback, not from one impressive background. Work in this order and stop at
the depth the brief asks for.

## Asset set

| Layer | Typical assets | Format |
| --- | --- | --- |
| Key art | One in-world scene (3:2 or 9:16) setting the style; title screen and share source | WebP, opaque |
| World | Far/mid/near background layers for parallax; tiles or arena | WebP, opaque (far), PNG cutout (near) |
| Actors | Player, enemies/obstacles, bosses; one pose each unless frames are needed | PNG cutout, ~2× display size |
| Pickups and projectiles | Coins, power-ups, bullets, bricks | PNG cutout, small |
| UI chrome | Optional panel/button textures; HUD text stays live text | PNG/CSS |
| Effects | Particles, glows, trails, flashes | Drawn in code, not images |

Generate actors and pickups with the key art as `--ref` and the same camera
angle and light direction. Name the subject's silhouette and palette roles in
the prompt (player warm and bright, threats saturated red/orange, background
cool and lower contrast) so threats stay readable at a glance.

Size budget: about 2–3 MB total before first play on mobile. Backgrounds about
1080 px wide WebP quality 0.8; sprites rarely above 256 px. Preload images and
decode them before the run starts; never load inside the frame loop.

## Motion without frame sheets

Most sprites need only transforms: squash and stretch on bounce/land, idle bob,
tilt toward velocity, scale pop on spawn/collect, spin for pickups. Use
multi-frame animation only where the brief needs it (walk cycles, character
expressions). Generate each frame with the previous one as `--ref`, then check
that frames share size and anchor before packing.

## Light, depth and feedback

- Parallax: layers scroll at different speeds; near layer darker or blurred.
- Glow: draw highlights and projectiles with `globalCompositeOperation = "lighter"`
  and a soft radial gradient; a cheap substitute for bloom.
- Shadow: a soft ellipse under each actor anchors it to the ground plane.
- Particles: pooled; bursts on hit, collect and death; tinted from the palette.
- Impact: 40–80 ms hit-stop, a white flash on the hit sprite, decaying screen
  shake (off when `prefers-reduced-motion`), and a sound for each.
- Camera: lerped follow and slight look-ahead in scrolling games.
- Transitions: eased title → play → game-over, with the score counting up.
- Typography: one display font for titles/score, the UI font elsewhere; HUD
  text with contrast or a scrim over busy art.

Keep 60 fps on a mid-range phone: cap particles, avoid per-frame `filter`/
`shadowBlur` on many objects, and cache static layers to offscreen canvases.

## Screenshot review

Capture at 375×667 and desktop: title, early play, a busy moment (many actors
and effects), a hit, and game over. Look at each image and check:

- One coherent style: no sprite with a different outline, light direction or
  rendering medium; no stretched, blurry or pixelated images.
- Cutouts clean over the real background: no halo, chroma fringe or box.
- Player, threats and pickups distinguishable in a glance and in grayscale.
- HUD readable and clear of notches and host chrome; no baked-in text.
- The busy moment still reads; effects don't hide threats.

Fix the three worst issues and capture again. Report honestly what was
generated, what was drawn in code, and what was not checked on a real device.

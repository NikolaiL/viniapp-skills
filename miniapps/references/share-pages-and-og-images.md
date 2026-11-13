# Share pages and OG images

Read when shared links need a per-item preview (score, profile, result) on Farcaster, X, or chat apps.

## Share page

One public route per shareable entity, e.g. `/share/[id]?v=<version>`.

- Render real HTML for the entity with `generateMetadata` (or a `layout.tsx` beside an existing client page). Never server-`redirect()`: crawlers follow it and read the destination's tags. If browsers must land elsewhere, redirect client-side after render.
- Reference entities by ID or index, never by full content in the query string. Embed URLs are capped at 1024 characters.
- Show only public-safe fields. No wallet health, payouts, admin state, or private data in the page, its metadata, or its image.
- Use one configured public origin; every tag URL is absolute.
- Next.js streams `generateMetadata` output into `<body>` for user agents not on its
  HTML-limited bot list, and social crawlers read `<head>`. For share pages, set
  `htmlLimitedBots: /.*/` in `next.config` (or a regex covering the crawlers you
  target), then check with `curl -A <crawler UA>` that the tags are in `<head>`.
  See [generateMetadata: streaming metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#streaming-metadata).

## Two image targets

| Consumer | Tag | Size |
| --- | --- | --- |
| Farcaster embed | `fc:miniapp` `imageUrl` | 3:2, 600×400 to 3000×2000, < 10 MB |
| X / Open Graph | `twitter:image`, `og:image` | 2:1, e.g. 1200×600, `summary_large_image` |

Serve separate `.png` URLs; a 2:1 or 1200×630 image is cropped in a Farcaster embed. A Next.js `opengraph-image` file still emits `og:image`, so set `twitter:image` explicitly.

```ts
other: { "fc:miniapp": JSON.stringify({
  version: "1",
  imageUrl: fcImage,                       // ≤ 1024 chars, 3:2
  button: {
    title: clip(label, 32),                // ≤ 32 chars
    action: { type: "launch_miniapp", name: clip(appName, 32),
      url: pageUrl,                        // ≤ 1024 chars, deep link
      splashImageUrl, splashBackgroundColor } } }) },
twitter: { card: "summary_large_image", images: [{ url: xImage, width: 1200, height: 600 }] },
```

Embeds over limits fail silently; truncate dynamic names, reject long URLs. Splash images are 200×200. The docs also recommend an `fc:frame` tag (same JSON, `type: "launch_frame"`) for older clients. Verify against https://miniapps.farcaster.xyz/docs/guides/sharing and https://miniapps.farcaster.xyz/docs/specification.

## Dynamic PNG route

Use `ImageResponse` from `next/og` (Satori + resvg) or Satori directly. Docs: https://nextjs.org/docs/app/api-reference/functions/image-response and https://github.com/vercel/satori.

- Name the file `route.tsx`. JSX in `.ts` causes misleading parse errors. Use `runtime = "nodejs"` when you read fonts or files from disk.
- Route handlers must not export `contentType`. Only metadata files like `opengraph-image.tsx` do.
- Write inline styles with flexbox only: no classes, Tailwind, or grid. Any element with more than one child needs an explicit `display`. Without it the build passes and the fetch fails.
- Fonts must be TTF, OTF, or WOFF (TTF/OTF parse faster). WOFF2 throws `Unsupported OpenType signature wOF2`. Bundle them (500 KB total limit) and pass `fonts`; avoid variable fonts. The built-in font has one weight, so `fontWeight: 700` renders regular until you pass a bold file (for example `@fontsource/<font>/files/<font>-latin-700-normal.woff` read from `node_modules`).
- `next/og` fetches Twemoji at render time; raw Satori has none. Strip emoji if unsure.
- JSX text is escaped; do not strip `<`, `>`, `~` from user text.
- For assets in `/public` of the same build, derive the origin from `request.url`. A canonical production origin can fetch the previous deployment's art.
- A route-level `loading.tsx` streams the page, so its status is 200 before `notFound()` runs. Keep `loading.tsx` off share routes (or validate the ID above the Suspense boundary) so invalid links return a real 404.

Fetch remote images (avatars, art) defensively:

```ts
const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
const type = res.headers.get("content-type")?.split(";")[0] ?? "";
if (!res.ok || !ALLOWED_TYPES.includes(type)) return null;  // then draw initials
// read with a byte cap (~5 MB), then normalize:
return sharp(buf, { limitInputPixels: 20e6 }).resize(128, 128).png().toBuffer();
```

- Allowlist image hosts; fetching arbitrary user URLs is SSRF ([security](../../security/SKILL.md)).
- Convert to PNG first; WebP can pass the build and fail in the renderer.
- Keep data URIs ≲100 KB. Satori silently drops large ones (~250 KB+) and renders only the background.
- If data or a nested image fails, return a 200 generic card with a very short or zero max-age. 404 only for invalid input.
- No per-entity text? Use static PNG.

## Caching and cache busting

- Crawlers and CDNs cache previews by exact URL, often for a long time.
- Set `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600` or similar. Never use `revalidate = 0` (slow, crawler timeouts). For immutable results, cache permanently.
- Next.js `opengraph-image` routes default to a long immutable cache. Override it in `headers()` for dynamic images.
- Add a version key to each new share, such as `ts=<ms>` or a content hash. Carry the same key into the canonical URL, `og:url`, the `fc:miniapp` URLs, and both image URLs. Pages without the key must still work.
- Keep the query parameter order stable. `?a=1&b=2` and `?b=2&a=1` are different cache keys.
- Version static share PNGs (filename or `?v=<commit>`) when artwork changes.

## Share intents

Route every Share button, footer included, through one `share({ text, url, target })` helper.

| Target | Call |
| --- | --- |
| Farcaster host (confirmed) | `sdk.actions.composeCast({ text, embeds: [url] })` |
| Farcaster on web | `https://farcaster.xyz/~/compose?text=…&embeds[]=<url>` (undocumented; test) |
| X | `https://x.com/intent/post?text=…&url=<url>` |
| Copy link | `navigator.clipboard.writeText(url)` |
| Web Share | `navigator.share({ text, url })` |

- Call `composeCast` only when the host is confirmed as Farcaster ([miniapps](../SKILL.md)). Embeds are URL strings, at most 2, with the share URL first. A null `result.cast` means the user cancelled. Check current behavior: https://miniapps.farcaster.xyz/docs/sdk/actions/compose-cast.
- Keep the URL out of the text when it is in `embeds`, or it may embed twice.
- Build intent URLs with `URLSearchParams` and open them with `window.open(u, "_blank", "noopener,noreferrer")`.
- A Web Share `AbortError` means the user cancelled. Stop there and do not chain into another share. Use a fallback only when the API is missing or fails another way. Spec: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share.
- If the clipboard is denied, show the URL for manual copy.
- Keep share text short; omit zero scores.
- Never post without a user action.

## Verify

```bash
curl -sI "$ORIGIN/share/42?v=1"                    # 200, not 3xx
curl -s  "$ORIGIN/share/42?v=1" | grep -oE '<meta (name|property)="(fc:miniapp|og:image|twitter:[a-z]+)"[^>]*>'
curl -s  "$FC_IMAGE" -o /tmp/fc.png && file /tmp/fc.png   # PNG image data, 1200 x 800
curl -sI "$FC_IMAGE" | grep -i -E 'content-type|cache-control'
```

- Parse the `fc:miniapp` JSON. Check the field lengths, that every URL is absolute and ≤ 1024 characters, and that the launch URL opens the same entity.
- Decode each image, check dimensions, and look at it: a valid 200 PNG can still be blank, missing art, in a fallback font, or show another entity. Test long names, a missing avatar, an unknown ID.
- Feeds show the card about 500 px wide. Fill the frame: the headline number or question at least 8% of the image height, content spread over the whole card, no empty half. View it downscaled to 500 px before accepting it.
- Fetch twice for caching; a new version key must change both image URLs.
- Crawlers cannot fetch `localhost`. Final checks need a public deployment or tunnel, Farcaster's embed preview tool, and a real draft post on X. Record any unchecked step as a prerequisite; see [qa](../../qa/SKILL.md).

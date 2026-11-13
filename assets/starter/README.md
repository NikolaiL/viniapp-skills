# App starter

Next.js App Router, React, TypeScript, CSS and Playwright. Requires Node.js
22.11+ and npm. The exact dependency versions are recorded in package.json
and package-lock.json. No provider account, database, wallet or host SDK is
required to launch this starter.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Replace the starter screen, product metadata, icon,
and smoke assertion with the requested app. This counter is not a finished
product or a persistence demonstration.

```sh
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production server on port 3100 and tests mobile and
desktop, so run `npm run build` first; it does not rebuild. Unit tests for pure
logic can use Node's runner without a framework: `node --test tests/*.test.ts`. Install Chromium once per machine. Add tests for the actual product's
success and failure paths; the template test proves only the starter works.
If port 3100 is occupied, choose an unused port through `PLAYWRIGHT_PORT` in the
test process environment; never terminate an unrelated existing service.
For manual production serving, run `npm run start` after `npm run build`.
Select the deployment environment yourself; no deployment service is configured.

Optional environment: `NEXT_PUBLIC_APP_URL` is a public canonical origin for
features that need absolute URLs. Ordinary local use needs no environment file.
Document each new variable's purpose and whether it is required. Never overwrite
an existing environment file or put secrets in public variables.

For an embedded miniapp, follow the pack's miniapps topic and optional provider
asset; add and lock the SDK only then. For shared data, implement a real server
database and authenticated routes. This starter does not pretend either exists.

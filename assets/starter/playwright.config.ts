import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT || "3100";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error("PLAYWRIGHT_PORT must be a port number from 1 to 65535.");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts", // browser tests; keep Node unit tests as *.test.ts
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

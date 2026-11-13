import { expect, test } from "@playwright/test";

test("starter interaction and health work without runtime errors or API failures", async ({ page, request, baseURL }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === baseURL && url.pathname.startsWith("/api/") && response.status() >= 500) {
      errors.push(`API ${response.status()} ${url.pathname}`);
    }
  });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await page.getByRole("button", { name: "Test interaction" }).click();
  await expect(page.getByRole("status")).toHaveText("Interactions: 1");
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

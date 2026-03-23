import { expect, test } from "@playwright/test";

test.describe("Auth flow", () => {
  test("unauthenticated /dashboard redirects to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/auth/sign-in**");
    expect(page.url()).toContain("/auth/sign-in");
  });

  test("unauthenticated /settings redirects to sign-in", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL("**/auth/sign-in**");
    expect(page.url()).toContain("/auth/sign-in");
  });

  test("all protected routes redirect when unauthenticated", async ({
    page,
  }) => {
    const protectedPaths = [
      "/dashboard",
      "/improve",
      "/train",
      "/plan",
      "/perform",
      "/enhance",
      "/collect",
      "/settings",
      "/admin",
    ];

    for (const path of protectedPaths) {
      await page.goto(path);
      await page.waitForURL("**/auth/sign-in**");
      expect(page.url()).toContain("/auth/sign-in");
    }
  });

  test("auth sign-in page loads correctly", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.locator("main#main-content")).toBeVisible();
  });
});

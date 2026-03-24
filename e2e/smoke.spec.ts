import { expect, test } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("landing page loads with tagline", async ({ page }) => {
    // Use locale-prefixed URL; bare "/" 302-redirects to /en
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(
      "Train. Plan. Perform. Elevate your magic."
    );
  });

  test("FAQ page loads", async ({ page }) => {
    await page.goto("/en/faq");
    await expect(
      page.getByRole("heading", { name: "Frequently Asked Questions" })
    ).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/en/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" })
    ).toBeVisible();
  });

  test("unauthenticated /dashboard redirects to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/auth/sign-in**");
    expect(page.url()).toContain("/auth/sign-in");
  });

  test("auth sign-in page renders", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await page.locator("main#main-content").waitFor({ state: "attached" });
  });
});

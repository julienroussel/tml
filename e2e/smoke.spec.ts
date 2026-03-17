import { expect, test } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("landing page loads with tagline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();
    await expect(
      page.getByText("Train. Plan. Perform. Elevate your magic.")
    ).toBeVisible();
  });

  test("FAQ page loads", async ({ page }) => {
    await page.goto("/faq");
    await expect(
      page.getByRole("heading", { name: "Frequently Asked Questions" })
    ).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
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
    await expect(page.locator("main#main-content")).toBeVisible();
  });
});

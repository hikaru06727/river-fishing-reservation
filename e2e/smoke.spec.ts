import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("トップページが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "川釣り予約サービス" })).toBeVisible();
  });

  test("/login が表示される", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });

  test("未ログインで /my/reservations にアクセスすると /login にリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/my/reservations");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });
});

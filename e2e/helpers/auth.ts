import type { Page } from "@playwright/test";
import type { E2EFixtures } from "../fixtures";

/**
 * Magic Link のメール受信を経由せず、テスト専用API (/api/test/login) で
 * カスタマーユーザーとしてログインする。page.request は page と Cookie を
 * 共有するため、この後の page.goto() はログイン済み状態になる。
 */
export async function loginAsTestUser(page: Page, fixtures: E2EFixtures): Promise<void> {
  const response = await page.request.post("/api/test/login", {
    headers: { "x-e2e-test-secret": fixtures.testLoginSecret },
    data: { email: fixtures.testUserEmail },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`[loginAsTestUser] failed (${response.status()}): ${body}`);
  }
}

export async function loginAsAdmin(page: Page, fixtures: E2EFixtures): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("メールアドレス").fill(fixtures.adminEmail);
  await page.getByLabel("パスワード").fill(fixtures.adminPassword);
  await page.getByRole("button", { name: "ログイン" }).click();

  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"), {
    timeout: 15_000,
  });
}

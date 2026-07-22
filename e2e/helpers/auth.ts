import type { Page } from "@playwright/test";
import type { E2EFixtures } from "../fixtures";

/**
 * メール受信を経由せず、テスト専用API (/api/test/login) でカスタマーユーザー
 * としてログインする。page.request は page と Cookie を共有するため、
 * この後の page.goto() はログイン済み状態になる。
 *
 * options.type="recovery" を指定すると、パスワード再設定リンクをクリックした
 * 直後と同じ状態（/login/reset/confirm でパスワード変更可能な状態）になる。
 */
export async function loginAsTestUser(
  page: Page,
  fixtures: E2EFixtures,
  options?: { email?: string; type?: "magiclink" | "recovery" },
): Promise<void> {
  const response = await page.request.post("/api/test/login", {
    headers: { "x-e2e-test-secret": fixtures.testLoginSecret },
    data: {
      email: options?.email ?? fixtures.testUserEmail,
      type: options?.type ?? "magiclink",
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`[loginAsTestUser] failed (${response.status()}): ${body}`);
  }
}

/**
 * 既存セッションが残っている場合、UIのログアウトボタン（src/components/layout/LogoutButton.tsx、
 * logout() サーバーアクション）経由で明示的にログアウトする。/login・/signup は
 * middleware.ts が「ログイン済みなら弾く」仕様のため、別アカウントへ切り替える際は
 * 実際のユーザーと同じくログアウトを経由する必要がある。
 */
async function logoutIfLoggedIn(page: Page): Promise<void> {
  await page.goto("/");
  const logoutButton = page.getByRole("button", { name: "ログアウト" }).first();
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL("/", { timeout: 10_000 });
  }
}

export async function loginAsAdmin(page: Page, fixtures: E2EFixtures): Promise<void> {
  await logoutIfLoggedIn(page);
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(fixtures.adminEmail);
  await page.getByLabel("パスワード").fill(fixtures.adminPassword);
  await page.getByRole("button", { name: "ログイン" }).click();

  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

import { test, expect } from "@playwright/test";
import { getE2EFixtures } from "./fixtures";
import { loginAsTestUser } from "./helpers/auth";
import { createCashReservation, getShopSlugForReservation } from "./helpers/reservation";
import {
  waitFor,
  createConfirmedTestUser,
  deleteTestUser,
  getAuthUserEmailConfirmedAt,
  getProfileByEmail,
  findBusinessIdForSpot,
  insertOnlineOrderForUser,
  getOnlineOrderById,
} from "./helpers/db";

/**
 * Phase 20: 顧客アカウント機能（メール+パスワード認証・注文履歴・チェックアウト自動入力）の E2E 検証。
 *
 * パスワード認証の signUp/login 自体は実メール受信を経由しないと完了しないため、
 * /api/test/login（type=magiclink|recovery）または service_role の
 * auth.admin.createUser() でメール送信をバイパスする（既存の /api/test/login と同じ方針）。
 */

async function selectFirstAvailablePickupDate(page: import("@playwright/test").Page): Promise<void> {
  const input = page.locator("#pickupDate");
  const min = await input.getAttribute("min");
  expect(min, "pickupDate の min 属性が取得できません").toBeTruthy();
  await input.fill(min!);
}

test.describe("パスワード認証（Phase 20）", () => {
  test("新規発行の確認済みアカウントでパスワードログインできる", async ({ page }) => {
    const email = `e2e-login-${Date.now()}@example.com`;
    const password = "e2e-test-password-1";
    let userId = "";

    try {
      await test.step("service_role で確認済みアカウントを作成する", async () => {
        userId = await createConfirmedTestUser(email, password);
      });

      await test.step("/login からパスワードでログインする", async () => {
        await page.goto("/login");
        await page.getByLabel("メールアドレス").fill(email);
        await page.getByLabel("パスワード").fill(password);
        await page.getByRole("button", { name: "ログイン" }).click();
        await page.waitForURL(/\/my\/reservations/, { timeout: 15_000 });
      });
    } finally {
      if (userId) await deleteTestUser(userId);
    }
  });

  test("パスワード未設定の既存アカウントでログイン失敗時、エラーと再設定導線が表示される", async ({ page }) => {
    const fixtures = getE2EFixtures();

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(fixtures.testUserEmail);
    await page.getByLabel("パスワード").fill("wrong-password-12345");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page.locator('p[role="alert"]')).toContainText("パスワードをお忘れの方", {
      timeout: 10_000,
    });
    await expect(page.getByRole("link", { name: "こちら" })).toBeVisible();
  });

  test("新規登録すると確認メール送信ページに遷移し、未確認ユーザーが作成される", async ({ page }) => {
    // Supabase の signUp() は example.com/example.org 等の予約ドメインを
    // 「無効なメールアドレス」として拒否するため、他の E2E フィクスチャとは
    // 異なるドメインを使う（生成済みアカウントの直接ログインは example.com で問題ない）。
    const email = `e2e-signup-${Date.now()}@e2e-test-mail.com`;
    const password = "e2e-test-password-2";
    let userId = "";

    try {
      await test.step("/signup から登録する", async () => {
        await page.goto("/signup");
        await page.getByLabel("メールアドレス").fill(email);
        await page.getByLabel("パスワード", { exact: true }).fill(password);
        await page.getByLabel("パスワード（確認）").fill(password);
        await page.getByRole("button", { name: "登録する" }).click();
        await page.waitForURL(/\/login\/sent/, { timeout: 15_000 });
        await expect(page.getByText(email)).toBeVisible();
      });

      await test.step("profiles に未確認ユーザーが作成されている", async () => {
        const profile = await waitFor(() => getProfileByEmail(email), {
          description: "signup 後に profiles レコードが作成される",
        });
        userId = profile.id;

        const confirmedAt = await getAuthUserEmailConfirmedAt(userId);
        expect(confirmedAt, "確認メール未クリックの時点で email_confirmed_at が null であるべき").toBeNull();
      });
    } finally {
      if (userId) await deleteTestUser(userId);
    }
  });

  test("パスワード再設定リンク経由で新しいパスワードを設定し、新パスワードでログインできる", async ({
    page,
  }) => {
    const email = `e2e-reset-${Date.now()}@example.com`;
    const oldPassword = "e2e-old-password-1";
    const newPassword = "e2e-new-password-1";
    let userId = "";

    try {
      await test.step("service_role で確認済みアカウントを作成する", async () => {
        userId = await createConfirmedTestUser(email, oldPassword);
      });

      await test.step("recovery セッションを発行し /login/reset/confirm でパスワードを変更する", async () => {
        const fixtures = getE2EFixtures();
        await loginAsTestUser(page, fixtures, { email, type: "recovery" });

        await page.goto("/login/reset/confirm");
        await page.getByLabel("新しいパスワード", { exact: true }).fill(newPassword);
        await page.getByLabel("新しいパスワード（確認）").fill(newPassword);
        await page.getByRole("button", { name: "パスワードを設定する" }).click();
        await page.waitForURL(/\/my\/reservations/, { timeout: 15_000 });
      });

      await test.step("ログアウトし、新しいパスワードでログインできる", async () => {
        await page.goto("/");
        await page.getByRole("button", { name: "ログアウト" }).first().click();
        await page.waitForURL((url) => !url.pathname.startsWith("/my"), { timeout: 10_000 });

        await page.goto("/login");
        await page.getByLabel("メールアドレス").fill(email);
        await page.getByLabel("パスワード").fill(newPassword);
        await page.getByRole("button", { name: "ログイン" }).click();
        await page.waitForURL(/\/my\/reservations/, { timeout: 15_000 });
      });
    } finally {
      if (userId) await deleteTestUser(userId);
    }
  });
});

test.describe("マイ注文（Phase 20）", () => {
  test.setTimeout(3 * 60 * 1000);

  test("自分の注文は一覧・詳細に表示され、他人の注文には404になる", async ({ page }) => {
    const fixtures = getE2EFixtures();
    let orderId = "";
    let otherUserId = "";
    let otherOrderId = "";

    await test.step("ログインして店舗受け取りで注文する", async () => {
      const reservationId = await createCashReservation(page, fixtures);
      const shopSlug = await getShopSlugForReservation(page, reservationId);

      await page.goto(`/shop/${shopSlug}/products`);
      const productLink = page.locator(`a[href^="/shop/${shopSlug}/products/"]`).first();
      await productLink.click();
      await page.getByRole("button", { name: /カートに追加|在庫切れ/ }).click();
      await page.getByRole("link", { name: "カート" }).click();
      await page.waitForURL(new RegExp(`/shop/${shopSlug}/checkout`), { timeout: 10_000 });

      await page.getByLabel("氏名").fill("E2E マイ注文太郎");
      await page.getByLabel("メールアドレス").fill(fixtures.testUserEmail);
      await selectFirstAvailablePickupDate(page);
      await page.locator("#pickupTime").selectOption({ index: 1 });

      await page.getByRole("button", { name: "注文を確定する" }).click();
      await page.waitForURL(/order-complete/, { timeout: 15_000 });

      const match = page.url().match(/order_id=([^&]+)/);
      if (!match) throw new Error(`order_id が URL から取得できません: ${page.url()}`);
      orderId = match[1]!;
    });

    await test.step("マイ注文一覧に表示される", async () => {
      await page.goto("/my/orders");
      await expect(page.getByRole("link", { name: "詳細を見る" }).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.goto(`/my/orders/${orderId}`);
      await expect(page.getByText(orderId)).toBeVisible({ timeout: 10_000 });
    });

    try {
      await test.step("他人の注文には404になる（RLS）", async () => {
        otherUserId = await createConfirmedTestUser(
          `e2e-other-${Date.now()}@example.com`,
          "e2e-other-password-1",
        );
        const businessId = await findBusinessIdForSpot(fixtures.spotId);
        otherOrderId = await insertOnlineOrderForUser(otherUserId, businessId);

        const response = await page.goto(`/my/orders/${otherOrderId}`);
        expect(response?.status()).toBe(404);
      });
    } finally {
      if (otherUserId) await deleteTestUser(otherUserId);
    }
  });
});

test.describe("チェックアウトの住所保存チェックボックス（Phase 20）", () => {
  test.setTimeout(3 * 60 * 1000);

  test("ONで次回自動入力される／OFFでは保存されない", async ({ page }) => {
    const fixtures = getE2EFixtures();

    const reservationId = await createCashReservation(page, fixtures);
    const shopSlug = await getShopSlugForReservation(page, reservationId);

    const phoneWhenUnchecked = `090-0000-${Date.now().toString().slice(-4)}`;
    const phoneWhenChecked = `090-1111-${Date.now().toString().slice(-4)}`;

    async function checkoutOnce(phone: string, save: boolean) {
      await page.goto(`/shop/${shopSlug}/products`);
      const productLink = page.locator(`a[href^="/shop/${shopSlug}/products/"]`).first();
      await productLink.click();
      await page.getByRole("button", { name: /カートに追加|在庫切れ/ }).click();
      await page.getByRole("link", { name: "カート" }).click();
      await page.waitForURL(new RegExp(`/shop/${shopSlug}/checkout`), { timeout: 10_000 });

      await page.getByLabel("氏名").fill("E2E 住所保存太郎");
      await page.getByLabel("メールアドレス").fill(fixtures.testUserEmail);
      await page.getByLabel("電話番号").fill(phone);

      const saveCheckbox = page.getByRole("checkbox", { name: /この住所を今後のために保存する/ });
      await expect(saveCheckbox, "ログイン済みなら保存チェックボックスが表示される").toBeVisible({
        timeout: 10_000,
      });
      // デフォルトON前提の検証（要件どおりデフォルトONであることも兼ねて確認）
      expect(await saveCheckbox.isChecked()).toBe(true);
      if (!save) {
        await saveCheckbox.uncheck();
      }

      await selectFirstAvailablePickupDate(page);
      await page.locator("#pickupTime").selectOption({ index: 1 });
      await page.getByRole("button", { name: "注文を確定する" }).click();
      await page.waitForURL(/order-complete/, { timeout: 15_000 });
    }

    await test.step("チェックを外して注文する→保存されない", async () => {
      await checkoutOnce(phoneWhenUnchecked, false);

      const profile = await waitFor(() => getProfileByEmail(fixtures.testUserEmail), {
        description: "注文完了後に profiles レコードが取得できる",
      });
      expect(profile.phone).not.toBe(phoneWhenUnchecked);
    });

    await test.step("チェックしたまま注文する→保存される", async () => {
      await checkoutOnce(phoneWhenChecked, true);

      await waitFor(
        async () => {
          const profile = await getProfileByEmail(fixtures.testUserEmail);
          return profile?.phone === phoneWhenChecked ? profile : null;
        },
        { description: "チェックON時に profiles.phone が更新される" },
      );
    });

    await test.step("次回チェックアウトで自動入力される", async () => {
      await page.goto(`/shop/${shopSlug}/products`);
      const productLink = page.locator(`a[href^="/shop/${shopSlug}/products/"]`).first();
      await productLink.click();
      await page.getByRole("button", { name: /カートに追加|在庫切れ/ }).click();
      await page.getByRole("link", { name: "カート" }).click();
      await page.waitForURL(new RegExp(`/shop/${shopSlug}/checkout`), { timeout: 10_000 });

      await expect(page.getByLabel("電話番号")).toHaveValue(phoneWhenChecked, { timeout: 10_000 });
    });
  });
});

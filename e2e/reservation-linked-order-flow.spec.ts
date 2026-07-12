import { test, expect, type Page } from "@playwright/test";
import { getE2EFixtures, type E2EFixtures } from "./fixtures";
import { loginAsTestUser, loginAsAdmin } from "./helpers/auth";
import { payWithStripeTestCard } from "./helpers/checkout";
import {
  waitFor,
  getOnlineOrderById,
  getOnlineOrdersByLinkedReservationId,
  getSaleRefundsByOnlineOrderId,
  markOnlineOrderPaidForTest,
} from "./helpers/db";

/**
 * Phase 19E: 予約後の追加購入（別会計の online_orders を予約に紐づける）の E2E 検証。
 *
 * 前提: E2E_SPOT_ID の事業に、公開済み・在庫ありの商品が最低1件必要（既存の
 * shop フロー用フィクスチャと共用。E2E_PRODUCT_ID である必要はない。配送
 * シナリオ用には shippable=true の商品が必要）。
 */
async function createCashReservation(page: Page, fixtures: E2EFixtures): Promise<string> {
  await loginAsTestUser(page, fixtures);
  await page.goto(`/reserve/${fixtures.spotId}?plan=${fixtures.planSlug}`);
  await page.locator("#reservationDate").waitFor({ state: "attached", timeout: 30_000 });

  const dateOptionValues = (
    await page.locator("#reservationDate option").evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    )
  ).slice(2);
  let foundSlot = false;
  for (const dateValue of dateOptionValues) {
    await page.locator("#reservationDate").selectOption(dateValue);
    const slotSelect = page.locator("#slotId");
    const noSlotMessage = page.getByText("この日は空き枠がありません", { exact: true });
    await Promise.race([
      slotSelect.waitFor({ state: "attached", timeout: 10_000 }).catch(() => {}),
      noSlotMessage.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {}),
    ]);
    if (await slotSelect.count()) {
      const optionCount = await slotSelect.locator("option").count();
      if (optionCount > 1) {
        foundSlot = true;
        break;
      }
    }
  }
  expect(foundSlot, "候補日のいずれにも空き枠が無い（E2E_SPOT_ID/E2E_PLAN_SLUG を確認）").toBe(true);
  await page.locator("#slotId").selectOption({ index: 1 });
  await page.getByText("当日現金精算", { exact: true }).click();
  await page.getByRole("button", { name: "予約する" }).click();
  await page.waitForURL(/\/reservation\/confirm\//, { timeout: 15_000 });

  const match = page.url().match(/\/reservation\/confirm\/([^/?]+)/);
  if (!match) throw new Error(`reservationId が URL から取得できません: ${page.url()}`);
  return match[1]!;
}

test.describe.serial("予約後の追加購入フロー", () => {
  test.setTimeout(4 * 60 * 1000);

  test("予約詳細 → 追加購入（店舗受け取り） → 紐付け確認 → 返金", async ({ page }) => {
    const fixtures = getE2EFixtures();

    let reservationId = "";
    let shopSlug = "";

    await test.step("現地決済で予約を作成する（アドオンなし）", async () => {
      reservationId = await createCashReservation(page, fixtures);
    });

    await test.step("予約詳細ページの「追加で購入する」導線からショップへ遷移する", async () => {
      await page.goto(`/my/reservations/${reservationId}`);
      const addPurchaseLink = page.getByRole("link", { name: "追加で商品を購入する" });
      await expect(
        addPurchaseLink,
        "「追加で購入する」導線が表示されない（businesses RLS のログイン済み顧客向けポリシーを確認）",
      ).toBeVisible({ timeout: 10_000 });

      const href = await addPurchaseLink.getAttribute("href");
      shopSlug = href?.match(/\/shop\/([^/]+)\//)?.[1] ?? "";
      expect(shopSlug, `shop slug が href から取得できません: ${href}`).not.toBe("");

      await addPurchaseLink.click();
      // ログイン済み顧客が商品一覧を閲覧できること自体が businesses RLS 修正の回帰テストになる
      await page.waitForURL(new RegExp(`/shop/${shopSlug}/products`), { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "商品一覧" })).toBeVisible({ timeout: 10_000 });

      // linkedReservationId は URL から取り除かれ localStorage に移っていること
      await expect(page).not.toHaveURL(/linkedReservationId/);
    });

    let orderId = "";

    await test.step("店舗受け取りで別会計の注文を作成する", async () => {
      const firstProductLink = page.locator(`a[href^="/shop/${shopSlug}/products/"]`).first();
      await expect(
        firstProductLink,
        "購入可能な商品がない（公開済み・在庫ありの商品を用意してください）",
      ).toBeVisible({ timeout: 10_000 });
      await firstProductLink.click();

      await page.getByRole("button", { name: /カートに追加|在庫切れ/ }).click();
      await page.getByRole("link", { name: "カート" }).click();
      await page.waitForURL(new RegExp(`/shop/${shopSlug}/checkout`), { timeout: 10_000 });

      await expect(page.getByText("この注文は予約に関連付けられます。")).toBeVisible();

      await page.getByLabel("氏名").fill("E2E 追加購入太郎");
      await page.getByLabel("メールアドレス").fill(fixtures.testUserEmail);

      const pickupDateInput = page.locator("#pickupDate");
      const currentValue = await pickupDateInput.inputValue();
      expect(currentValue, "予約日からの pickup_date 事前入力が効いていない").not.toBe("");
      await page.locator("#pickupTime").selectOption({ index: 1 });

      await page.getByRole("button", { name: "注文を確定する" }).click();
      await page.waitForURL(/order-complete/, { timeout: 15_000 });

      const match = page.url().match(/order_id=([^&]+)/);
      if (!match) throw new Error(`order_id が URL から取得できません: ${page.url()}`);
      orderId = match[1]!;
    });

    await test.step("online_orders.linked_reservation_id が予約IDと一致する", async () => {
      const order = await waitFor(() => getOnlineOrderById(orderId), {
        description: "追加購入注文が作成される",
      });
      expect(order.linked_reservation_id).toBe(reservationId);

      const linked = await getOnlineOrdersByLinkedReservationId(reservationId);
      expect(linked.map((o) => o.id)).toContain(orderId);
    });

    await test.step("予約詳細ページ（顧客・管理画面）に追加購入が表示される", async () => {
      await page.goto(`/my/reservations/${reservationId}`);
      await expect(page.getByRole("heading", { name: "追加購入" })).toBeVisible();

      await loginAsAdmin(page, fixtures);
      await page.goto(`/admin/reservations/${reservationId}`);
      await expect(page.getByRole("heading", { name: "追加購入" })).toBeVisible();
    });

    await test.step("管理画面で返金を行う", async () => {
      // 受け取り確認（ORDER_STATUS_MANAGE = business_admin 限定）は E2E 管理者
      // フィクスチャが staff ロールのため UI 経由では実行できない。返金フローの
      // 検証に必要な前提状態（payment_status='paid'）は DB を直接更新して作る。
      await markOnlineOrderPaidForTest(orderId);
      await page.goto(`/admin/orders/${orderId}`);

      await page.getByRole("button", { name: "返金する" }).click();
      await page.locator('textarea[name="reason"]').fill("E2E テスト返金");
      await page.getByRole("button", { name: "返金する", exact: true }).last().click();

      await waitFor(
        async () => {
          const refreshed = await getOnlineOrderById(orderId);
          return refreshed.payment_status === "refunded" ? refreshed : null;
        },
        { description: "online_orders.payment_status が refunded になる" },
      );

      const refunds = await waitFor(
        async () => {
          const rows = await getSaleRefundsByOnlineOrderId(orderId);
          return rows.length > 0 ? rows : null;
        },
        { description: "sale_refunds に online_order_id 付きレコードが記録される" },
      );
      expect(refunds[0]!.status).toBe("completed");
    });
  });

  test("予約詳細 → 追加購入（配送・Stripe決済） → payment_intent 記録確認", async ({ page }) => {
    const fixtures = getE2EFixtures();

    let reservationId = "";
    let shopSlug = "";

    await test.step("現地決済で予約を作成する（アドオンなし）", async () => {
      reservationId = await createCashReservation(page, fixtures);
    });

    let orderId = "";

    await test.step("「追加で購入する」→ 配送を選択して Stripe 決済する", async () => {
      await page.goto(`/my/reservations/${reservationId}`);
      const addPurchaseLink = page.getByRole("link", { name: "追加で商品を購入する" });
      await expect(addPurchaseLink).toBeVisible({ timeout: 10_000 });
      const href = await addPurchaseLink.getAttribute("href");
      shopSlug = href?.match(/\/shop\/([^/]+)\//)?.[1] ?? "";
      expect(shopSlug).not.toBe("");
      await addPurchaseLink.click();
      await page.waitForURL(new RegExp(`/shop/${shopSlug}/products`), { timeout: 15_000 });

      // Stripe Checkout は JPY ¥50 未満を受け付けないため、E2Eダミー商品（¥1）を除外して選ぶ
      const shippableProductLink = page
        .locator(`a[href^="/shop/${shopSlug}/products/"]`)
        .filter({ hasNotText: "ダミー商品" })
        .first();
      await expect(
        shippableProductLink,
        "¥50以上の商品がない（Stripe Checkoutの最低金額を満たす商品を用意してください）",
      ).toBeVisible({ timeout: 10_000 });
      await shippableProductLink.click();
      await page.getByRole("button", { name: /カートに追加|在庫切れ/ }).click();
      await page.getByRole("link", { name: "カート" }).click();
      await page.waitForURL(new RegExp(`/shop/${shopSlug}/checkout`), { timeout: 10_000 });

      await expect(page.getByText("この注文は予約に関連付けられます。")).toBeVisible();
      await page.getByText("配送", { exact: true }).click();

      await page.getByLabel("氏名").fill("E2E 配送太郎");
      await page.getByLabel("メールアドレス").fill(fixtures.testUserEmail);
      await page.locator("#postalCode").fill("100-0001");
      await page.locator("#prefecture").fill("東京都");
      await page.locator("#addressLine1").fill("千代田1-1");

      await page.getByRole("button", { name: "クレジットカードで支払う" }).click();
      await payWithStripeTestCard(page);
      await page.waitForURL(/order-complete/, { timeout: 30_000 });

      const match = page.url().match(/order_id=([^&]+)/);
      if (!match) throw new Error(`order_id が URL から取得できません: ${page.url()}`);
      orderId = match[1]!;
    });

    await test.step("Webhook 経由で payment_intent_id が記録され、リンクも成立している", async () => {
      const order = await waitFor(
        async () => {
          const o = await getOnlineOrderById(orderId);
          return o.payment_status === "paid" ? o : null;
        },
        { description: "Stripe Webhook 経由で payment_status が paid になる" },
      );

      expect(order.linked_reservation_id).toBe(reservationId);
      expect(
        order.stripe_payment_intent_id,
        "online_orders.stripe_payment_intent_id が webhook 経由で記録されていない",
      ).not.toBeNull();

      const linked = await getOnlineOrdersByLinkedReservationId(reservationId);
      expect(linked.map((o) => o.id)).toContain(orderId);
    });
  });
});

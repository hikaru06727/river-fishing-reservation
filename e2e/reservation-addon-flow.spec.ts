import { test, expect, type Page } from "@playwright/test";
import { getE2EFixtures, type E2EFixtures } from "./fixtures";
import { loginAsTestUser, loginAsAdmin } from "./helpers/auth";
import { payWithStripeTestCard } from "./helpers/checkout";
import {
  waitFor,
  getProductStock,
  getProductName,
  getReservationStatus,
  getPaymentLedgerRows,
  getSaleRefunds,
  getSystemProfileId,
} from "./helpers/db";
import { getPaymentIntentIdForSession, listRefundsForPaymentIntent } from "./helpers/stripeApi";
import { readSalesSnapshot, type SalesSnapshot } from "./helpers/salesDashboard";
import { toISODate } from "@/lib/utils/date";
import { AVAILABLE_SLOT_LOOKAHEAD_DAYS } from "@/lib/slots/availability-lookahead";

function parseYen(text: string): number {
  const digits = text.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

async function readYenNextTo(page: Page, label: string): Promise<number> {
  const text = await page
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::span[1]")
    .textContent();
  return parseYen(text ?? "");
}

async function fillAndSubmitReservation(
  page: Page,
  fixtures: E2EFixtures,
  opts: { paymentMethodLabel: string; addonProductName: string; addonQuantity: number },
): Promise<{ reservationId: string; planAmountYen: number; addonAmountYen: number }> {
  await page.goto(`/reserve/${fixtures.spotId}?plan=${fixtures.planSlug}`);
  await page.locator("#reservationDate").waitFor({ state: "attached", timeout: 30_000 });

  // 「利用日」のデフォルト選択（今日）に空き枠が無いことがある上、直近すぎる日付は
  // ユーザーによるキャンセル（利用開始24時間前まで）ができなくなるため、
  // 3日以上先の候補日から順に空き枠がある日付を探す。
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

  if (opts.addonQuantity > 0) {
    await page
      .getByLabel(`${opts.addonProductName}の数量`)
      .selectOption({ label: `${opts.addonQuantity} 個` });
  }

  await page.getByText(opts.paymentMethodLabel, { exact: true }).click();

  const planAmountYen = await readYenNextTo(page, "利用料金");
  const addonAmountYen = opts.addonQuantity > 0 ? await readYenNextTo(page, "追加商品") : 0;

  await page.getByRole("button", { name: "予約する" }).click();
  await page.waitForURL(/\/reservation\/confirm\//, { timeout: 15_000 });

  const reservationId = page.url().match(/\/reservation\/confirm\/([^/?]+)/)?.[1];
  if (!reservationId) {
    throw new Error(`[fillAndSubmitReservation] reservationId が URL から取得できません: ${page.url()}`);
  }

  return { reservationId, planAmountYen, addonAmountYen };
}

test.describe.serial("アドオン付き予約: 5シナリオ", () => {
  test.setTimeout(6 * 60 * 1000);

  test("シナリオ1〜5", async ({ page }) => {
    const fixtures = getE2EFixtures();
    const productName = await getProductName(fixtures.productId);

    const today = toISODate(new Date());
    const wideDateTo = toISODate(
      new Date(Date.now() + (AVAILABLE_SLOT_LOOKAHEAD_DAYS + 1) * 24 * 60 * 60 * 1000),
    );

    // ベースライン取得（シナリオ1開始前）
    const stockBaseline = await getProductStock(fixtures.productId);
    if (stockBaseline === null) {
      throw new Error(
        "[E2E_PRODUCT_ID] 在庫無制限（stock_quantity=NULL）の商品です。track_inventory=true の在庫あり商品を指定してください。",
      );
    }

    await loginAsAdmin(page, fixtures);
    const baselineSalesSnapshot: SalesSnapshot = await readSalesSnapshot(page, today, wideDateTo);

    let reservationId1 = "";
    let checkoutSessionId1 = "";
    let planAmount1 = 0;
    let addonAmount1 = 0;

    await test.step("シナリオ1: Stripe決済（今払う）+ アドオン付き予約", async () => {
      await loginAsTestUser(page, fixtures);

      const result = await fillAndSubmitReservation(page, fixtures, {
        paymentMethodLabel: "オンライン決済（カード）",
        addonProductName: productName,
        addonQuantity: 1,
      });
      reservationId1 = result.reservationId;
      planAmount1 = result.planAmountYen;
      addonAmount1 = result.addonAmountYen;
      expect(addonAmount1, "アドオン金額が0円（数量選択に失敗した可能性）").toBeGreaterThan(0);

      await page.getByRole("button", { name: "カード決済へ進む" }).click();
      await payWithStripeTestCard(page);
      await page.waitForURL(/\/reserve\/complete/, { timeout: 30_000 });

      const sessionId = new URL(page.url()).searchParams.get("session_id");
      if (!sessionId) {
        throw new Error(`[シナリオ1] session_id が URL から取得できません: ${page.url()}`);
      }
      checkoutSessionId1 = sessionId;

      // 確認1: Stripe決済成功 → 予約confirmed
      await waitFor(
        async () => ((await getReservationStatus(reservationId1)) === "confirmed" ? true : null),
        { description: "reservation1 が Stripe Webhook 経由で confirmed になる" },
      );

      // 確認2: 在庫が購入数量分だけ減少
      await waitFor(
        async () => {
          const stock = await getProductStock(fixtures.productId);
          return stock === stockBaseline - 1 ? stock : null;
        },
        { description: "商品在庫が購入数量分（1）だけ減少する" },
      );

      // 確認3: payment_ledger（reservation分1件・アドオン分含まない金額）
      const reservationLedger = await waitFor(
        async () => {
          const rows = await getPaymentLedgerRows("reservation", reservationId1);
          return rows.length === 1 ? rows : null;
        },
        { description: "payment_ledger に reservation 分が1件記録される" },
      );
      expect(reservationLedger[0]!.amount).toBe(planAmount1);

      // 確認4: payment_ledger（reservation_addon分が別レコードで同一source_id）
      const addonLedger = await waitFor(
        async () => {
          const rows = await getPaymentLedgerRows("reservation_addon", reservationId1);
          return rows.length === 1 ? rows : null;
        },
        { description: "payment_ledger に reservation_addon 分が1件記録される" },
      );
      expect(addonLedger[0]!.amount).toBe(addonAmount1);
      expect(addonLedger[0]!.source_id).toBe(reservationId1);
    });

    let reservationId2 = "";
    let planAmount2 = 0;
    let addonAmount2 = 0;

    await test.step("シナリオ2: 現地決済 + アドオン付き予約", async () => {
      await loginAsTestUser(page, fixtures);
      const stockBeforeReserve = await getProductStock(fixtures.productId);
      if (stockBeforeReserve === null) {
        throw new Error(
          "[E2E_PRODUCT_ID] 在庫無制限（stock_quantity=NULL）の商品です。track_inventory=true の在庫あり商品を指定してください。",
        );
      }

      const result = await fillAndSubmitReservation(page, fixtures, {
        paymentMethodLabel: "当日現金精算",
        addonProductName: productName,
        addonQuantity: 1,
      });
      reservationId2 = result.reservationId;
      planAmount2 = result.planAmountYen;
      addonAmount2 = result.addonAmountYen;
      expect(addonAmount2, "アドオン金額が0円（数量選択に失敗した可能性）").toBeGreaterThan(0);

      // 確認1: 現地決済選択時点ではまだ在庫が減らない
      expect(await getReservationStatus(reservationId2)).toBe("confirmed");
      const stockAfterReserve = await getProductStock(fixtures.productId);
      expect(stockAfterReserve, "現地決済の予約直後に在庫が減ってしまっている").toBe(stockBeforeReserve);

      // 確認2: 「現地で支払い済みにする」操作後に在庫が減少する
      await loginAsAdmin(page, fixtures);
      await page.goto(`/admin/reservations/${reservationId2}`);
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "現地で支払い済みにする" }).click();

      await waitFor(
        async () => {
          const stock = await getProductStock(fixtures.productId);
          return stock === stockBeforeReserve - 1 ? stock : null;
        },
        { description: "現地支払い済み操作後に在庫が減少する" },
      );
    });

    await test.step("シナリオ3: 予約キャンセル時の自動返金（Stripe決済分）", async () => {
      await loginAsTestUser(page, fixtures);
      await page.goto(`/my/reservations/${reservationId1}`);
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "予約をキャンセル" }).click();

      await waitFor(
        async () => ((await getReservationStatus(reservationId1)) === "cancelled" ? true : null),
        { description: "reservation1 が cancelled になる" },
      );

      // 確認1・2: Stripe側で返金が作成され、金額が本体+アドオンの合計と一致
      const paymentIntentId = await getPaymentIntentIdForSession(checkoutSessionId1);
      const refunds = await waitFor(
        async () => {
          const list = await listRefundsForPaymentIntent(paymentIntentId);
          return list.length > 0 ? list : null;
        },
        { description: "Stripe側で refund が作成される", timeoutMs: 30_000 },
      );
      expect(refunds[0]!.amount).toBe(planAmount1 + addonAmount1);

      // 確認3: sale_refunds に1件、refunded_by が system プレースホルダー profile
      const systemProfileId = await getSystemProfileId();
      const saleRefunds = await waitFor(
        async () => {
          const rows = await getSaleRefunds(reservationId1);
          return rows.length === 1 ? rows : null;
        },
        { description: "sale_refunds に1件記録される" },
      );
      expect(saleRefunds[0]!.refunded_by).toBe(systemProfileId);

      // 確認4: payment_ledger 予約分・アドオン分の両方が refunded になる
      await waitFor(
        async () => {
          const rows = await getPaymentLedgerRows("reservation", reservationId1);
          return rows[0]?.status === "refunded" ? rows : null;
        },
        { description: "payment_ledger の reservation 行が refunded になる" },
      );
      await waitFor(
        async () => {
          const rows = await getPaymentLedgerRows("reservation_addon", reservationId1);
          return rows[0]?.status === "refunded" ? rows : null;
        },
        { description: "payment_ledger の reservation_addon 行が refunded になる" },
      );
    });

    await test.step("シナリオ4: キャンセル時のアドオン在庫復元", async () => {
      // シナリオ1分（1個）が復元され、シナリオ2分（1個）は減ったままの水準に戻る
      await waitFor(
        async () => {
          const stock = await getProductStock(fixtures.productId);
          return stock === stockBaseline - 1 ? stock : null;
        },
        { description: "キャンセル分の在庫が元の水準まで復元される" },
      );
    });

    await test.step("シナリオ5: 売上画面での区分表示確認", async () => {
      await loginAsAdmin(page, fixtures);
      const finalSnapshot = await readSalesSnapshot(page, today, wideDateTo);

      const revenueDelta = finalSnapshot.confirmedRevenueYen - baselineSalesSnapshot.confirmedRevenueYen;
      const productDelta = finalSnapshot.productSalesYen - baselineSalesSnapshot.productSalesYen;

      // 確認1: 予約タブには reservation2（キャンセルされていない方）の本体分のみ計上
      expect(revenueDelta, "予約タブの確定売上の増分が reservation2 の本体分と一致しない").toBe(
        planAmount2,
      );

      // 確認2・3: 物販タブには reservation2 のアドオン分のみ計上（reservation1 は返金で除外）
      expect(productDelta, "物販タブの増分が reservation2 のアドオン分と一致しない").toBe(addonAmount2);
    });
  });
});

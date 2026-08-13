import { test, expect } from "@playwright/test";
import { getE2EFixtures } from "./fixtures";
import { loginAsTestUser } from "./helpers/auth";
import { createCashReservation } from "./helpers/reservation";
import {
  waitFor,
  getReservationStatus,
  getProfileByEmail,
  createNearTermConfirmedReservation,
  deleteReservation,
} from "./helpers/db";

/**
 * 顧客セルフキャンセル（/my/reservations/[id] の「予約をキャンセル」ボタン）の
 * 画面操作・表示確認に絞ったE2E。判定ロジック自体は cancel-policy.test.ts で
 * 別途ユニットテスト済みのため、ここでは重複させない。
 */

test.describe.serial("顧客セルフキャンセル", () => {
  test.setTimeout(3 * 60 * 1000);

  test("期限内（24時間以上前）の confirmed 予約を顧客自身でキャンセルできる", async ({ page }) => {
    const fixtures = getE2EFixtures();

    const reservationId = await createCashReservation(page, fixtures);
    expect(await getReservationStatus(reservationId)).toBe("confirmed");

    await page.goto(`/my/reservations/${reservationId}`);
    const cancelButton = page.getByRole("button", { name: "予約をキャンセル" });
    await expect(
      cancelButton,
      "期限内の confirmed 予約でキャンセルボタンが表示されない",
    ).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await cancelButton.click();

    await page.waitForURL(/\/my\/reservations\/?$/, { timeout: 15_000 });

    await waitFor(
      async () => ((await getReservationStatus(reservationId)) === "cancelled" ? true : null),
      { description: "キャンセル後、予約ステータスが cancelled になる" },
    );

    // UI表示の確認: 詳細ページに戻り、ステータスバッジとキャンセル不可メッセージが反映されていること
    //
    // 「キャンセル済」というテキストは支払い状態バッジにも表示されうる（cash_at_venue +
    // cancelled のとき）ため、テキストのみでは一意に特定できない。予約ステータスバッジ
    // （cancelled = bg-slate-100 text-slate-600、get-my-reservations.ts で確認済み）の
    // 色クラスも併せて絞り込む。
    await page.goto(`/my/reservations/${reservationId}`);
    await expect(
      page.locator("span.bg-slate-100", { hasText: "キャンセル済" }),
      "予約ステータスバッジが cancelled 表示になっていない",
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "予約をキャンセル" })).toHaveCount(0);
    await expect(page.getByText("この予約はキャンセルできません。")).toBeVisible();
  });

  test("利用開始24時間を切った confirmed 予約はキャンセルボタンが表示されない", async ({ page }) => {
    const fixtures = getE2EFixtures();
    const profile = await getProfileByEmail(fixtures.testUserEmail);
    if (!profile) {
      throw new Error(
        "[customer-self-cancel] テストユーザーの profile が見つかりません（E2E_TEST_USER_EMAIL を確認）",
      );
    }

    const reservationId = await createNearTermConfirmedReservation({
      userId: profile.id,
      spotId: fixtures.spotId,
      planSlug: fixtures.planSlug,
    });

    try {
      await loginAsTestUser(page, fixtures);
      await page.goto(`/my/reservations/${reservationId}`);

      await expect(
        page.getByRole("button", { name: "予約をキャンセル" }),
        "24時間を切った予約でキャンセルボタンが表示されてしまっている",
      ).toHaveCount(0);
      await expect(
        page.getByText("利用開始24時間前を過ぎているため、キャンセルできません。"),
      ).toBeVisible();
    } finally {
      await deleteReservation(reservationId);
    }
  });
});

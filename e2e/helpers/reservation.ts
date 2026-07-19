import { expect, type Page } from "@playwright/test";
import { loginAsTestUser } from "./auth";
import type { E2EFixtures } from "../fixtures";

/** 現地決済（現金）で予約を作成し、reservationId を返す。呼び出し前提でログイン状態にする。 */
export async function createCashReservation(page: Page, fixtures: E2EFixtures): Promise<string> {
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

/** 予約詳細ページの「追加で購入する」導線から shop slug を取得する。ログイン済み前提。 */
export async function getShopSlugForReservation(page: Page, reservationId: string): Promise<string> {
  await page.goto(`/my/reservations/${reservationId}`);
  const addPurchaseLink = page.getByRole("link", { name: "追加で商品を購入する" });
  await expect(
    addPurchaseLink,
    "「追加で購入する」導線が表示されない（businesses RLS のログイン済み顧客向けポリシーを確認）",
  ).toBeVisible({ timeout: 10_000 });

  const href = await addPurchaseLink.getAttribute("href");
  const shopSlug = href?.match(/\/shop\/([^/]+)\//)?.[1] ?? "";
  expect(shopSlug, `shop slug が href から取得できません: ${href}`).not.toBe("");
  return shopSlug;
}

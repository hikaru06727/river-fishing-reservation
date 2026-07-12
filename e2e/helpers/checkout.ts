import type { Page } from "@playwright/test";

/**
 * checkout.stripe.com の実DOM構造を --headed で確認済み（2026-07-12）。
 * カード情報の入力欄は iframe 分割ではなく、ページ直下の通常 input
 * （id="cardNumber" / "cardExpiry" / "cardCvc" / "billingName"）。
 * 送信ボタンは英語表記 "Pay"。Stripe側の仕様変更で壊れた場合は
 * --headed で再確認すること。
 */
export async function payWithStripeTestCard(page: Page): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

  // isVisible() は auto-wait しないため、fill() 自体の auto-wait に任せて存在確認を兼ねる
  // （email 入力欄が無い/既に入力済みのセッションもあるため、失敗しても無視する）
  await page
    .locator("#email")
    .or(page.getByRole("textbox", { name: "Email" }))
    .first()
    .fill("e2e-test@example.com", { timeout: 10_000 })
    .catch(() => {});

  await page.locator("#cardNumber").fill("4242424242424242");
  await page.locator("#cardExpiry").fill("12/34");
  await page.locator("#cardCvc").fill("123");

  const nameField = page.locator("#billingName");
  if (await nameField.isVisible().catch(() => false)) {
    await nameField.fill("E2E Test");
  }

  await page.getByRole("button", { name: /^Pay$|お支払い|支払う/ }).click();
}

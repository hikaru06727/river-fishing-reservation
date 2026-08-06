import type { Page } from "@playwright/test";

export function parseYen(text: string): number {
  const digits = text.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export type SalesSnapshot = {
  confirmedRevenueYen: number;
  productSalesYen: number;
};

/**
 * /admin/sales の「予約」タブの確定売上（reservations 本体分のみ）と
 * 「物販」タブの POS 販売合計（pos + reservation_addon 分）を読み取る。
 * 事業全体の集計値なので、呼び出し側で差分（前後スナップショットの差）を取って検証すること。
 */
export async function readSalesSnapshot(
  page: Page,
  dateFrom: string,
  dateTo: string,
): Promise<SalesSnapshot> {
  await page.goto(`/admin/sales?dateFrom=${dateFrom}&dateTo=${dateTo}`);

  await page.getByRole("button", { name: "予約", exact: true }).click();
  const confirmedRevenueText = await page
    .getByText("確定売上", { exact: true })
    .locator("xpath=following-sibling::p[1]")
    .textContent();

  await page.getByRole("button", { name: "物販", exact: true }).click();
  const productSalesText = await page
    .getByText("POS 販売合計（税込み）", { exact: true })
    .locator("xpath=following-sibling::p[1]")
    .textContent();

  return {
    confirmedRevenueYen: parseYen(confirmedRevenueText ?? ""),
    productSalesYen: parseYen(productSalesText ?? ""),
  };
}

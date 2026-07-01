import { findActiveBusinessBySlug } from "@/lib/repositories/businesses.repository";
import {
  findPublishedProductsByBusinessId,
  type PublicProductRow,
} from "@/lib/repositories/products.repository";
import type { PublicProductSummary } from "@/types/domain";

function toSummary(row: PublicProductRow): PublicProductSummary {
  return {
    id: row.id,
    name: row.name,
    price_excluding_tax: row.price_excluding_tax,
    tax_rate_percent: row.default_tax_rate,
    image_url: row.image_url,
    track_inventory: row.track_inventory,
    stock_quantity: row.stock_quantity,
  };
}

/**
 * 事業ごとの公開中商品一覧（顧客向け）
 * slug が存在しない・非公開事業の場合は null を返す（呼び出し側で notFound() する）
 */
export async function getPublishedProducts(slug: string): Promise<PublicProductSummary[] | null> {
  try {
    const business = await findActiveBusinessBySlug(slug);
    if (!business) return null;

    const rows = await findPublishedProductsByBusinessId(business.id);
    return rows.map(toSummary);
  } catch (err) {
    console.error("[getPublishedProducts]", err instanceof Error ? err.message : err);
    throw new Error("商品データの取得に失敗しました。しばらくしてから再度お試しください。");
  }
}

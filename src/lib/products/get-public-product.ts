import { cache } from "react";
import { findActiveBusinessBySlug } from "@/lib/repositories/businesses.repository";
import {
  findPublishedProductById,
  type PublicProductRow,
} from "@/lib/repositories/products.repository";
import type { PublicProductDetail } from "@/types/domain";

function toDetail(row: PublicProductRow): PublicProductDetail {
  return {
    id: row.id,
    name: row.name,
    price_excluding_tax: row.price_excluding_tax,
    tax_rate_percent: row.default_tax_rate,
    image_url: row.image_url,
    track_inventory: row.track_inventory,
    stock_quantity: row.stock_quantity,
    description_online: row.description_online,
    shippable: row.shippable,
  };
}

/**
 * 事業slug・商品IDに対応する公開中商品詳細（顧客向け）
 * slug が存在しない事業、または商品が存在しない・非公開の場合は null
 */
export const getPublishedProduct = cache(
  async (slug: string, productId: string): Promise<PublicProductDetail | null> => {
    try {
      const business = await findActiveBusinessBySlug(slug);
      if (!business) return null;

      const row = await findPublishedProductById(business.id, productId);
      return row ? toDetail(row) : null;
    } catch (err) {
      console.error("[getPublishedProduct]", err instanceof Error ? err.message : err);
      throw new Error("商品データの取得に失敗しました。");
    }
  },
);

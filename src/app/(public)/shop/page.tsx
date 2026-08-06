import { notFound, redirect } from "next/navigation";
import { findFirstActiveBusinessSlug } from "@/lib/repositories/businesses.repository";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * ヘッダーナビの「ショップ」リンク先。
 * 最初の is_active な事業の /shop/[slug]/products へリダイレクトする。
 * マルチテナント対応後、事業選択導線を追加する場合はここを起点にする。
 */
export default async function ShopIndexPage() {
  const slug = await findFirstActiveBusinessSlug();

  if (!slug) {
    notFound();
  }

  redirect(`/shop/${slug}/products`);
}

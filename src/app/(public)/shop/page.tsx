import { notFound, redirect } from "next/navigation";
import { findFirstActiveBusinessSlug } from "@/lib/repositories/businesses.repository";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * 仮実装: ヘッダーナビの「ショップ」リンク先。
 * 最初の is_active な事業の /shop/[slug]/products へリダイレクトする。
 */
export default async function ShopIndexPage() {
  const slug = await findFirstActiveBusinessSlug();

  if (!slug) {
    notFound();
  }

  redirect(`/shop/${slug}/products`);
}

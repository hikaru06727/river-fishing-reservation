import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { formatYen } from "@/lib/utils/format";
import { getPublishedProduct } from "@/lib/products/get-public-product";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface ShopProductDetailPageProps {
  params: Promise<{ businessId: string; id: string }>;
}

export async function generateMetadata({ params }: ShopProductDetailPageProps) {
  const { businessId, id } = await params;
  const product = await getPublishedProduct(businessId, id);

  if (!product) {
    return { title: "商品が見つかりません" };
  }

  return {
    title: product.name,
    description: product.description_online ?? `${product.name}の詳細`,
  };
}

export default async function ShopProductDetailPage({ params }: ShopProductDetailPageProps) {
  const { businessId, id } = await params;

  const product = await getPublishedProduct(businessId, id);
  if (!product) {
    notFound();
  }

  const isOutOfStock = product.track_inventory && product.stock_quantity === 0;
  const priceIncludingTax = Math.round(
    product.price_excluding_tax * (1 + product.tax_rate_percent / 100),
  );

  return (
    <div className="space-y-6">
      <Card padding="none" className="overflow-hidden">
        <div className="relative aspect-[4/3] w-full bg-sky-100 sm:aspect-[16/9]">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200">
              <span className="text-6xl" aria-hidden="true">
                🛒
              </span>
            </div>
          )}
          {isOutOfStock && (
            <span className="absolute left-4 top-4 rounded-full bg-red-600/90 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
              在庫切れ
            </span>
          )}
        </div>

        <div className="p-4 sm:p-6">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{product.name}</h1>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">
              {formatYen(priceIncludingTax)}
            </span>
            <span className="text-xs text-muted">税込</span>
          </div>
          <p className="text-xs text-muted">{formatYen(product.price_excluding_tax)} 税抜</p>

          {product.description_online && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-base">
              {product.description_online}
            </p>
          )}

          {isOutOfStock && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              現在在庫切れです。入荷まで今しばらくお待ちください。
            </p>
          )}
        </div>
      </Card>

      <Link
        href={`/shop/${businessId}/products`}
        className="text-sm font-medium text-primary hover:underline"
      >
        ← 商品一覧に戻る
      </Link>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { formatYen } from "@/lib/utils/format";
import type { PublicProductSummary } from "@/types/domain";

interface ProductCardProps {
  product: PublicProductSummary;
  slug: string;
}

export function ProductCard({ product, slug }: ProductCardProps) {
  const isOutOfStock = product.track_inventory && product.stock_quantity === 0;
  const priceIncludingTax = Math.round(
    product.price_excluding_tax * (1 + product.tax_rate_percent / 100),
  );

  return (
    <Link
      href={`/shop/${slug}/products/${product.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-sky-100">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200">
            <span className="text-4xl" aria-hidden="true">
              🛒
            </span>
          </div>
        )}
        {isOutOfStock && (
          <span className="absolute left-3 top-3 rounded-full bg-red-600/90 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            在庫切れ
          </span>
        )}
      </div>

      <div className="p-4">
        <h2 className="text-base font-semibold text-foreground group-hover:text-primary">
          {product.name}
        </h2>
        <p className="mt-2 text-lg font-bold text-primary">
          {formatYen(priceIncludingTax)}
          <span className="ml-1 text-xs font-normal text-muted">税込</span>
        </p>
        <p className="text-xs text-muted">{formatYen(product.price_excluding_tax)} 税抜</p>
      </div>
    </Link>
  );
}

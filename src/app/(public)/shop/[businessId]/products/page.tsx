import { ProductCard } from "@/components/products/ProductCard";
import { getPublishedProducts } from "@/lib/products/get-public-products";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "商品一覧",
};

interface ShopProductsPageProps {
  params: Promise<{ businessId: string }>;
}

export default async function ShopProductsPage({ params }: ShopProductsPageProps) {
  const { businessId } = await params;
  const products = await getPublishedProducts(businessId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">商品一覧</h1>
        <p className="mt-1 text-sm text-muted">
          オンラインで購入可能な商品をご覧いただけます
        </p>
      </header>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-4xl" aria-hidden="true">
            🛒
          </p>
          <p className="mt-3 font-medium text-foreground">
            現在、公開中の商品がありません
          </p>
          <p className="mt-1 text-sm text-muted">
            しばらくしてから再度ご確認ください
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} businessId={businessId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

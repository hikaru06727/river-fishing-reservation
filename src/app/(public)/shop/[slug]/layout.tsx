import { CartProvider } from "@/contexts/CartContext";
import { CartHeaderBar } from "@/components/shop/CartHeaderBar";

interface ShopLayoutProps {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export default async function ShopLayout({ params, children }: ShopLayoutProps) {
  const { slug } = await params;

  return (
    <CartProvider slug={slug}>
      <CartHeaderBar slug={slug} />
      {children}
    </CartProvider>
  );
}

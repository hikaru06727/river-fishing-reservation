import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CartProvider } from "@/contexts/CartContext";
import { CartHeaderBar } from "@/components/shop/CartHeaderBar";
import { LinkedReservationCapture } from "@/components/shop/LinkedReservationCapture";
import { ONLINE_SHOP_ENABLED } from "@/lib/feature-flags";

interface ShopLayoutProps {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export default async function ShopLayout({ params, children }: ShopLayoutProps) {
  if (!ONLINE_SHOP_ENABLED) {
    notFound();
  }

  const { slug } = await params;

  return (
    <CartProvider slug={slug}>
      <Suspense fallback={null}>
        <LinkedReservationCapture slug={slug} />
      </Suspense>
      <CartHeaderBar slug={slug} />
      {children}
    </CartProvider>
  );
}

import { Suspense } from "react";
import { CartProvider } from "@/contexts/CartContext";
import { CartHeaderBar } from "@/components/shop/CartHeaderBar";
import { LinkedReservationCapture } from "@/components/shop/LinkedReservationCapture";

interface ShopLayoutProps {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export default async function ShopLayout({ params, children }: ShopLayoutProps) {
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

import { notFound } from "next/navigation";
import { findActiveBusinessBySlug } from "@/lib/repositories/businesses.repository";
import { CheckoutForm } from "@/components/shop/CheckoutForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "レジに進む",
};

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const business = await findActiveBusinessBySlug(slug);

  if (!business) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">レジに進む</h1>
      </header>
      <CheckoutForm slug={slug} businessId={business.id} />
    </div>
  );
}

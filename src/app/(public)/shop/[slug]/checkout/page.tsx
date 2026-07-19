import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";
import { findActiveBusinessBySlug } from "@/lib/repositories/businesses.repository";
import { getCheckoutContactPrefill } from "@/lib/services/online-order.service";
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

  const user = await getUser();
  const prefill = user ? await getCheckoutContactPrefill(user.id) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">レジに進む</h1>
      </header>
      <CheckoutForm
        slug={slug}
        businessId={business.id}
        isLoggedIn={!!user}
        prefill={prefill}
      />
    </div>
  );
}

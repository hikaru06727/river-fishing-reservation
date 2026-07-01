import { notFound, redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findProductById } from "@/lib/repositories/products.repository";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductSellPage({ params }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products");

  const { id } = await params;
  const product = await findProductById(id);
  if (!product) notFound();

  redirect(`/admin/pos?businessId=${product.business_id}`);
}

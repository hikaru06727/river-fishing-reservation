import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReserveForm } from "@/components/reservation/ReserveForm";
import { getUser } from "@/lib/auth/get-user";
import { getPlanBySlug } from "@/lib/plans/get-plan-by-slug";
import { getSpotById } from "@/lib/spots/get-spot-by-id";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface ReservePageProps {
  params: Promise<{ spotId: string }>;
  searchParams: Promise<{ plan?: string }>;
}

export async function generateMetadata({ params }: ReservePageProps) {
  const { spotId } = await params;
  const spot = await getSpotById(spotId);
  return {
    title: spot ? `${spot.name} を予約` : "予約",
  };
}

export default async function ReservePage({
  params,
  searchParams,
}: ReservePageProps) {
  const user = await getUser();
  const { spotId } = await params;
  const { plan: planSlug } = await searchParams;

  if (!user) {
    redirect(`/login?next=/reserve/${spotId}${planSlug ? `?plan=${planSlug}` : ""}`);
  }

  if (!planSlug) {
    redirect("/spots");
  }

  const spot = await getSpotById(spotId);
  if (!spot) {
    notFound();
  }

  const plan = await getPlanBySlug(planSlug);
  if (!plan) {
    notFound();
  }

  return (    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">予約</h1>
        <p className="mt-1 text-sm text-muted">{spot.name}</p>
      </header>

      <ReserveForm spot={spot} plan={plan} />
    </div>
  );
}

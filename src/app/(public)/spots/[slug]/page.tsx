import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanAvailabilitySlots } from "@/components/spots/PlanAvailabilitySlots";
import { PlanCard } from "@/components/spots/PlanCard";
import { SpotDetailHeader } from "@/components/spots/SpotDetailHeader";
import { getActivePlans } from "@/lib/plans/get-plans";
import { getSpotBySlug } from "@/lib/spots/get-spot-by-slug";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface SpotDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: SpotDetailPageProps) {
  const { slug } = await params;
  const spot = await getSpotBySlug(slug);

  if (!spot) {
    return { title: "釣り場が見つかりません" };
  }

  return {
    title: spot.name,
    description: spot.description ?? `${spot.name}の詳細・予約`,
  };
}

export default async function SpotDetailPage({ params }: SpotDetailPageProps) {
  const { slug } = await params;

  const spot = await getSpotBySlug(slug);
  if (!spot) {
    notFound();
  }

  const plans = await getActivePlans();

  return (
    <div className="space-y-8">
      <SpotDetailHeader spot={spot} />

      <section>
        <h2 className="mb-4 text-xl font-bold text-foreground">利用プラン</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-muted">現在、利用可能なプランがありません。</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <li key={plan.id}>
                <PlanCard plan={plan} spotId={spot.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-2">
          <h2 className="text-xl font-bold text-foreground">空き枠</h2>
          <p className="text-xs text-muted">今日から7日間・プラン別</p>
        </div>
        {plans.length === 0 ? (
          <p className="text-sm text-muted">プランが登録されていません。</p>
        ) : (
          <div className="space-y-8">
            {plans.map((plan) => (
              <PlanAvailabilitySlots
                key={plan.id}
                spotId={spot.id}
                planId={plan.id}
                planName={plan.name}
              />
            ))}
          </div>
        )}
      </section>

      <div className="pb-4">
        <Link
          href="/spots"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← 釣り場一覧に戻る
        </Link>
      </div>
    </div>
  );
}

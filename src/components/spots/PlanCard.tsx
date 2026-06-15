import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatDuration } from "@/lib/utils/plan";
import { formatYen } from "@/lib/utils/format";
import type { Plan } from "@/types/database";

interface PlanCardProps {
  plan: Plan;
  spotId: string;
}

export function PlanCard({ plan, spotId }: PlanCardProps) {
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">利用時間</dt>
            <dd className="font-medium">{formatDuration(plan.duration_minutes)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">料金</dt>
            <dd className="text-lg font-bold text-primary">
              {formatYen(plan.price_yen)}
            </dd>
          </div>
        </dl>
      </div>

      <Link
        href={`/reserve/${spotId}?plan=${plan.slug}`}
        className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        このプランで予約する
      </Link>
    </Card>
  );
}

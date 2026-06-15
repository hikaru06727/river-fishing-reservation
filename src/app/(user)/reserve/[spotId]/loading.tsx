import { Card } from "@/components/ui/Card";

export default function ReserveLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
      </div>
      <Card>
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
      </Card>
      <Card>
        <div className="space-y-4">
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </Card>
      <div className="h-12 animate-pulse rounded-lg bg-slate-200" />
    </div>
  );
}

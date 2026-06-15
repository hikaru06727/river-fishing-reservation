export function SpotDetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="aspect-[16/9] animate-pulse bg-slate-200 sm:aspect-[21/9]" />
        <div className="space-y-3 p-4 sm:p-6">
          <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
          <div className="h-10 w-24 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>

      <div>
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 h-11 animate-pulse rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-4 h-6 w-24 animate-pulse rounded bg-slate-200" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="mb-3 h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="space-y-2">
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

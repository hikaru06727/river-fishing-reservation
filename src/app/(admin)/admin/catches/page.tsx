import Link from "next/link";

export default function AdminCatchesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted">釣果レポートの管理</p>
        <Link
          href="/admin/catches/new"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          新規投稿
        </Link>
      </div>
    </div>
  );
}

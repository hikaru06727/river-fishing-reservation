import type { Metadata } from "next";
import Link from "next/link";
import { createCatch } from "../actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "釣果投稿" };

export default async function AdminCatchNewPage() {
  const supabase = await createClient();
  const { data: spots } = await supabase
    .from("fishing_spots")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  type SpotOption = { id: string; name: string };
  const spotOptions: SpotOption[] = spots ?? [];

  return (
    <div>
      <div className="mx-auto max-w-lg">
        <Link href="/admin/catches" className="text-sm text-primary hover:underline">
          ← 釣果管理
        </Link>
        <h1 className="mt-4 text-2xl font-bold">釣果を投稿</h1>
        <form action={createCatch} className="mt-8 space-y-4">
          <div>
            <label htmlFor="spotId" className="block text-sm font-medium">
              釣り場
            </label>
            <select
              id="spotId"
              name="spotId"
              required
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">選択してください</option>
              {spotOptions.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="date" className="block text-sm font-medium">
              日付
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="species" className="block text-sm font-medium">
              魚種
            </label>
            <input
              id="species"
              name="species"
              type="text"
              required
              placeholder="ヤマメ"
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="size" className="block text-sm font-medium">
              サイズ
            </label>
            <input
              id="size"
              name="size"
              type="text"
              placeholder="25cm"
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="excerpt" className="block text-sm font-medium">
              一覧用コメント
            </label>
            <input
              id="excerpt"
              name="excerpt"
              type="text"
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="body" className="block text-sm font-medium">
              詳細
            </label>
            <textarea
              id="body"
              name="body"
              required
              rows={6}
              className="mt-1 w-full rounded-xl border border-border p-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:opacity-90"
          >
            投稿する
          </button>
        </form>
      </div>
    </div>
  );
}

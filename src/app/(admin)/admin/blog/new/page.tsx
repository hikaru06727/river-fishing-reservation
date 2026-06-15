import type { Metadata } from "next";
import Link from "next/link";
import { createBlogPost } from "../actions";

export const metadata: Metadata = { title: "記事作成" };

export default function AdminBlogNewPage() {
  return (
    <div>
      <div className="mx-auto max-w-lg">
        <Link href="/admin/blog" className="text-sm text-primary hover:underline">
          ← ブログ管理
        </Link>
        <h1 className="mt-4 text-2xl font-bold">記事を作成</h1>
        <form action={createBlogPost} className="mt-8 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              タイトル
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="slug" className="block text-sm font-medium">
              スラッグ
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              placeholder="my-post-slug"
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="excerpt" className="block text-sm font-medium">
              抜粋
            </label>
            <input
              id="excerpt"
              name="excerpt"
              type="text"
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="content" className="block text-sm font-medium">
              本文
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={10}
              className="mt-1 w-full rounded-xl border border-border p-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="published" type="checkbox" />
            公開する
          </label>
          <button
            type="submit"
            className="w-full min-h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:opacity-90"
          >
            保存する
          </button>
        </form>
      </div>
    </div>
  );
}

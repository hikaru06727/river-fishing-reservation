import type { Metadata } from "next";
import Link from "next/link";
import { findPublishedBlogPostsList } from "@/lib/repositories/blog.repository";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "ブログ" };

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  let blogPosts: Awaited<ReturnType<typeof findPublishedBlogPostsList>> = [];
  try {
    blogPosts = await findPublishedBlogPostsList();
  } catch (error) {
    console.error("[BlogPage]", error instanceof Error ? error.message : error);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">ブログ</h1>
      <p className="mt-2 text-sm text-muted">お知らせ・釣りTips</p>

      {blogPosts.length === 0 ? (
        <p className="mt-8 text-sm text-muted">公開中の記事はありません。</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {blogPosts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30"
              >
                {post.published_at && (
                  <time className="text-xs text-muted">
                    {formatDate(post.published_at.slice(0, 10))}
                  </time>
                )}
                <h2 className="mt-1 font-semibold">{post.title}</h2>
                {post.excerpt && (
                  <p className="mt-2 text-sm text-muted">{post.excerpt}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

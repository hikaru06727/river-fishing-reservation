import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return { title: post?.title ?? "ブログ記事" };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, published_at, content")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!post) {
    notFound();
  }

  return (
    <article>
      <Link href="/blog" className="text-sm text-primary hover:underline">
        ← ブログ一覧
      </Link>
      {post.published_at && (
        <time className="mt-4 block text-sm text-muted">
          {formatDate(post.published_at.slice(0, 10))}
        </time>
      )}
      <h1 className="mt-2 text-2xl font-bold">{post.title}</h1>
      <div className="mt-8 whitespace-pre-wrap leading-relaxed text-foreground">
        {post.content}
      </div>
    </article>
  );
}

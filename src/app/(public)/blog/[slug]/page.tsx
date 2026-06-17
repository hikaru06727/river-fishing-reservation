import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findPublishedBlogPostDetailBySlug,
  findPublishedBlogPostTitleBySlug,
} from "@/lib/repositories/blog.repository";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const title = await findPublishedBlogPostTitleBySlug(slug);
    return { title: title ?? "ブログ記事" };
  } catch (error) {
    console.error("[BlogPostPage metadata]", error instanceof Error ? error.message : error);
    return { title: "ブログ記事" };
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  let post: Awaited<ReturnType<typeof findPublishedBlogPostDetailBySlug>> = null;
  try {
    post = await findPublishedBlogPostDetailBySlug(slug);
  } catch (error) {
    console.error("[BlogPostPage]", error instanceof Error ? error.message : error);
  }

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

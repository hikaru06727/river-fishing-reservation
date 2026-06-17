import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BlogPost, ContentStatus } from "@/types/database";

export type BlogPostListItem = Pick<
  BlogPost,
  "slug" | "title" | "excerpt" | "published_at"
>;

export type BlogPostDetail = Pick<BlogPost, "title" | "published_at" | "content">;

export type BlogPostsPaginatedResult = {
  rows: BlogPost[];
  totalCount: number;
};

/** 公開ブログ一覧（ページ用） */
export async function findPublishedBlogPostsList(): Promise<BlogPostListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** メタデータ用タイトル */
export async function findPublishedBlogPostTitleBySlug(
  slug: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blog_posts")
    .select("title")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.title ?? null;
}

/** 公開記事詳細（ページ用） */
export async function findPublishedBlogPostDetailBySlug(
  slug: string,
): Promise<BlogPostDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blog_posts")
    .select("title, published_at, content")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** 公開ブログ一覧（API・ページネーション） */
export async function findPublishedBlogPostsPaginated(
  offset: number,
  limit: number,
): Promise<BlogPostsPaginatedResult> {
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("blog_posts")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: data ?? [],
    totalCount: count ?? 0,
  };
}

/** 公開記事全文（API・slug 指定） */
export async function findPublishedBlogPostFullBySlug(
  slug: string,
): Promise<BlogPost | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error) {
    return null;
  }

  return data;
}

export type InsertBlogPostAdminInput = {
  author_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: ContentStatus;
  published_at: string | null;
};

/** 管理画面: ブログ記事作成（service_role） */
export async function insertBlogPostAdmin(input: InsertBlogPostAdminInput): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("blog_posts").insert({
    author_id: input.author_id,
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    content: input.content,
    status: input.status,
    published_at: input.published_at,
  });

  if (error) {
    throw new Error(error.message);
  }
}

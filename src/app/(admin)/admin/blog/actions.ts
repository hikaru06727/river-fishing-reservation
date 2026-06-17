"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { blogPostSchema } from "@/validations/reservation";

export async function createBlogPost(formData: FormData) {
  const session = await getAuthenticatedManagement();
  if (!session) {
    throw new Error("Forbidden");
  }
  const { user } = session;

  const parsed = blogPostSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt") ?? undefined,
    content: formData.get("content"),
    published: formData.get("published") === "on",
  });

  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    throw new Error(firstError ?? "入力エラー");
  }

  const { title, slug, excerpt, content, published } = parsed.data;
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("blog_posts").insert({
    author_id: user.id,
    title,
    slug,
    excerpt: excerpt ?? null,
    content,
    status: published ? "published" : "draft",
    published_at: published ? now : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  redirect("/admin/blog");
}

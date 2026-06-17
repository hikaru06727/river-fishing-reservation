import { NextResponse } from "next/server";
import { findPublishedBlogPostFullBySlug } from "@/lib/repositories/blog.repository";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  const post = await findPublishedBlogPostFullBySlug(slug);

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ post });
}

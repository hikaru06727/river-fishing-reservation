import { NextResponse } from "next/server";

/** 旧 URL (/callback) → /auth/callback へ転送 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/auth/callback";
  return NextResponse.redirect(url);
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 開発専用: 管理者ユーザーの Auth パスワードを設定する API。
 * profiles.role の変更は行わない（set-role API を使用）。
 *
 * - NODE_ENV=production では常に 403
 * - ADMIN_SECRET 未設定時も 403
 */
function isDevSetPasswordApiEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return Boolean(process.env.ADMIN_SECRET);
}

export async function POST(request: Request) {
  if (!isDevSetPasswordApiEnabled()) {
    return NextResponse.json(
      { error: "This endpoint is disabled in production or when ADMIN_SECRET is unset" },
      { status: 403 },
    );
  }

  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string; password?: string };
  const { userId, password } = body;

  if (!userId || !password) {
    return NextResponse.json({ error: "userId and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId });
}

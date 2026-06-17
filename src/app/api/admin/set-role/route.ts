import { NextResponse } from "next/server";
import { DB_USER_ROLES } from "@/lib/auth/role";
import {
  getDevAdminApiGateDebug,
  isDevAdminApiEnabled,
  logDevAdminApiGateDenied,
  logDevAdminSecretRejected,
  validateDevAdminSecret,
} from "@/lib/dev/dev-admin-api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

/**
 * 開発専用: profiles.role を更新する API。
 * 権限の Single Source of Truth は profiles.role（RLS の is_admin() と一致）。
 *
 * - Vercel 上では常に 403
 * - ADMIN_SECRET 未設定時も 403
 * - user_metadata は更新しない
 */
const ROUTE_LABEL = "admin/set-role";

export async function POST(request: Request) {
  const gateDebug = getDevAdminApiGateDebug();

  if (!isDevAdminApiEnabled()) {
    logDevAdminApiGateDenied(ROUTE_LABEL, gateDebug);
    return NextResponse.json(
      {
        error: "This endpoint is disabled on hosted environments or when ADMIN_SECRET is unset",
        debug: gateDebug,
      },
      { status: 403 },
    );
  }

  const secretValidation = validateDevAdminSecret(request);
  if (!secretValidation.ok) {
    logDevAdminSecretRejected(ROUTE_LABEL, secretValidation);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string; role?: string };
  const { userId, role = "admin" } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (!DB_USER_ROLES.includes(role as UserRole)) {
    return NextResponse.json(
      { error: `role must be one of: ${DB_USER_ROLES.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ role: role as UserRole, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId, role, source: "profiles.role" });
}

import { NextResponse } from "next/server";
import {
  getDevAdminApiGateDebug,
  isDevAdminApiEnabled,
  logDevAdminApiGateDenied,
  logDevAdminSecretRejected,
  validateDevAdminSecret,
} from "@/lib/dev/dev-admin-api";
import {
  getAdminNotificationEmail,
  getEmailConfigStatus,
  getEmailSkipMessage,
} from "@/lib/email/config";
import { sendEmail } from "@/lib/email/send-email";

const ROUTE_LABEL = "send-test-email";

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
    return NextResponse.json(
      {
        error: "Forbidden",
        debug: {
          hasHeader: secretValidation.hasHeader,
          secretMatches: secretValidation.secretMatches,
        },
      },
      { status: 403 },
    );
  }

  let body: { to?: string } = {};
  try {
    body = (await request.json()) as { to?: string };
  } catch {
    body = {};
  }

  const to = body.to?.trim() || getAdminNotificationEmail();
  if (!to) {
    return NextResponse.json(
      { error: "Provide body.to or set ADMIN_NOTIFICATION_EMAIL" },
      { status: 400 },
    );
  }

  const result = await sendEmail({
    to,
    subject: "メール送信テスト",
    text: "river-fishing-reservation のメール送信基盤テストです。",
    html: "<p>river-fishing-reservation のメール送信基盤テストです。</p>",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const config = getEmailConfigStatus();

  return NextResponse.json({
    ok: true,
    skipped: result.skipped ?? false,
    skipReason: result.skipReason ?? config.skipReason,
    hint:
      result.skipped && (result.skipReason ?? config.skipReason)
        ? getEmailSkipMessage(result.skipReason ?? config.skipReason!)
        : undefined,
    config,
    id: result.id,
    to,
  });
}

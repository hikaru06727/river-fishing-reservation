import { NextResponse } from "next/server";
import { getAdminNotificationEmail } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/send-email";

function isDevSendTestEmailEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return Boolean(process.env.ADMIN_SECRET);
}

export async function POST(request: Request) {
  if (!isDevSendTestEmailEnabled()) {
    return NextResponse.json(
      { error: "This endpoint is disabled in production or when ADMIN_SECRET is unset" },
      { status: 403 },
    );
  }

  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  return NextResponse.json({
    ok: true,
    skipped: result.skipped ?? false,
    id: result.id,
    to,
  });
}

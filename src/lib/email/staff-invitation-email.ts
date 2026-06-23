import { logEmailHandlerResult } from "@/lib/email/log-send-result";
import { sendEmail } from "@/lib/email/send-email";

export type StaffInvitationEmailInput = {
  staffMemberId: string;
  staffEmail: string;
  staffName: string | null;
  businessName: string;
  invitedByName: string | null;
};

export async function sendStaffInvitationEmail(
  input: StaffInvitationEmailInput,
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const joinUrl = `${appUrl}/staff/join?id=${input.staffMemberId}`;
  const nameLabel = input.staffName ? `${input.staffName} 様` : "スタッフの方";
  const inviterLabel = input.invitedByName ?? "管理者";

  const text = [
    `${nameLabel}`,
    "",
    `${inviterLabel}より「${input.businessName}」のスタッフとして招待されました。`,
    "",
    "以下のリンクからアカウントを作成・ログインして招待を受諾してください。",
    "",
    joinUrl,
    "",
    "このリンクは一度のみ有効です。",
    "心当たりのない場合は、このメールを無視してください。",
  ].join("\n");

  const html = `
<p>${nameLabel}</p>
<p>${inviterLabel}より「<strong>${input.businessName}</strong>」のスタッフとして招待されました。</p>
<p>以下のボタンからアカウントを作成・ログインして招待を受諾してください。</p>
<p>
  <a href="${joinUrl}" style="display:inline-block;background:#1a56db;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
    招待を受諾する
  </a>
</p>
<p style="font-size:12px;color:#666;">
  リンク: <a href="${joinUrl}">${joinUrl}</a><br>
  このリンクは一度のみ有効です。心当たりのない場合は無視してください。
</p>
`.trim();

  const result = await sendEmail({
    to: input.staffEmail,
    subject: `【スタッフ招待】${input.businessName} からの招待`,
    text,
    html,
  });

  logEmailHandlerResult("sendStaffInvitationEmail", "招待メール", result, {
    to: input.staffEmail,
    subject: `【スタッフ招待】${input.businessName} からの招待`,
  });
}

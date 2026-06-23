import Link from "next/link";
import { getUser } from "@/lib/auth/get-user";
import { findStaffMemberById } from "@/lib/repositories/staff-members.repository";
import { findBusinessNamesByIds } from "@/lib/repositories/businesses.repository";
import { StaffJoinForm } from "@/components/staff/StaffJoinForm";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function StaffJoinPage({ searchParams }: PageProps) {
  const { id } = await searchParams;

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-xl border border-border p-8 text-center">
          <p className="text-sm text-red-600">招待リンクが無効です。</p>
          <Link href="/" className="mt-4 block text-sm text-primary hover:underline">
            トップへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const member = await findStaffMemberById(id).catch(() => null);

  if (!member) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-xl border border-border p-8 text-center">
          <p className="text-sm text-red-600">招待が見つかりません。リンクが無効か期限切れです。</p>
          <Link href="/" className="mt-4 block text-sm text-primary hover:underline">
            トップへ戻る
          </Link>
        </div>
      </div>
    );
  }

  if (member.status !== "invited") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-xl border border-border p-8 text-center">
          <p className="text-sm text-muted">
            {member.status === "active"
              ? "この招待はすでに受諾済みです。"
              : "この招待は無効化されています。"}
          </p>
          <Link href="/admin/pos" className="mt-4 block text-sm text-primary hover:underline">
            管理画面へ
          </Link>
        </div>
      </div>
    );
  }

  const businessNames = await findBusinessNamesByIds([member.business_id]).catch(() => []);
  const businessName = businessNames[0] ?? "不明な事業";

  const user = await getUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8">
        <h1 className="text-xl font-bold text-foreground">スタッフ招待の受諾</h1>
        <p className="mt-3 text-sm text-muted">
          <span className="font-medium text-foreground">{businessName}</span>{" "}
          からスタッフとして招待されました。
        </p>
        {member.name && (
          <p className="mt-1 text-sm text-muted">
            招待先: <span className="font-medium">{member.name}</span> さん (
            {member.email})
          </p>
        )}

        {!user ? (
          <div className="mt-6">
            <p className="text-sm text-muted">
              招待を受諾するには、まずログインまたはアカウントを作成してください。
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/login?next=/staff/join?id=${id}`}
                className="block rounded-lg bg-primary px-4 py-2 text-center text-sm text-white hover:bg-primary/90"
              >
                ログインして受諾
              </Link>
              <Link
                href={`/signup?next=/staff/join?id=${id}`}
                className="block rounded-lg border border-border px-4 py-2 text-center text-sm hover:bg-slate-50"
              >
                新規登録して受諾
              </Link>
            </div>
          </div>
        ) : (
          <StaffJoinForm staffMemberId={id} invitedEmail={member.email} userEmail={user.email ?? ""} />
        )}
      </div>
    </div>
  );
}

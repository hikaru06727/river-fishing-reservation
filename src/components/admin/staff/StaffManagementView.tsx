"use client";

import { useActionState } from "react";
import type { StaffMemberRow } from "@/types/database";
import type { ManageableBusinessRow } from "@/lib/repositories/businesses.repository";
import { inviteStaffAction, disableStaffAction, enableStaffAction } from "@/app/(admin)/admin/staff/actions";
import type { StaffActionState } from "@/app/(admin)/admin/staff/actions";

const STATUS_LABELS: Record<string, string> = {
  invited: "招待中",
  active: "有効",
  disabled: "無効",
};

const STATUS_COLORS: Record<string, string> = {
  invited: "text-yellow-700 bg-yellow-50 border-yellow-200",
  active: "text-green-700 bg-green-50 border-green-200",
  disabled: "text-slate-500 bg-slate-50 border-slate-200",
};

function InviteForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState<StaffActionState, FormData>(
    inviteStaffAction,
    {},
  );

  return (
    <form action={action} className="mt-6 rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">スタッフを招待</h3>
      <input type="hidden" name="businessId" value={businessId} />
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="invite-email" className="block text-xs font-medium text-muted">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="staff@example.com"
          />
        </div>
        <div>
          <label htmlFor="invite-name" className="block text-xs font-medium text-muted">
            名前（任意）
          </label>
          <input
            id="invite-name"
            name="name"
            type="text"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="山田 太郎"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "送信中..." : "招待メールを送信"}
          </button>
        </div>
      </div>
      {state.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="mt-2 text-sm text-green-600">{state.success}</p>
      )}
    </form>
  );
}

function StaffStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_COLORS[status] ?? ""}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function StaffActions({ member }: { member: StaffMemberRow }) {
  const [disableState, disableAction, disablePending] = useActionState<StaffActionState, FormData>(
    disableStaffAction,
    {},
  );
  const [enableState, enableAction, enablePending] = useActionState<StaffActionState, FormData>(
    enableStaffAction,
    {},
  );

  if (member.status === "invited") {
    return (
      <form action={disableAction}>
        <input type="hidden" name="staffMemberId" value={member.id} />
        <button
          type="submit"
          disabled={disablePending}
          className="text-xs text-red-500 hover:underline disabled:opacity-50"
        >
          招待取消
        </button>
        {disableState.error && <p className="text-xs text-red-600">{disableState.error}</p>}
      </form>
    );
  }

  if (member.status === "active") {
    return (
      <form action={disableAction}>
        <input type="hidden" name="staffMemberId" value={member.id} />
        <button
          type="submit"
          disabled={disablePending}
          className="text-xs text-red-500 hover:underline disabled:opacity-50"
        >
          無効化
        </button>
        {disableState.error && <p className="text-xs text-red-600">{disableState.error}</p>}
      </form>
    );
  }

  if (member.status === "disabled") {
    return (
      <form action={enableAction}>
        <input type="hidden" name="staffMemberId" value={member.id} />
        <button
          type="submit"
          disabled={enablePending}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          再有効化
        </button>
        {enableState.error && <p className="text-xs text-red-600">{enableState.error}</p>}
      </form>
    );
  }

  return null;
}

type Props = {
  businesses: ManageableBusinessRow[];
  staffMembers: StaffMemberRow[];
  selectedBusinessId?: string;
  selectedBusinessName?: string;
};

export function StaffManagementView({
  businesses,
  staffMembers,
  selectedBusinessId,
  selectedBusinessName,
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">スタッフ管理</h2>
      </div>

      {businesses.length > 1 && (
        <form method="get" action="/admin/staff" className="mt-4">
          <label htmlFor="businessId" className="block text-sm font-medium">
            事業を選択
          </label>
          <div className="mt-1 flex items-center gap-2">
            <select
              name="businessId"
              id="businessId"
              defaultValue={selectedBusinessId ?? ""}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              <option value="">-- 事業を選択 --</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50"
            >
              表示
            </button>
          </div>
        </form>
      )}

      {!selectedBusinessId && (
        <p className="mt-4 text-sm text-muted">
          {businesses.length === 0
            ? "操作可能な事業がありません。"
            : "事業を選択してスタッフを表示します。"}
        </p>
      )}

      {selectedBusinessId && (
        <>
          {selectedBusinessName && (
            <p className="mt-4 text-sm text-muted">
              事業:{" "}
              <span className="font-medium text-foreground">{selectedBusinessName}</span>
            </p>
          )}

          <InviteForm businessId={selectedBusinessId} />

          <div className="mt-6">
            {staffMembers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
                スタッフが登録されていません。
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <th className="px-4 py-3 text-left font-medium">名前</th>
                      <th className="px-4 py-3 text-left font-medium">メールアドレス</th>
                      <th className="px-4 py-3 text-center font-medium">ステータス</th>
                      <th className="px-4 py-3 text-left font-medium">招待日</th>
                      <th className="px-4 py-3 text-left font-medium">参加日</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffMembers.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">{m.name ?? "—"}</td>
                        <td className="px-4 py-3">{m.email}</td>
                        <td className="px-4 py-3 text-center">
                          <StaffStatusBadge status={m.status} />
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {m.invited_at
                            ? new Date(m.invited_at).toLocaleDateString("ja-JP")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {m.joined_at
                            ? new Date(m.joined_at).toLocaleDateString("ja-JP")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <StaffActions member={m} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

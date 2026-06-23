"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { acceptStaffInvitationAction } from "@/app/staff/join/actions";
import type { JoinActionState } from "@/app/staff/join/actions";

type Props = {
  staffMemberId: string;
  invitedEmail: string;
  userEmail: string;
};

export function StaffJoinForm({ staffMemberId, invitedEmail, userEmail }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<JoinActionState, FormData>(
    acceptStaffInvitationAction,
    {},
  );

  useEffect(() => {
    if (state.success) {
      router.push("/admin/pos");
      router.refresh();
    }
  }, [state.success, router]);

  const emailMismatch =
    invitedEmail.toLowerCase() !== userEmail.toLowerCase();

  return (
    <div className="mt-6">
      {emailMismatch ? (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm text-yellow-800">
            現在ログイン中のメールアドレス（<strong>{userEmail}</strong>）が招待先のメールアドレス（<strong>{invitedEmail}</strong>）と一致しません。
          </p>
          <p className="mt-2 text-sm text-yellow-700">
            招待を受諾するには、招待先のメールアドレスでログインしてください。
          </p>
        </div>
      ) : (
        <form action={action}>
          <input type="hidden" name="staffMemberId" value={staffMemberId} />
          <p className="text-sm text-muted">
            ログイン中のアカウント: <strong>{userEmail}</strong>
          </p>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "処理中..." : "招待を受諾してスタッフになる"}
          </button>
          {state.error && (
            <p className="mt-2 text-sm text-red-600">{state.error}</p>
          )}
        </form>
      )}
    </div>
  );
}

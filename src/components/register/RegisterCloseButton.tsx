"use client";

import { useActionState } from "react";
import { closeRegisterAction } from "@/app/(admin)/admin/register-closing/actions";
import {
  registerClosingInitialState,
  type RegisterClosingActionState,
} from "@/app/(admin)/admin/register-closing/action-state";

interface RegisterCloseButtonProps {
  businessId: string;
  periodStart: string;
  periodEnd: string;
}

export function RegisterCloseButton({
  businessId,
  periodStart,
  periodEnd,
}: RegisterCloseButtonProps) {
  const [state, formAction, pending] = useActionState<RegisterClosingActionState, FormData>(
    closeRegisterAction,
    registerClosingInitialState,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const startLabel = new Date(periodStart).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const endLabel = new Date(periodEnd).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const confirmed = window.confirm(
      `以下の期間でレジを締めますか？\n\n期間: ${startLabel} 〜 ${endLabel}\n\n一度締めると変更できません。`,
    );
    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <div>
      <form action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="periodStart" value={periodStart} />
        <input type="hidden" name="periodEnd" value={periodEnd} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "処理中..." : "レジを締める"}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 text-sm text-green-600" role="status">
          {state.success}
        </p>
      )}
    </div>
  );
}

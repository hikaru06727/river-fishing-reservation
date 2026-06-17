"use client";

import { useActionState } from "react";
import { adminMarkCashPaymentReceivedAction } from "@/app/(admin)/admin/reservations/actions";
import { Button } from "@/components/ui/Button";
import { adminMarkCashPaymentReceivedInitialState } from "@/types/reservation-action";

interface AdminMarkCashPaymentReceivedButtonProps {
  reservationId: string;
  returnTo?: string;
}

export function AdminMarkCashPaymentReceivedButton({
  reservationId,
  returnTo = "/admin/reservations",
}: AdminMarkCashPaymentReceivedButtonProps) {
  const [state, formAction, pending] = useActionState(
    adminMarkCashPaymentReceivedAction,
    adminMarkCashPaymentReceivedInitialState,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "この予約を現地で支払い済みにしますか？\nこの操作は取り消せません。",
    );
    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <div>
      <form action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {pending ? "処理中..." : "現地で支払い済みにする"}
        </Button>
      </form>
      {state.error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

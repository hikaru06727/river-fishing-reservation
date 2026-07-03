"use client";

import { useActionState } from "react";
import { adminConfirmOrderPickupAction } from "@/app/(admin)/admin/orders/actions";
import { Button } from "@/components/ui/Button";
import { adminConfirmOrderPickupInitialState } from "@/types/online-order-action";

interface AdminConfirmOrderPickupButtonProps {
  orderId: string;
  returnTo?: string;
}

export function AdminConfirmOrderPickupButton({
  orderId,
  returnTo = "/admin/orders",
}: AdminConfirmOrderPickupButtonProps) {
  const [state, formAction, pending] = useActionState(
    adminConfirmOrderPickupAction,
    adminConfirmOrderPickupInitialState,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "現地でお支払い・お渡しが完了したことを確認しますか？\n在庫が減算され、この操作は取り消せません。",
    );
    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <div>
      <form action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {pending ? "処理中..." : "受け取り確認"}
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

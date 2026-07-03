"use client";

import { useActionState } from "react";
import { adminAdvanceOrderStatusAction } from "@/app/(admin)/admin/orders/actions";
import { Button } from "@/components/ui/Button";
import { ONLINE_ORDER_STATUS_LABEL } from "@/lib/online-orders/labels";
import { adminAdvanceOrderStatusInitialState } from "@/types/online-order-action";
import type { OnlineOrderStatus } from "@/types/domain";

interface AdminAdvanceOrderStatusButtonProps {
  orderId: string;
  nextStatus: OnlineOrderStatus;
  returnTo?: string;
}

export function AdminAdvanceOrderStatusButton({
  orderId,
  nextStatus,
  returnTo = "/admin/orders",
}: AdminAdvanceOrderStatusButtonProps) {
  const [state, formAction, pending] = useActionState(
    adminAdvanceOrderStatusAction,
    adminAdvanceOrderStatusInitialState,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `ステータスを「${ONLINE_ORDER_STATUS_LABEL[nextStatus]}」に進めますか？`,
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
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "処理中..." : `${ONLINE_ORDER_STATUS_LABEL[nextStatus]}にする`}
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

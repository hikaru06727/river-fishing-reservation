"use client";

import { useActionState, useRef } from "react";
import { adminConfirmOrderPickupAction } from "@/app/(admin)/admin/orders/actions";
import { Button } from "@/components/ui/Button";
import { adminConfirmOrderPickupInitialState } from "@/types/online-order-action";

interface AdminConfirmOrderPickupButtonProps {
  orderId: string;
  returnTo?: string;
}

const PAYMENT_METHOD_CHOICES: Record<string, { value: string; label: string }> = {
  "1": { value: "cash", label: "現金" },
  "2": { value: "card", label: "クレジットカード" },
  "3": { value: "qr", label: "QRコード決済" },
};

export function AdminConfirmOrderPickupButton({
  orderId,
  returnTo = "/admin/orders",
}: AdminConfirmOrderPickupButtonProps) {
  const [state, formAction, pending] = useActionState(
    adminConfirmOrderPickupAction,
    adminConfirmOrderPickupInitialState,
  );
  const codeInputRef = useRef<HTMLInputElement>(null);
  const paymentMethodInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const code = window.prompt(
      "お客様に確認コード（6桁）を伺い、入力してください。\n入力後、在庫が減算され受け取り完了になります。",
    );
    if (!code || !code.trim()) {
      event.preventDefault();
      return;
    }

    const choice = window.prompt(
      "支払い方法を選択してください：\n1: 現金\n2: クレジットカード\n3: QRコード決済",
    );
    const paymentMethod = choice ? PAYMENT_METHOD_CHOICES[choice.trim()] : undefined;
    if (!paymentMethod) {
      event.preventDefault();
      return;
    }

    if (codeInputRef.current) {
      codeInputRef.current.value = code.trim();
    }
    if (paymentMethodInputRef.current) {
      paymentMethodInputRef.current.value = paymentMethod.value;
    }
  }

  return (
    <div>
      <form action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="confirmationCode" ref={codeInputRef} defaultValue="" />
        <input type="hidden" name="paymentMethod" ref={paymentMethodInputRef} defaultValue="" />
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

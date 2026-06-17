"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/format";
import type { PaymentMethod } from "@/lib/reservations/payment-method";
import {
  getPaymentMethodDescription,
  getPaymentMethodLabel,
  PAYMENT_METHODS,
} from "@/lib/reservations/payment-method";

interface PaymentMethodSelectorProps {
  value: PaymentMethod | "";
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
  name?: string;
}

export function PaymentMethodSelector({
  value,
  onChange,
  disabled = false,
  name = "paymentMethod",
}: PaymentMethodSelectorProps) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium">お支払い方法</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {PAYMENT_METHODS.map((method) => {
          const selected = value === method;
          return (
            <label
              key={method}
              className={cn(
                "cursor-pointer rounded-xl border p-4 transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-slate-50",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name={name}
                value={method}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(method)}
                className="sr-only"
                required
              />
              <span className="block text-sm font-semibold text-foreground">
                {getPaymentMethodLabel(method)}
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-muted">
                {getPaymentMethodDescription(method)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** フォーム state 用 hook（DB migration 後に ReserveForm へ接続） */
export function usePaymentMethodSelection(initial: PaymentMethod | "" = "") {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(initial);
  const isValid = paymentMethod !== "";
  return { paymentMethod, setPaymentMethod, isValid };
}

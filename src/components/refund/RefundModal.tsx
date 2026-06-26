"use client";

import { useActionState, useState } from "react";
import { refundCashAction, refundCardAction } from "@/app/(admin)/admin/refunds/actions";
import {
  refundInitialState,
  type RefundActionState,
} from "@/app/(admin)/admin/refunds/action-state";

export type RefundTarget =
  | { type: "saleSession"; id: string }
  | { type: "reservation"; id: string; stripePaymentIntentId?: string | null };

interface RefundModalProps {
  businessId: string;
  target: RefundTarget;
  maxAmount: number;
  onClose: () => void;
}

export function RefundModal({ businessId, target, maxAmount, onClose }: RefundModalProps) {
  const [amount, setAmount] = useState(String(maxAmount));
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<"cash" | "card">("cash");

  const [cashState, cashAction, cashPending] = useActionState<RefundActionState, FormData>(
    refundCashAction,
    refundInitialState,
  );
  const [cardState, cardAction, cardPending] = useActionState<RefundActionState, FormData>(
    refundCardAction,
    refundInitialState,
  );

  const pending = cashPending || cardPending;
  const state = method === "cash" ? cashState : cardState;
  const formAction = method === "cash" ? cashAction : cardAction;

  const hasStripe =
    target.type === "reservation" && !!target.stripePaymentIntentId;
  const amountNum = parseFloat(amount);
  const isValid = !isNaN(amountNum) && amountNum > 0 && amountNum <= maxAmount && reason.trim();

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">返金する</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="businessId" value={businessId} />
          {target.type === "saleSession" && (
            <input type="hidden" name="saleSessionId" value={target.id} />
          )}
          {target.type === "reservation" && (
            <>
              <input type="hidden" name="reservationId" value={target.id} />
              {target.stripePaymentIntentId && (
                <input
                  type="hidden"
                  name="stripePaymentIntentId"
                  value={target.stripePaymentIntentId}
                />
              )}
            </>
          )}

          {/* 返金方法 */}
          <div>
            <p className="text-xs font-medium text-foreground">返金方法</p>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => setMethod("cash")}
                className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
                  method === "cash"
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white hover:bg-slate-50"
                }`}
              >
                現金
              </button>
              <button
                type="button"
                onClick={() => setMethod("card")}
                className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
                  method === "card"
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white hover:bg-slate-50"
                }`}
              >
                カード{hasStripe ? "" : "（手動）"}
              </button>
            </div>
            {method === "card" && !hasStripe && (
              <p className="mt-1 text-xs text-muted">
                Stripe連携がないため記録のみ行います。
              </p>
            )}
          </div>

          {/* 返金額 */}
          <div>
            <label className="block text-xs font-medium text-foreground">
              返金額（最大 ¥{maxAmount.toLocaleString()}）
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                ¥
              </span>
              <input
                type="number"
                name="amount"
                min={1}
                max={maxAmount}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-lg border border-border pl-7 pr-3 py-2 text-sm outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* 返金理由 */}
          <div>
            <label className="block text-xs font-medium text-foreground">返金理由</label>
            <textarea
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={2}
              placeholder="例：商品不良・お客様都合"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          {state.error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              {state.success}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={pending || !isValid}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "処理中..." : "返金する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

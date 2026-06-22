"use client";

import { useActionState } from "react";
import { manualSaleInitialState, type ManualSaleActionState } from "@/app/(admin)/admin/manual-sales/action-state";
import type { ManageableBusinessRow, ManageableSpotRow } from "@/lib/repositories/businesses.repository";
import type { ManualSale } from "@/types/database";

const CATEGORIES = [
  { value: "bait", label: "餌" },
  { value: "rental", label: "レンタル" },
  { value: "parking", label: "駐車場" },
  { value: "food", label: "飲食" },
  { value: "event", label: "イベント" },
  { value: "other", label: "その他" },
] as const;

const PAYMENT_METHODS = [
  { value: "cash", label: "現金" },
  { value: "card", label: "カード" },
  { value: "qr", label: "QR" },
  { value: "other", label: "その他" },
] as const;

interface ManualSaleFormProps {
  action: (prevState: ManualSaleActionState, formData: FormData) => Promise<ManualSaleActionState>;
  businesses: ManageableBusinessRow[];
  locations: ManageableSpotRow[];
  currentTaxRate: number;
  sale?: ManualSale;
  defaultBusinessId?: string;
  submitLabel: string;
}

export function ManualSaleForm({
  action,
  businesses,
  locations,
  currentTaxRate,
  sale,
  defaultBusinessId,
  submitLabel,
}: ManualSaleFormProps) {
  const [state, formAction, pending] = useActionState(action, manualSaleInitialState);

  const inputClass =
    "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const selectClass =
    "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white";

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-4">
      {sale && <input type="hidden" name="id" value={sale.id} />}

      <div>
        <label htmlFor="businessId" className="block text-sm font-medium">
          事業 <span className="text-red-600">*</span>
        </label>
        {businesses.length === 1 ? (
          <>
            <input type="hidden" name="businessId" value={businesses[0].id} />
            <p className="mt-1 px-1 text-sm text-foreground">{businesses[0].name}</p>
          </>
        ) : (
          <select
            id="businessId"
            name="businessId"
            required
            defaultValue={sale?.business_id ?? defaultBusinessId ?? ""}
            className={selectClass}
          >
            <option value="">-- 選択してください --</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label htmlFor="locationId" className="block text-sm font-medium">
          釣り場（任意）
        </label>
        <select
          id="locationId"
          name="locationId"
          defaultValue={sale?.location_id ?? ""}
          className={selectClass}
        >
          <option value="">-- なし --</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="saleDate" className="block text-sm font-medium">
          売上日 <span className="text-red-600">*</span>
        </label>
        <input
          id="saleDate"
          name="saleDate"
          type="date"
          required
          defaultValue={sale?.sale_date ?? new Date().toISOString().split("T")[0]}
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="amountYen" className="block text-sm font-medium">
            金額（税抜）<span className="text-red-600">*</span>
          </label>
          <input
            id="amountYen"
            name="amountYen"
            type="number"
            min={0}
            required
            defaultValue={sale?.amount_yen ?? 0}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="taxRatePercent" className="block text-sm font-medium">
            税率（%） <span className="text-red-600">*</span>
          </label>
          <input
            id="taxRatePercent"
            name="taxRatePercent"
            type="number"
            min={0}
            max={100}
            required
            defaultValue={sale?.tax_rate_percent ?? currentTaxRate}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium">
            カテゴリ <span className="text-red-600">*</span>
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={sale?.category ?? ""}
            className={selectClass}
          >
            <option value="">-- 選択 --</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="paymentMethod" className="block text-sm font-medium">
            支払方法 <span className="text-red-600">*</span>
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            required
            defaultValue={sale?.payment_method ?? ""}
            className={selectClass}
          >
            <option value="">-- 選択 --</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          備考
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={sale?.description ?? ""}
          className="mt-1 w-full rounded-xl border border-border p-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {state.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "処理中..." : submitLabel}
      </button>
    </form>
  );
}

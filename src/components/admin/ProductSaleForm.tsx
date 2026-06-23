"use client";

import { useActionState } from "react";
import { productInitialState, type ProductActionState } from "@/app/(admin)/admin/products/action-state";
import type { ManageableBusinessRow } from "@/lib/repositories/businesses.repository";
import type { Product } from "@/types/database";

const PAYMENT_METHODS = [
  { value: "cash", label: "現金" },
  { value: "stripe", label: "Stripe（オンライン）" },
] as const;

interface ProductSaleFormProps {
  action: (prevState: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  businesses: ManageableBusinessRow[];
  products: Product[];
  defaultBusinessId?: string;
}

export function ProductSaleForm({
  action,
  businesses,
  products,
  defaultBusinessId,
}: ProductSaleFormProps) {
  const [state, formAction, pending] = useActionState(action, productInitialState);

  const inputClass =
    "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const selectClass =
    "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white";

  const onSaleProducts = products.filter((p) => p.status === "on_sale");

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-4">
      <div>
        <label htmlFor="businessId" className="block text-sm font-medium">
          事業 <span className="text-red-600">*</span>
        </label>
        {businesses.length === 1 ? (
          <>
            <input type="hidden" name="businessId" value={businesses[0]!.id} />
            <p className="mt-1 px-1 text-sm text-foreground">{businesses[0]!.name}</p>
          </>
        ) : (
          <select
            id="businessId"
            name="businessId"
            required
            defaultValue={defaultBusinessId ?? ""}
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
        <label htmlFor="productId" className="block text-sm font-medium">
          商品 <span className="text-red-600">*</span>
        </label>
        <select
          id="productId"
          name="productId"
          required
          defaultValue=""
          className={selectClass}
        >
          <option value="">-- 商品を選択 --</option>
          {onSaleProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（税抜 ¥{p.price_excluding_tax.toLocaleString()}
              {p.stock_quantity !== null ? ` / 在庫: ${p.stock_quantity}` : ""}）
            </option>
          ))}
        </select>
        {onSaleProducts.length === 0 && (
          <p className="mt-1 text-xs text-muted">販売中の商品がありません。</p>
        )}
      </div>

      <div>
        <label htmlFor="quantity" className="block text-sm font-medium">
          数量 <span className="text-red-600">*</span>
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          required
          defaultValue={1}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="paymentMethod" className="block text-sm font-medium">
          支払方法 <span className="text-red-600">*</span>
        </label>
        <select
          id="paymentMethod"
          name="paymentMethod"
          required
          defaultValue="cash"
          className={selectClass}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
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
        {pending ? "処理中..." : "販売を登録する"}
      </button>
    </form>
  );
}

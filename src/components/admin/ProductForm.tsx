"use client";

import { useActionState } from "react";
import { productInitialState, type ProductActionState } from "@/app/(admin)/admin/products/action-state";
import type { ManageableBusinessRow } from "@/lib/repositories/businesses.repository";
import type { Product } from "@/types/database";

const STATUS_OPTIONS = [
  { value: "on_sale", label: "販売中" },
  { value: "off_sale", label: "販売停止" },
  { value: "archived", label: "アーカイブ" },
] as const;

interface ProductFormProps {
  action: (prevState: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  businesses: ManageableBusinessRow[];
  product?: Product;
  defaultBusinessId?: string;
  submitLabel: string;
}

export function ProductForm({
  action,
  businesses,
  product,
  defaultBusinessId,
  submitLabel,
}: ProductFormProps) {
  const [state, formAction, pending] = useActionState(action, productInitialState);

  const inputClass =
    "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const selectClass =
    "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white";

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-4">
      {product && <input type="hidden" name="id" value={product.id} />}

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
            defaultValue={product?.business_id ?? defaultBusinessId ?? ""}
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
        <label htmlFor="name" className="block text-sm font-medium">
          商品名 <span className="text-red-600">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={product?.name ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          説明
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={product?.description ?? ""}
          className="mt-1 w-full rounded-xl border border-border p-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="priceExcludingTax" className="block text-sm font-medium">
            税抜き価格（円）<span className="text-red-600">*</span>
          </label>
          <input
            id="priceExcludingTax"
            name="priceExcludingTax"
            type="number"
            min={0}
            required
            defaultValue={product?.price_excluding_tax ?? 0}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="stockQuantity" className="block text-sm font-medium">
            在庫数
            <span className="ml-1 text-xs text-muted">（空白 = 無制限）</span>
          </label>
          <input
            id="stockQuantity"
            name="stockQuantity"
            type="number"
            min={0}
            defaultValue={product?.stock_quantity ?? ""}
            placeholder="空白で在庫無制限"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium">
          ステータス <span className="text-red-600">*</span>
        </label>
        <select
          id="status"
          name="status"
          required
          defaultValue={product?.status ?? "on_sale"}
          className={selectClass}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="imageUrl" className="block text-sm font-medium">
          画像URL
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="url"
          defaultValue={product?.image_url ?? ""}
          className={inputClass}
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

"use client";

import { useActionState } from "react";
import { productInitialState, type ProductActionState } from "@/app/(admin)/admin/products/action-state";
import type { Product } from "@/types/database";

const PAYMENT_METHODS = [
  { value: "cash", label: "現金" },
  { value: "stripe", label: "Stripe（オンライン）" },
] as const;

function localDatetimeNow(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

interface ProductSellFormProps {
  action: (prevState: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  product: Product;
  businessId: string;
}

export function ProductSellForm({ action, product, businessId }: ProductSellFormProps) {
  const [state, formAction, pending] = useActionState(action, productInitialState);

  const isOutOfStock = product.stock_quantity !== null && product.stock_quantity === 0;
  const maxQuantity = product.stock_quantity ?? undefined;

  const inputClass =
    "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const selectClass =
    "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="productId" value={product.id} />

      {/* 商品情報（読み取り専用） */}
      <div className="rounded-xl border border-border bg-slate-50 p-4 text-sm">
        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt className="text-muted">商品名</dt>
            <dd className="font-medium text-foreground">{product.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">税抜き単価</dt>
            <dd className="font-medium text-foreground">
              ¥{product.price_excluding_tax.toLocaleString()}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">在庫数</dt>
            <dd className={`font-medium ${isOutOfStock ? "text-red-600" : "text-foreground"}`}>
              {product.stock_quantity !== null ? product.stock_quantity.toLocaleString() : "無制限"}
              {isOutOfStock && " （在庫なし）"}
            </dd>
          </div>
        </dl>
      </div>

      {isOutOfStock && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          在庫がないため販売登録できません。
        </p>
      )}

      <div>
        <label htmlFor="quantity" className="block text-sm font-medium">
          数量 <span className="text-red-600">*</span>
          {maxQuantity !== undefined && (
            <span className="ml-1 text-xs font-normal text-muted">（最大 {maxQuantity}）</span>
          )}
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          max={maxQuantity}
          required
          defaultValue={1}
          disabled={isOutOfStock}
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
          disabled={isOutOfStock}
          className={selectClass}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="purchasedAt" className="block text-sm font-medium">
          販売日時 <span className="text-red-600">*</span>
        </label>
        <input
          id="purchasedAt"
          name="purchasedAt"
          type="datetime-local"
          required
          defaultValue={localDatetimeNow()}
          disabled={isOutOfStock}
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
        disabled={pending || isOutOfStock}
        className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "処理中..." : "販売を登録する"}
      </button>
    </form>
  );
}

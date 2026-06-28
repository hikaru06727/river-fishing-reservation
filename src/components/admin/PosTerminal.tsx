"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { posInitialState, type PosActionState } from "@/app/(admin)/admin/pos/action-state";
import { POS_PAYMENT_METHODS } from "@/validations/pos";
import type { Product } from "@/types/database";

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

type DiscountType = "amount" | "rate";

type ItemDiscount = { type: DiscountType; value: number } | null;

type CartItemSettings = {
  taxRate: number;
  discount: ItemDiscount;
};

type SessionDiscount = { type: DiscountType; value: number } | null;

type CartEntry = {
  product: Product;
  quantity: number;
  taxRate: number;
  gross: number;
  itemDiscountAmount: number;
  net: number;
};

type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number]["value"];

const STORAGE_KEY = (id: string) => `pos_cart_v2_${id}`;

// ─────────────────────────────────────
// Helper calculations
// ─────────────────────────────────────

function calcItemDiscount(gross: number, d: ItemDiscount): number {
  if (!d || d.value <= 0) return 0;
  if (d.type === "amount") return Math.min(Math.round(d.value), gross);
  return Math.floor((gross * d.value) / 100);
}

function calcSessionDiscount(base: number, d: SessionDiscount): number {
  if (!d || d.value <= 0) return 0;
  if (d.type === "amount") return Math.min(Math.round(d.value), base);
  return Math.floor((base * d.value) / 100);
}

function deriveCartEntries(
  cart: Map<string, number>,
  itemSettings: Map<string, CartItemSettings>,
  products: Product[],
): CartEntry[] {
  return Array.from(cart.entries())
    .map(([productId, quantity]) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;
      const settings = itemSettings.get(productId) ?? {
        taxRate: product.default_tax_rate ?? 10,
        discount: null,
      };
      const gross = quantity * product.price_excluding_tax;
      const itemDiscountAmount = calcItemDiscount(gross, settings.discount);
      const net = gross - itemDiscountAmount;
      return {
        product,
        quantity,
        taxRate: settings.taxRate,
        gross,
        itemDiscountAmount,
        net,
        settings,
      };
    })
    .filter(Boolean) as CartEntry[];
}

function deriveTotals(entries: CartEntry[], sessionDiscount: SessionDiscount) {
  const grossSubtotal = entries.reduce((s, e) => s + e.gross, 0);
  const totalItemDiscounts = entries.reduce((s, e) => s + e.itemDiscountAmount, 0);
  const afterItemDiscounts = grossSubtotal - totalItemDiscounts;
  const sessionDiscountAmt = calcSessionDiscount(afterItemDiscounts, sessionDiscount);
  const totalDiscountAmount = totalItemDiscounts + sessionDiscountAmt;
  const finalNet = afterItemDiscounts - sessionDiscountAmt;

  let taxAmount = 0;
  if (afterItemDiscounts > 0) {
    for (const e of entries) {
      const proportion = e.net / afterItemDiscounts;
      const itemSessionDiscount = Math.floor(sessionDiscountAmt * proportion);
      const itemFinalNet = Math.max(0, e.net - itemSessionDiscount);
      taxAmount += Math.floor((itemFinalNet * e.taxRate) / 100);
    }
  }

  return {
    grossSubtotal,
    totalDiscountAmount,
    sessionDiscountAmt,
    finalNet,
    taxAmount,
    totalAmount: finalNet + taxAmount,
  };
}

// ─────────────────────────────────────
// Sub-components
// ─────────────────────────────────────

function DiscountInput({
  label,
  discount,
  onSave,
  onClose,
}: {
  label: string;
  discount: { type: DiscountType; value: number } | null;
  onSave: (d: { type: DiscountType; value: number } | null) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<DiscountType>(discount?.type ?? "amount");
  const [value, setValue] = useState(String(discount?.value ?? ""));

  const handleSave = () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      onSave(null);
    } else {
      onSave({ type, value: num });
    }
    onClose();
  };

  const handleClear = () => {
    onSave(null);
    onClose();
  };

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-foreground">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("amount")}
          className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
            type === "amount"
              ? "border-primary bg-primary text-white"
              : "border-border bg-white text-foreground hover:bg-slate-50"
          }`}
        >
          金額引き（円）
        </button>
        <button
          type="button"
          onClick={() => setType("rate")}
          className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
            type === "rate"
              ? "border-primary bg-primary text-white"
              : "border-border bg-white text-foreground hover:bg-slate-50"
          }`}
        >
          率引き（%）
        </button>
      </div>
      <input
        type="number"
        min={0}
        step={type === "amount" ? 1 : 0.1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={type === "amount" ? "例：500" : "例：10"}
        className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="mt-3 flex gap-2">
        {discount && (
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 rounded-lg border border-red-300 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            割引削除
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90"
        >
          設定
        </button>
      </div>
    </div>
  );
}

function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted hover:text-foreground"
          aria-label="閉じる"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// Main component
// ─────────────────────────────────────

interface PosTerminalProps {
  action: (prev: PosActionState, data: FormData) => Promise<PosActionState>;
  products: Product[];
  businessId: string;
  taxRatePercent: number;
  salesCounts: Record<string, number>;
}

export function PosTerminal({
  action,
  products,
  businessId,
  taxRatePercent,
  salesCounts,
}: PosTerminalProps) {
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [itemSettings, setItemSettings] = useState<Map<string, CartItemSettings>>(new Map());
  const [sessionDiscount, setSessionDiscount] = useState<SessionDiscount>(null);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [paymentOtherLabel, setPaymentOtherLabel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState<string | null>(null);
  const [showSessionDiscountModal, setShowSessionDiscountModal] = useState(false);
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [state, formAction, pending] = useActionState(action, posInitialState);
  const formRef = useRef<HTMLFormElement>(null);

  // localStorage restore on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(businessId));
      if (raw) {
        const data = JSON.parse(raw);
        if (data.cart) setCart(new Map(data.cart as [string, number][]));
        if (data.itemSettings) setItemSettings(new Map(data.itemSettings as [string, CartItemSettings][]));
        if (data.sessionDiscount !== undefined) setSessionDiscount(data.sessionDiscount);
        if (data.paymentMethod) setPaymentMethod(data.paymentMethod);
        if (data.paymentOtherLabel) setPaymentOtherLabel(data.paymentOtherLabel);
        if (data.note) setNote(data.note);
      }
    } catch {}
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // localStorage sync
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY(businessId),
        JSON.stringify({
          cart: Array.from(cart.entries()),
          itemSettings: Array.from(itemSettings.entries()),
          sessionDiscount,
          paymentMethod,
          paymentOtherLabel,
          note,
        }),
      );
    } catch {}
  }, [businessId, cart, itemSettings, sessionDiscount, paymentMethod, paymentOtherLabel, note, hydrated]);

  // ── Cart operations ──
  const setQuantity = (productId: string, qty: number, maxQty: number | null) => {
    if (qty <= 0) {
      const next = new Map(cart);
      next.delete(productId);
      setCart(next);
    } else {
      const capped = maxQty !== null ? Math.min(qty, maxQty) : qty;
      setCart(new Map(cart).set(productId, capped));
    }
  };

  const clearCart = () => {
    setCart(new Map());
    setItemSettings(new Map());
    setSessionDiscount(null);
    setNote("");
    try { localStorage.removeItem(STORAGE_KEY(businessId)); } catch {}
  };

  // ── Derived data ──
  const cartEntries = deriveCartEntries(cart, itemSettings, products);
  const totals = deriveTotals(cartEntries, sessionDiscount);
  const isCartEmpty = cartEntries.length === 0;

  // ── Sorted & filtered products ──
  const sortedProducts = [...products].sort(
    (a, b) => (salesCounts[b.id] ?? 0) - (salesCounts[a.id] ?? 0),
  );

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[]))];

  const filteredProducts = sortedProducts.filter((p) => {
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // ── Serialised form values ──
  const itemsJson = JSON.stringify(
    cartEntries.map((e) => {
      const settings = itemSettings.get(e.product.id);
      return {
        product_id: e.product.id,
        quantity: e.quantity,
        tax_rate: settings?.taxRate ?? (e.product.default_tax_rate ?? 10),
        item_discount: settings?.discount ?? null,
      };
    }),
  );

  const sessionDiscountJson = sessionDiscount ? JSON.stringify(sessionDiscount) : "";

  const modalProduct = showItemModal ? products.find((p) => p.id === showItemModal) : null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ── 商品グリッド ── */}
      <div className="flex-1 min-w-0">
        {/* 検索・フィルター */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="商品名で絞り込み"
            className="rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          {categories.length > 1 &&
            categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  categoryFilter === cat
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-muted hover:bg-slate-50"
                }`}
              >
                {cat === "all" ? "すべて" : cat}
              </button>
            ))}
        </div>

        <h3 className="mb-3 text-sm font-semibold text-foreground">
          商品一覧
          {searchQuery && (
            <span className="ml-2 text-xs font-normal text-muted">
              「{searchQuery}」の検索結果: {filteredProducts.length}件
            </span>
          )}
        </h3>

        {filteredProducts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
            {products.length === 0 ? "販売中の商品がありません。" : "条件に一致する商品がありません。"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filteredProducts.map((product) => {
              const outOfStock = product.stock_quantity !== null && product.stock_quantity === 0;
              const qty = cart.get(product.id) ?? 0;
              const atMax = product.stock_quantity !== null && qty >= product.stock_quantity;
              const settings = itemSettings.get(product.id);
              const hasSettings =
                settings && (settings.discount !== null || settings.taxRate !== (product.default_tax_rate ?? 10));

              return (
                <div
                  key={product.id}
                  className={`relative flex flex-col rounded-xl border p-3 ${
                    outOfStock ? "border-border bg-slate-100 opacity-50" : "border-border bg-white"
                  }`}
                >
                  {hasSettings && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      設定
                    </span>
                  )}
                  <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    ¥{product.price_excluding_tax.toLocaleString()}
                    <span className="ml-0.5">（税抜）</span>
                  </p>
                  {product.stock_quantity !== null && (
                    <p className={`mt-0.5 text-xs ${outOfStock ? "text-red-600" : "text-muted"}`}>
                      在庫: {product.stock_quantity}
                    </p>
                  )}
                  {(product.default_tax_rate ?? 10) !== 10 && (
                    <p className="mt-0.5 text-xs text-amber-600">
                      軽減税率 {product.default_tax_rate}%
                    </p>
                  )}

                  {outOfStock ? (
                    <p className="mt-auto pt-2 text-center text-xs font-medium text-red-600">
                      在庫なし
                    </p>
                  ) : (
                    <div className="mt-auto pt-2 space-y-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, qty - 1, product.stock_quantity)}
                          disabled={qty === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-base font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={product.stock_quantity ?? undefined}
                          value={qty === 0 ? "" : qty}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            setQuantity(product.id, isNaN(n) ? 0 : n, product.stock_quantity);
                          }}
                          placeholder="0"
                          className="w-10 rounded border border-border text-center text-sm outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, qty + 1, product.stock_quantity)}
                          disabled={atMax}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-base font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ＋
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowItemModal(product.id)}
                        className="w-full rounded-lg border border-border py-1 text-xs text-muted hover:bg-slate-50"
                      >
                        詳細設定
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── カート ── */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="rounded-xl border border-border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">カート</h3>
            {!isCartEmpty && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-muted hover:text-red-600"
              >
                クリア
              </button>
            )}
          </div>

          {isCartEmpty ? (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted">
              商品を選択してください
            </p>
          ) : (
            <ul className="space-y-2">
              {cartEntries.map(({ product, quantity, gross, itemDiscountAmount }) => {
                const settings = itemSettings.get(product.id);
                return (
                  <li key={product.id} className="text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-foreground">{product.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted">
                            ¥{product.price_excluding_tax.toLocaleString()} × {quantity}
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowItemModal(product.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            編集
                          </button>
                        </div>
                        {settings?.taxRate !== undefined && settings.taxRate !== (product.default_tax_rate ?? 10) && (
                          <p className="text-xs text-amber-600">税率 {settings.taxRate}%</p>
                        )}
                        {itemDiscountAmount > 0 && (
                          <p className="text-xs text-green-700">
                            割引 −¥{itemDiscountAmount.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="font-medium text-foreground">
                          ¥{(gross - itemDiscountAmount).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQuantity(product.id, quantity - 1, product.stock_quantity)}
                            className="flex h-5 w-5 items-center justify-center rounded border border-border text-xs hover:bg-slate-50"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-xs">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(product.id, quantity + 1, product.stock_quantity)}
                            disabled={product.stock_quantity !== null && quantity >= product.stock_quantity}
                            className="flex h-5 w-5 items-center justify-center rounded border border-border text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ＋
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!isCartEmpty && (
            <>
              {/* セッション割引ボタン */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowSessionDiscountModal(true)}
                  className={`w-full rounded-lg border py-2 text-xs transition-colors ${
                    sessionDiscount
                      ? "border-green-400 bg-green-50 text-green-800"
                      : "border-border text-muted hover:bg-slate-50"
                  }`}
                >
                  {sessionDiscount
                    ? `全体割引: ${sessionDiscount.type === "amount" ? `¥${sessionDiscount.value.toLocaleString()}引き` : `${sessionDiscount.value}%OFF`}`
                    : "＋ 全体割引を追加"}
                </button>
              </div>

              {/* 合計 */}
              <div className="space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between text-muted">
                  <span>小計（税抜）</span>
                  <span>¥{totals.grossSubtotal.toLocaleString()}</span>
                </div>
                {totals.totalDiscountAmount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>割引合計</span>
                    <span>−¥{totals.totalDiscountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>税抜合計</span>
                  <span>¥{totals.finalNet.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>消費税</span>
                  <span>¥{totals.taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 font-semibold text-foreground">
                  <span>税込合計</span>
                  <span>¥{totals.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}

          {/* フォーム */}
          <form ref={formRef} action={formAction} className="space-y-3">
            <input type="hidden" name="businessId" value={businessId} />
            <input type="hidden" name="items" value={itemsJson} />
            <input type="hidden" name="sessionDiscount" value={sessionDiscountJson} />

            {/* 支払方法 */}
            <div>
              <label htmlFor="paymentMethod" className="block text-xs font-medium text-foreground">
                支払方法
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PosPaymentMethod)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {POS_PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {paymentMethod === "other" && (
              <div>
                <label htmlFor="paymentOtherLabel" className="block text-xs font-medium text-foreground">
                  支払方法（詳細）
                </label>
                <input
                  id="paymentOtherLabel"
                  name="paymentOtherLabel"
                  type="text"
                  value={paymentOtherLabel}
                  onChange={(e) => setPaymentOtherLabel(e.target.value)}
                  placeholder="例：商品券"
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            )}
            {paymentMethod !== "other" && (
              <input type="hidden" name="paymentOtherLabel" value="" />
            )}

            {/* 備考 */}
            <div>
              <label htmlFor="note" className="block text-xs font-medium text-foreground">
                備考（任意）
              </label>
              <input
                id="note"
                name="note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例：団体割引など"
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {state.error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {state.error}
              </p>
            )}

            {/* 確認モーダル（フォーム内に配置してsubmitを機能させる） */}
            {showConfirmModal && (
              <Modal onClose={() => setShowConfirmModal(false)}>
                <h3 className="text-base font-semibold text-foreground">販売確認</h3>
                <ul className="mt-3 space-y-1 text-sm">
                  {cartEntries.map(({ product, quantity, gross, itemDiscountAmount }) => (
                    <li key={product.id} className="flex justify-between gap-2">
                      <span className="truncate text-muted">
                        {product.name} × {quantity}
                      </span>
                      <span className="shrink-0 font-medium text-foreground">
                        ¥{(gross - itemDiscountAmount).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  {totals.totalDiscountAmount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>割引合計</span>
                      <span>−¥{totals.totalDiscountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted">
                    <span>消費税</span>
                    <span>¥{totals.taxAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-foreground">
                    <span>税込合計</span>
                    <span>¥{totals.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>支払方法</span>
                    <span>
                      {POS_PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label ?? paymentMethod}
                      {paymentMethod === "other" && paymentOtherLabel ? `（${paymentOtherLabel}）` : ""}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 rounded-xl border border-border py-2.5 text-sm hover:bg-slate-50"
                  >
                    戻る
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    onClick={() => {
                      try { localStorage.removeItem(STORAGE_KEY(businessId)); } catch {}
                    }}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    {pending ? "処理中..." : "確定する"}
                  </button>
                </div>
              </Modal>
            )}

            {!showConfirmModal && (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isCartEmpty}
                className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                販売確定
              </button>
            )}
          </form>
        </div>
      </div>

      {/* ── 商品詳細設定モーダル ── */}
      {showItemModal && modalProduct && (
        <Modal onClose={() => setShowItemModal(null)}>
          <h3 className="text-base font-semibold text-foreground">{modalProduct.name}</h3>
          <p className="mt-1 text-xs text-muted">
            単価: ¥{modalProduct.price_excluding_tax.toLocaleString()}（税抜）
          </p>

          {/* 数量編集 */}
          <div className="mt-4">
            <p className="text-xs font-medium text-foreground">数量</p>
            <div className="mt-1.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(modalProduct.id, (cart.get(modalProduct.id) ?? 0) - 1, modalProduct.stock_quantity)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-base font-bold hover:bg-slate-50"
              >
                −
              </button>
              <input
                type="number"
                min={0}
                max={modalProduct.stock_quantity ?? undefined}
                value={cart.get(modalProduct.id) ?? 0}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setQuantity(modalProduct.id, isNaN(n) ? 0 : n, modalProduct.stock_quantity);
                }}
                className="w-16 rounded-lg border border-border px-2 py-1.5 text-center text-sm outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity(modalProduct.id, (cart.get(modalProduct.id) ?? 0) + 1, modalProduct.stock_quantity)}
                disabled={modalProduct.stock_quantity !== null && (cart.get(modalProduct.id) ?? 0) >= modalProduct.stock_quantity}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-base font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ＋
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuantity(modalProduct.id, 0, null);
                  setShowItemModal(null);
                }}
                className="ml-auto text-xs text-red-500 hover:text-red-700 hover:underline"
              >
                削除
              </button>
            </div>
          </div>

          {/* 税率選択 */}
          <div className="mt-4">
            <p className="text-xs font-medium text-foreground">税率</p>
            <div className="mt-1.5 flex gap-2">
              {([10, 8] as const).map((rate) => {
                const current = itemSettings.get(modalProduct.id)?.taxRate ?? (modalProduct.default_tax_rate ?? 10);
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      const prev = itemSettings.get(modalProduct.id) ?? {
                        taxRate: modalProduct.default_tax_rate ?? 10,
                        discount: null,
                      };
                      setItemSettings(new Map(itemSettings).set(modalProduct.id, { ...prev, taxRate: rate }));
                    }}
                    className={`flex-1 rounded-lg border py-2 text-sm ${
                      current === rate
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-white hover:bg-slate-50"
                    }`}
                  >
                    {rate}%
                    {rate === 8 && <span className="ml-1 text-[10px] opacity-70">（軽減）</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 商品割引 */}
          <div className="mt-4">
            <p className="text-xs font-medium text-foreground mb-1">商品割引</p>
            <DiscountInput
              label=""
              discount={itemSettings.get(modalProduct.id)?.discount ?? null}
              onSave={(d) => {
                const prev = itemSettings.get(modalProduct.id) ?? {
                  taxRate: modalProduct.default_tax_rate ?? 10,
                  discount: null,
                };
                const next = new Map(itemSettings);
                if (d === null && prev.taxRate === (modalProduct.default_tax_rate ?? 10)) {
                  next.delete(modalProduct.id);
                } else {
                  next.set(modalProduct.id, { ...prev, discount: d });
                }
                setItemSettings(next);
              }}
              onClose={() => setShowItemModal(null)}
            />
          </div>
        </Modal>
      )}

      {/* ── 全体割引モーダル ── */}
      {showSessionDiscountModal && (
        <Modal onClose={() => setShowSessionDiscountModal(false)}>
          <h3 className="text-base font-semibold text-foreground">全体割引</h3>
          <div className="mt-3">
            <DiscountInput
              label="割引を設定"
              discount={sessionDiscount}
              onSave={(d) => setSessionDiscount(d)}
              onClose={() => setShowSessionDiscountModal(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

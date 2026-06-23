"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50"
    >
      印刷
    </button>
  );
}

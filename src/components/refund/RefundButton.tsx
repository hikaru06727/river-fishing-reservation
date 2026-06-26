"use client";

import { useState } from "react";
import { RefundModal, type RefundTarget } from "./RefundModal";

interface RefundButtonProps {
  businessId: string;
  target: RefundTarget;
  maxAmount: number;
}

export function RefundButton({ businessId, target, maxAmount }: RefundButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        返金する
      </button>
      {open && (
        <RefundModal
          businessId={businessId}
          target={target}
          maxAmount={maxAmount}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

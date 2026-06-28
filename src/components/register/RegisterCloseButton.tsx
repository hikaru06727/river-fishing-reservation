"use client";

import Link from "next/link";
import { useActionState } from "react";
import { closeRegisterAction } from "@/app/(admin)/admin/register-closing/actions";
import {
  registerClosingInitialState,
  type RegisterClosingActionState,
  type UnsettledEntryInfo,
} from "@/app/(admin)/admin/register-closing/action-state";

const ENTRY_CONFIG: Record<
  UnsettledEntryInfo["source_type"],
  { label: (id: string) => string; href: (id: string) => string; linkLabel: string }
> = {
  pos: {
    label: (id) => `POS販売 #${id.slice(0, 8)}`,
    href: () => "/admin/pos",
    linkLabel: "レジへ移動",
  },
  reservation: {
    label: (id) => `予約 #${id.slice(0, 8)}`,
    href: (id) => `/admin/reservations/${id}`,
    linkLabel: "予約詳細へ",
  },
  manual: {
    label: () => "手動売上",
    href: () => "/admin/sales",
    linkLabel: "手動売上へ",
  },
  booth: {
    label: (id) => `ブース予約 #${id.slice(0, 8)}`,
    href: () => "/admin/booths",
    linkLabel: "ブース管理へ",
  },
};

function UnsettledEntryRow({ entry }: { entry: UnsettledEntryInfo }) {
  const config = ENTRY_CONFIG[entry.source_type];
  return (
    <li className="flex items-center gap-2">
      <span>・{config.label(entry.source_id)}</span>
      <Link
        href={config.href(entry.source_id)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-red-700 underline hover:text-red-900"
      >
        {config.linkLabel}
        <span aria-hidden="true">↗</span>
      </Link>
    </li>
  );
}

interface RegisterCloseButtonProps {
  businessId: string;
  periodStart: string;
  periodEnd: string;
}

export function RegisterCloseButton({
  businessId,
  periodStart,
  periodEnd,
}: RegisterCloseButtonProps) {
  const [state, formAction, pending] = useActionState<RegisterClosingActionState, FormData>(
    closeRegisterAction,
    registerClosingInitialState,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const startLabel = new Date(periodStart).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const endLabel = new Date(periodEnd).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const confirmed = window.confirm(
      `以下の期間でレジを締めますか？\n\n期間: ${startLabel} 〜 ${endLabel}\n\n一度締めると変更できません。`,
    );
    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <div>
      <form action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="periodStart" value={periodStart} />
        <input type="hidden" name="periodEnd" value={periodEnd} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "処理中..." : "レジを締める"}
        </button>
      </form>
      {state.error && (
        <div className="mt-2" role="alert">
          <p className="text-sm text-red-600">{state.error}</p>
          {state.unsettledBlock && state.unsettledBlock.total > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-red-600">
              {state.unsettledBlock.entries.map((entry) => (
                <UnsettledEntryRow key={entry.source_id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      )}
      {state.success && (
        <p className="mt-2 text-sm text-green-600" role="status">
          {state.success}
        </p>
      )}
    </div>
  );
}

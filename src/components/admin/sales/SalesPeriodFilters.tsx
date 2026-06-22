"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  getDefaultSalesDateRange,
  getOneMonthRangeFrom,
  resolveSalesPeriodPreset,
  type SalesPeriodPreset,
} from "@/lib/sales/sales-period";

interface SalesPeriodFiltersProps {
  dateFrom: string;
  dateTo: string;
}

function buildHref(dateFrom: string, dateTo: string): string {
  const params = new URLSearchParams({ dateFrom, dateTo });
  return `/admin/sales?${params.toString()}`;
}

export function SalesPeriodFilters({ dateFrom, dateTo }: SalesPeriodFiltersProps) {
  const presets = useMemo(() => {
    const today = getDefaultSalesDateRange();
    const thisMonth = resolveSalesPeriodPreset("thisMonth");
    const nextMonth = resolveSalesPeriodPreset("nextMonth");
    const oneMonth = getOneMonthRangeFrom(dateFrom || today.dateFrom);

    const items: Array<{ preset: SalesPeriodPreset | "custom"; label: string; href: string }> = [
      { preset: "today", label: "今日", href: buildHref(today.dateFrom, today.dateTo) },
      {
        preset: "thisMonth",
        label: "今月",
        href: buildHref(thisMonth.dateFrom, thisMonth.dateTo),
      },
      {
        preset: "nextMonth",
        label: "来月",
        href: buildHref(nextMonth.dateFrom, nextMonth.dateTo),
      },
      {
        preset: "oneMonthFromStart",
        label: "選択日から1か月",
        href: buildHref(oneMonth.dateFrom, oneMonth.dateTo),
      },
    ];

    return items;
  }, [dateFrom]);

  return (
    <div className="space-y-3">
      <form
        method="get"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:flex-wrap lg:items-end"
      >
        <div className="min-w-[140px] flex-1">
          <label htmlFor="dateFrom" className="block text-sm font-medium">
            開始日
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={dateFrom}
            required
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="min-w-[140px] flex-1">
          <label htmlFor="dateTo" className="block text-sm font-medium">
            終了日
          </label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={dateTo}
            required
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          集計する
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {presets.map((item) => (
          <Link
            key={item.preset}
            href={item.href}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

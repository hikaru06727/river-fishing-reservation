"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface ReserveErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ReserveError({ error, reset }: ReserveErrorProps) {
  useEffect(() => {
    console.error("[ReservePage]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <p className="text-4xl" aria-hidden="true">
        ⚠️
      </p>
      <h2 className="mt-3 text-lg font-semibold text-red-900">
        予約ページの読み込みに失敗しました
      </h2>
      <p className="mt-2 text-sm text-red-700">{error.message}</p>
      <div className="mt-6 flex flex-col gap-3">
        <Button onClick={reset} variant="primary">
          再読み込み
        </Button>
        <Link href="/spots" className="text-sm font-medium text-red-800 hover:underline">
          釣り場一覧に戻る
        </Link>
      </div>
    </div>
  );
}

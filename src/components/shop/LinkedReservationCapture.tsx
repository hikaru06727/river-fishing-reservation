"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { writeLinkedReservation } from "@/lib/online-orders/linked-reservation-storage";

/**
 * 予約詳細ページの「追加で購入する」リンク（?linkedReservationId=...）を
 * 最初に踏んだページで localStorage に保存し、URL から取り除く。カートと
 * 同じ localStorage 永続化のため、以降の商品閲覧・チェックアウトを跨いで保持される。
 */
export function LinkedReservationCapture({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    const linkedReservationId = searchParams.get("linkedReservationId");
    if (!linkedReservationId) return;

    captured.current = true;
    writeLinkedReservation(slug, {
      id: linkedReservationId,
      date: searchParams.get("linkedReservationDate"),
    });

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("linkedReservationId");
    nextParams.delete("linkedReservationDate");
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [slug, searchParams, router, pathname]);

  return null;
}

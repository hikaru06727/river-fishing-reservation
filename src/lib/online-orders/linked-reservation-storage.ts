export type LinkedReservation = { id: string; date: string | null };

function storageKey(slug: string): string {
  return `linked_reservation_${slug}`;
}

/** 予約後の追加購入（Phase 19E）で「追加で購入する」導線から来たことを覚えておくための localStorage 読み書き */
export function readLinkedReservation(slug: string): LinkedReservation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.id !== "string") return null;
    return { id: parsed.id, date: typeof parsed.date === "string" ? parsed.date : null };
  } catch {
    return null;
  }
}

export function writeLinkedReservation(slug: string, value: LinkedReservation): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(slug), JSON.stringify(value));
}

export function clearLinkedReservation(slug: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(slug));
}

import type { DateExceptionTagType } from "@/types/database";

export const DATE_EXCEPTION_TAG_TYPES = [
  "closed",
  "temporary_closed",
  "special_open",
  "short_hours",
  "event",
  "maintenance",
  "other",
] as const satisfies readonly DateExceptionTagType[];

export const DATE_EXCEPTION_TAG_LABELS: Record<DateExceptionTagType, string> = {
  closed: "休業日",
  temporary_closed: "臨時休業",
  special_open: "特別営業",
  short_hours: "短縮営業",
  event: "イベント",
  maintenance: "メンテナンス",
  other: "その他",
};

export const DATE_EXCEPTION_TAG_OPTIONS = [
  { value: "", label: "未選択" },
  ...DATE_EXCEPTION_TAG_TYPES.map((value) => ({
    value,
    label: DATE_EXCEPTION_TAG_LABELS[value],
  })),
] as const;

export function getDateExceptionTagLabel(
  tagType: string | null | undefined,
): string {
  if (tagType == null || tagType.length === 0) {
    return "—";
  }
  if (tagType in DATE_EXCEPTION_TAG_LABELS) {
    return DATE_EXCEPTION_TAG_LABELS[tagType as DateExceptionTagType];
  }
  return tagType;
}

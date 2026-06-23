import type { SaleSession, SaleSessionDiscount, SaleSessionItem } from "@/types/database";

export type SaleSessionListRow = SaleSession & {
  item_count: number;
};

export type SaleSessionItemDetail = SaleSessionItem & {
  product_name: string;
};

export type SaleSessionDetail = SaleSession & {
  items: SaleSessionItemDetail[];
  discounts: SaleSessionDiscount[];
};

import { ONLINE_ORDER_STATUS_COLOR, ONLINE_ORDER_STATUS_LABEL } from "@/lib/online-orders/labels";
import type { OnlineOrderStatus } from "@/types/domain";

interface OrderStatusBadgeProps {
  status: OnlineOrderStatus;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ONLINE_ORDER_STATUS_COLOR[status]}`}
    >
      {ONLINE_ORDER_STATUS_LABEL[status]}
    </span>
  );
}

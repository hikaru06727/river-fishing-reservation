import {
  getReservationStatusColor,
  getReservationStatusLabel,
} from "@/lib/reservations/get-my-reservations";
import type { ReservationStatus } from "@/types/domain";

interface ReservationStatusBadgeProps {
  status: ReservationStatus;
}

export function ReservationStatusBadge({ status }: ReservationStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getReservationStatusColor(status)}`}
    >
      {getReservationStatusLabel(status)}
    </span>
  );
}

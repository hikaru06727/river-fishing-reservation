import type { Plan, Reservation, ReservationStatus } from "@/types/database";
import type { RemainingCount } from "@/lib/slots/remaining-count";

/** GET /api/slots/with-plan レスポンス内のプラン情報 */
export type PlanDTO = Pick<
  Plan,
  "id" | "name" | "slug" | "duration_minutes" | "price_yen"
>;

/**
 * 予約可能スロット 1 件分の DTO。
 *
 * `remaining_count` は {@link RemainingCount} の定義に従い service 層で算出される。
 * UI は再計算せず API 値をそのまま使用すること。
 */
export interface SlotDTO {
  id: string;
  /** 利用日 (YYYY-MM-DD) */
  date: string;
  /** 開始時刻 (HH:mm) */
  start_time: string;
  /** 終了時刻 (HH:mm) — プラン時間を反映 */
  end_time: string;
  /**
   * 予約可能残数 = 影響スロット群の min(max_capacity - booked_count)
   * @see RemainingCount
   */
  remaining_count: RemainingCount;
  /** remaining_count 算出に使用した availability_slots ID 一覧（15分/60分 grid 共通） */
  affected_slot_ids: string[];
}

/**
 * GET /api/slots/with-plan のレスポンス DTO。
 *
 * `slots` 配列が唯一のデータソース。日付別表示はクライアント側で group すること。
 */
export interface GetAvailableSlotsWithPlanResponse {
  plan: PlanDTO;
  guest_count: number;
  slots: SlotDTO[];
}

export interface CreateReservationRequest {
  spot_id: string;
  plan_id: string;
  slot_id: string;
  reservation_date: string;
  start_time: string;
  guest_count?: number;
}

export interface CreateReservationResponse {
  reservation: {
    id: string;
    redirect_path: string;
  };
}

export interface CreateCheckoutRequest {
  reservation_id: string;
}

export interface CreateCheckoutResponse {
  checkout_url: string;
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface ReservationWithPlan extends Reservation {
  plan?: Plan;
  status: ReservationStatus;
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminCancelReservationButton } from "@/components/admin/AdminCancelReservationButton";
import { AdminMarkCashPaymentReceivedButton } from "@/components/admin/AdminMarkCashPaymentReceivedButton";
import { ReservationStatusBadge } from "@/components/admin/ReservationStatusBadge";
import {
  buildReservationPaymentInfo,
  ReservationPaymentSummary,
} from "@/components/reservation/ReservationPaymentSummary";
import { Card } from "@/components/ui/Card";
import { canCurrentUserManageReservation } from "@/lib/auth/management-access";
import { canCancelReservation } from "@/lib/reservations/get-my-reservations";
import { getAdminCashPaymentUiState } from "@/lib/reservations/mark-cash-payment-received";
import { getLatestReservationPayment } from "@/lib/reservations/payment-status-display";
import { getAdminReservationById } from "@/lib/reservations/get-admin-reservations";
import { getReservationPlanDisplay } from "@/lib/reservations/plan-display";
import { formatDate, formatDateTime, formatTime, formatYen } from "@/lib/utils/format";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { RefundButton } from "@/components/refund/RefundButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface AdminReservationDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AdminReservationDetailPageProps) {
  const { id } = await params;
  return {
    title: `予約詳細 ${id.slice(0, 8)}…`,
  };
}

export default async function AdminReservationDetailPage({
  params,
}: AdminReservationDetailPageProps) {
  const { id } = await params;

  const reservation = await getAdminReservationById(id);
  if (!reservation) {
    notFound();
  }

  const canManage = await canCurrentUserManageReservation(id);
  if (!canManage) {
    redirect("/admin/reservations");
  }

  const session = await getAuthenticatedManagement();

  const cancelPolicy = canCancelReservation({
    status: reservation.status,
    reservationDate: reservation.reservation_date,
    startTime: reservation.start_time,
    isAdmin: true,
  });

  const returnTo = `/admin/reservations/${id}`;
  const latestPayment = getLatestReservationPayment(reservation.payments);
  const paymentInfo = buildReservationPaymentInfo(reservation);

  const cashPaymentUi = getAdminCashPaymentUiState({
    payment_method: reservation.payment_method,
    reservation_status: reservation.status,
    payments: reservation.payments,
  });

  const planDisplay = getReservationPlanDisplay(reservation);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/reservations"
            className="text-sm text-primary hover:underline"
          >
            ← 予約一覧に戻る
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-foreground">予約詳細</h2>
          <p className="mt-1 font-mono text-xs text-muted">{reservation.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReservationStatusBadge status={reservation.status} />
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentInfo.paymentStateColor}`}
          >
            {paymentInfo.paymentStateLabel}
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-foreground">予約情報</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">利用日</dt>
              <dd>{formatDate(reservation.reservation_date)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">時間</dt>
              <dd>
                {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">釣り場</dt>
              <dd>{reservation.locations?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">プラン</dt>
              <dd>{planDisplay.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">人数</dt>
              <dd>{reservation.guest_count} 名</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">合計金額</dt>
              <dd>{formatYen(reservation.total_amount_yen)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">作成日時</dt>
              <dd>{formatDateTime(reservation.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">更新日時</dt>
              <dd>{formatDateTime(reservation.updated_at)}</dd>
            </div>
            {reservation.expires_at && reservation.status === "pending" && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">仮予約期限</dt>
                <dd>{formatDateTime(reservation.expires_at)}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <h3 className="font-semibold text-foreground">顧客情報</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">氏名</dt>
              <dd>{reservation.profiles?.full_name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">メール</dt>
              <dd className="break-all">{reservation.profiles?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">ユーザーID</dt>
              <dd className="font-mono text-xs">{reservation.user_id}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h3 className="font-semibold text-foreground">支払い情報</h3>
          <div className="mt-3">
            <ReservationPaymentSummary
              paymentMethodLabel={paymentInfo.paymentMethodLabel}
              paymentStateLabel={paymentInfo.paymentStateLabel}
              paymentStateColor={paymentInfo.paymentStateColor}
            />
          </div>
          {cashPaymentUi.showMarkButton && (
            <div className="mt-4 border-t border-border pt-4">
              <AdminMarkCashPaymentReceivedButton
                reservationId={reservation.id}
                returnTo={returnTo}
              />
            </div>
          )}
          {reservation.payment_status === "succeeded" &&
            reservation.locations?.business_id &&
            session &&
            hasPermission(session.profile.role, "REFUND_MANAGE") && (
              <div className="mt-4 border-t border-border pt-4">
                <RefundButton
                  businessId={reservation.locations.business_id}
                  target={{
                    type: "reservation",
                    id: reservation.id,
                    stripePaymentIntentId:
                      latestPayment?.stripe_payment_intent_id ?? null,
                  }}
                  maxAmount={reservation.total_amount_yen}
                />
              </div>
            )}
          {cashPaymentUi.showAlreadyPaid && (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
              現地精算済
            </p>
          )}
          {cashPaymentUi.showMissingPaymentNote && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              支払いレコードが見つかりません。
            </p>
          )}
          {latestPayment ? (
            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">決済金額</dt>
                <dd>{formatYen(latestPayment.amount_yen)}</dd>
              </div>
              {latestPayment.paid_at && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">決済日時</dt>
                  <dd>{formatDateTime(latestPayment.paid_at)}</dd>
                </div>
              )}
              {reservation.stripe_checkout_session_id && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Checkout Session</dt>
                  <dd className="break-all font-mono text-xs">
                    {reservation.stripe_checkout_session_id}
                  </dd>
                </div>
              )}
            </dl>
          ) : paymentInfo.paymentMethod === "online" ? (
            <p className="mt-3 text-sm text-muted">
              決済レコードはまだありません（仮予約中の可能性があります）。
            </p>
          ) : null}
        </Card>
      </div>

      {cancelPolicy.allowed ? (
        <Card className="border-red-200">
          <h3 className="font-semibold text-red-800">危険な操作</h3>
          <p className="mt-2 text-sm text-muted">
            キャンセルすると空き枠が解放され、元に戻せません。キャンセル通知メールが送信されます。
          </p>
          <div className="mt-4">
            <AdminCancelReservationButton
              reservationId={reservation.id}
              returnTo={returnTo}
            />
          </div>
        </Card>
      ) : (
        <p className="text-sm text-muted">{cancelPolicy.reason ?? "キャンセルできません。"}</p>
      )}
    </div>
  );
}

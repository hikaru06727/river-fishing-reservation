import { redirect } from "next/navigation";
import { ReservationCard } from "@/components/reservation/ReservationCard";
import { getUser } from "@/lib/auth/get-user";
import { getMyReservations } from "@/lib/reservations/get-my-reservations";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "マイ予約",
};

export default async function MyReservationsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login?next=/my/reservations");
  }

  const reservations = await getMyReservations(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">マイ予約</h1>
        <p className="mt-1 text-sm text-muted">予約の確認・キャンセルができます</p>
      </header>

      {reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-4xl" aria-hidden="true">
            📅
          </p>
          <p className="mt-3 font-medium text-foreground">予約がありません</p>
          <p className="mt-1 text-sm text-muted">釣り場から予約してみましょう</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {reservations.map((reservation) => (
            <li key={reservation.id}>
              <ReservationCard reservation={reservation} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

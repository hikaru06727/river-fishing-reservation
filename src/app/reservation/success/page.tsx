import { redirect } from "next/navigation";

/** 旧 URL → /reserve/complete へ転送 */
export default async function ReservationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const query = session_id ? `?session_id=${encodeURIComponent(session_id)}` : "";
  redirect(`/reserve/complete${query}`);
}

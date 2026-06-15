interface ReservationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold">予約詳細</h1>
      <p className="mt-2 text-muted">予約 ID: {id}</p>
    </div>
  );
}

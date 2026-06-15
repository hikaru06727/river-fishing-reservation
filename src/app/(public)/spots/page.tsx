import { SpotCard } from "@/components/spots/SpotCard";
import { getActiveSpots } from "@/lib/spots/get-spots";

export const metadata = {
  title: "釣り場一覧",
};

export default async function SpotsPage() {
  const spots = await getActiveSpots();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">釣り場一覧</h1>
        <p className="mt-1 text-sm text-muted">
          お好みの釣り場を選んで予約できます
        </p>
      </header>

      {spots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-4xl" aria-hidden="true">
            🎣
          </p>
          <p className="mt-3 font-medium text-foreground">
            現在、公開中の釣り場がありません
          </p>
          <p className="mt-1 text-sm text-muted">
            しばらくしてから再度ご確認ください
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spots.map((spot) => (
            <li key={spot.id}>
              <SpotCard spot={spot} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

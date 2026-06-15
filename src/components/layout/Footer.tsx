export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-muted">
        <p className="font-medium text-foreground">川釣り予約サービス</p>
        <p className="mt-1">1時間・3時間プランで川釣りをお楽しみください</p>
        <p className="mt-4">&copy; {new Date().getFullYear()} River Fishing Reservation</p>
      </div>
    </footer>
  );
}

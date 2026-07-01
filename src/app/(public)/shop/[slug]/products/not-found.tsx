export default function ShopNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-card px-6 py-12 text-center">
      <p className="text-5xl" aria-hidden="true">
        🛒
      </p>
      <h1 className="mt-4 text-xl font-bold text-foreground">
        ショップが見つかりません
      </h1>
      <p className="mt-2 text-sm text-muted">
        指定された事業は存在しないか、現在公開されていません。
      </p>
    </div>
  );
}

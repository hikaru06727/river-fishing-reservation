import type { Metadata } from "next";

export const metadata: Metadata = { title: "メールを送信しました" };

export default async function SentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-sm text-center">
        <div className="text-5xl" aria-hidden="true">
          📧
        </div>
        <h1 className="mt-4 text-2xl font-bold">メールを送信しました</h1>
        <p className="mt-4 text-sm text-muted">
          {email ? (
            <>
              <span className="font-medium text-foreground">{email}</span> に
              ログインリンクをお送りしました。
            </>
          ) : (
            "ログインリンクをお送りしました。"
          )}
          <br />
          メール内のリンクをクリックしてください。
        </p>
      </div>
    </div>
  );
}

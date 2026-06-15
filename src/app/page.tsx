import Link from "next/link";
import { Card } from "@/components/ui/Card";

const features = [
  {
    title: "1時間・3時間プラン",
    description: "お好みの時間帯で川釣りをお楽しみいただけます。",
    href: "/spots",
  },
  {
    title: "釣果情報",
    description: "最新の釣果レポートをチェック。",
    href: "/catches",
  },
  {
    title: "ブログ",
    description: "釣り場の情報や季節の話題をお届けします。",
    href: "/blog",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-sky-700 to-sky-900 px-6 py-10 text-white">
        <p className="text-sm font-medium text-sky-200">スマホからかんたん予約</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
          川釣り予約サービス
        </h1>
        <p className="mt-3 max-w-lg text-sky-100">
          1時間プラン・3時間プランから選べるオンライン予約。決済もスマホで完結します。
        </p>
        <Link
          href="/spots"
          className="mt-6 inline-flex h-12 items-center rounded-lg bg-white px-6 text-sm font-semibold text-sky-900 hover:bg-sky-50"
        >
          釣り場を探す
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <Link key={feature.href} href={feature.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <h2 className="font-semibold text-foreground">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted">{feature.description}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}

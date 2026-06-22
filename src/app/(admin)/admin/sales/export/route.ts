import { NextResponse } from "next/server";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  buildSalesCsvByType,
  buildSalesCsvFilename,
  parseSalesCsvType,
} from "@/lib/sales/sales-csv";
import { getSalesDashboard } from "@/lib/services/sales.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthenticatedManagement();
  if (!session) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = parseSalesCsvType(searchParams.get("type"));
  if (!type) {
    return NextResponse.json({ error: "不正な CSV 種別です" }, { status: 400 });
  }

  const queryParams = Object.fromEntries(searchParams.entries());
  let dashboard;
  try {
    dashboard = await getSalesDashboard(queryParams);
  } catch {
    return NextResponse.json({ error: "売上データの取得に失敗しました" }, { status: 500 });
  }

  if (!dashboard) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const { report } = dashboard;
  const csv = buildSalesCsvByType(type, report);
  const filename = buildSalesCsvFilename(type, report.dateFrom, report.dateTo);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

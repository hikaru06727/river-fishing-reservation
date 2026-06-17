import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CatchReport, ContentStatus } from "@/types/database";

export type CatchReportListItem = Pick<
  CatchReport,
  "id" | "caught_date" | "fish_species" | "length_cm" | "title" | "description"
>;

export type CatchReportMetadata = Pick<CatchReport, "title" | "fish_species">;

export type CatchReportDetail = Pick<
  CatchReport,
  "caught_date" | "fish_species" | "length_cm" | "title" | "description" | "image_url"
>;

export type CatchReportsPaginatedResult = {
  rows: CatchReport[];
  totalCount: number;
};

export type CatchReportsPaginatedFilters = {
  spotId?: string | null;
  offset: number;
  limit: number;
};

/** 公開釣果一覧（ページ用） */
export async function findPublishedCatchReportsList(): Promise<CatchReportListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("catch_reports")
    .select("id, caught_date, fish_species, length_cm, title, description")
    .eq("status", "published")
    .order("caught_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** メタデータ用 */
export async function findPublishedCatchReportMetadataById(
  id: string,
): Promise<CatchReportMetadata | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("catch_reports")
    .select("title, fish_species")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** 公開釣果詳細（ページ用） */
export async function findPublishedCatchReportDetailById(
  id: string,
): Promise<CatchReportDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("catch_reports")
    .select("caught_date, fish_species, length_cm, title, description, image_url")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** 公開釣果一覧（API・ページネーション） */
export async function findPublishedCatchReportsPaginated(
  filters: CatchReportsPaginatedFilters,
): Promise<CatchReportsPaginatedResult> {
  const supabase = await createClient();

  let query = supabase
    .from("catch_reports")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (filters.spotId) {
    query = query.eq("spot_id", filters.spotId);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: data ?? [],
    totalCount: count ?? 0,
  };
}

/** 公開釣果全文（API・ID 指定） */
export async function findPublishedCatchReportFullById(id: string): Promise<CatchReport | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("catch_reports")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (error) {
    return null;
  }

  return data;
}

export type InsertCatchReportAdminInput = {
  spot_id: string;
  author_id: string;
  title: string;
  fish_species: string;
  length_cm: number | null;
  description: string;
  caught_date: string;
  status: ContentStatus;
  published_at: string;
};

/** 管理画面: 釣果レポート作成（service_role） */
export async function insertCatchReportAdmin(
  input: InsertCatchReportAdminInput,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("catch_reports").insert({
    spot_id: input.spot_id,
    author_id: input.author_id,
    title: input.title,
    fish_species: input.fish_species,
    length_cm: input.length_cm,
    description: input.description,
    caught_date: input.caught_date,
    status: input.status,
    published_at: input.published_at,
  });

  if (error) {
    throw new Error(error.message);
  }
}

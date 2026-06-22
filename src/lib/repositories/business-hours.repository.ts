import { createClient } from "@/lib/supabase/server";
import { throwSupabaseMutationError } from "@/lib/db/postgres-error";
import type {
  FishingSpotDateException,
  FishingSpotWeeklyHour,
} from "@/types/database";

export type WeeklyHourUpsertInput = {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  is_24_hours: boolean;
};

export type DateExceptionUpsertInput = {
  exception_date: string;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  is_24_hours: boolean;
  note: string | null;
  ignore_weekly_breaks: boolean;
  tag_type: string | null;
};

export async function findWeeklyHoursBySpotId(
  spotId: string,
): Promise<FishingSpotWeeklyHour[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spot_weekly_hours")
    .select("*")
    .eq("fishing_spot_id", spotId)
    .order("day_of_week", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function upsertWeeklyHoursForSpot(
  spotId: string,
  rows: WeeklyHourUpsertInput[],
): Promise<FishingSpotWeeklyHour[]> {
  const supabase = await createClient();

  const payload = rows.map((row) => ({
    fishing_spot_id: spotId,
    day_of_week: row.day_of_week,
    is_open: row.is_open,
    open_time: row.is_open && !row.is_24_hours ? row.open_time : null,
    close_time: row.is_open && !row.is_24_hours ? row.close_time : null,
    is_24_hours: row.is_open && row.is_24_hours,
  }));

  const { data, error } = await supabase
    .from("fishing_spot_weekly_hours")
    .upsert(payload, { onConflict: "fishing_spot_id,day_of_week" })
    .select("*")
    .order("day_of_week", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function findDateExceptionsBySpotId(
  spotId: string,
): Promise<FishingSpotDateException[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spot_date_exceptions")
    .select("*")
    .eq("fishing_spot_id", spotId)
    .order("exception_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function findDateExceptionsBySpotAndDateRange(
  spotId: string,
  startDate: string,
  endDate: string,
): Promise<FishingSpotDateException[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spot_date_exceptions")
    .select("*")
    .eq("fishing_spot_id", spotId)
    .gte("exception_date", startDate)
    .lte("exception_date", endDate)
    .order("exception_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function insertDateException(
  spotId: string,
  input: DateExceptionUpsertInput,
): Promise<FishingSpotDateException> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spot_date_exceptions")
    .insert({
      fishing_spot_id: spotId,
      exception_date: input.exception_date,
      is_open: input.is_open,
      open_time: input.is_open && !input.is_24_hours ? input.open_time : null,
      close_time: input.is_open && !input.is_24_hours ? input.close_time : null,
      is_24_hours: input.is_open && input.is_24_hours,
      note: input.note,
      ignore_weekly_breaks: input.ignore_weekly_breaks,
      tag_type: input.tag_type,
    })
    .select("*")
    .single();

  if (error) {
    throwSupabaseMutationError(error);
  }

  return data;
}

export async function updateDateExceptionById(
  exceptionId: string,
  input: DateExceptionUpsertInput,
): Promise<FishingSpotDateException> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spot_date_exceptions")
    .update({
      exception_date: input.exception_date,
      is_open: input.is_open,
      open_time: input.is_open && !input.is_24_hours ? input.open_time : null,
      close_time: input.is_open && !input.is_24_hours ? input.close_time : null,
      is_24_hours: input.is_open && input.is_24_hours,
      note: input.note,
      ignore_weekly_breaks: input.ignore_weekly_breaks,
      tag_type: input.tag_type,
    })
    .eq("id", exceptionId)
    .select("*")
    .single();

  if (error) {
    throwSupabaseMutationError(error);
  }

  return data;
}

export async function deleteDateExceptionById(exceptionId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("fishing_spot_date_exceptions")
    .delete()
    .eq("id", exceptionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function findDateExceptionSpotIdById(
  exceptionId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spot_date_exceptions")
    .select("fishing_spot_id")
    .eq("id", exceptionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.fishing_spot_id ?? null;
}

function groupWeeklyHoursBySpotId(
  rows: FishingSpotWeeklyHour[],
): Map<string, FishingSpotWeeklyHour[]> {
  const map = new Map<string, FishingSpotWeeklyHour[]>();
  for (const row of rows) {
    const list = map.get(row.fishing_spot_id) ?? [];
    list.push(row);
    map.set(row.fishing_spot_id, list);
  }
  return map;
}

function groupDateExceptionsBySpotId(
  rows: FishingSpotDateException[],
): Map<string, FishingSpotDateException[]> {
  const map = new Map<string, FishingSpotDateException[]>();
  for (const row of rows) {
    const list = map.get(row.fishing_spot_id) ?? [];
    list.push(row);
    map.set(row.fishing_spot_id, list);
  }
  return map;
}

/** 複数 spot の曜日別営業時間（RLS 下・管理画面スコープ） */
export async function findWeeklyHoursBySpotIds(
  spotIds: readonly string[],
): Promise<Map<string, FishingSpotWeeklyHour[]>> {
  if (spotIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fishing_spot_weekly_hours")
    .select("*")
    .in("fishing_spot_id", [...spotIds])
    .order("day_of_week", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return groupWeeklyHoursBySpotId(data ?? []);
}

/** 複数 spot の期間内例外日（RLS 下・管理画面スコープ） */
export async function findDateExceptionsBySpotIdsAndDateRange(
  spotIds: readonly string[],
  startDate: string,
  endDate: string,
): Promise<Map<string, FishingSpotDateException[]>> {
  if (spotIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fishing_spot_date_exceptions")
    .select("*")
    .in("fishing_spot_id", [...spotIds])
    .gte("exception_date", startDate)
    .lte("exception_date", endDate)
    .order("exception_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return groupDateExceptionsBySpotId(data ?? []);
}

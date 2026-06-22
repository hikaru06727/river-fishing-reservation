import { createClient } from "@/lib/supabase/server";
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
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
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
    })
    .eq("id", exceptionId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
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

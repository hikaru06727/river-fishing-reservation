import { createClient } from "@/lib/supabase/server";
import { toDbTime } from "@/lib/utils/date";
import type {
  FishingSpotExceptionBreak,
  FishingSpotWeeklyBreak,
} from "@/types/database";

export type WeeklyBreakUpsertInput = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string | null;
};

export type ExceptionBreakUpsertInput = {
  start_time: string;
  end_time: string;
  label: string | null;
};

export type ExceptionBreakWithDate = FishingSpotExceptionBreak & {
  exception_date: string;
  ignore_weekly_breaks: boolean;
};

export async function findWeeklyBreaksBySpotId(
  spotId: string,
): Promise<FishingSpotWeeklyBreak[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spot_weekly_breaks")
    .select("*")
    .eq("fishing_spot_id", spotId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function replaceWeeklyBreaksForSpot(
  spotId: string,
  rows: WeeklyBreakUpsertInput[],
): Promise<FishingSpotWeeklyBreak[]> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("fishing_spot_weekly_breaks")
    .delete()
    .eq("fishing_spot_id", spotId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (rows.length === 0) {
    return [];
  }

  const payload = rows.map((row) => ({
    fishing_spot_id: spotId,
    day_of_week: row.day_of_week,
    start_time: toDbTime(row.start_time),
    end_time: toDbTime(row.end_time),
    label: row.label,
  }));

  const { data, error } = await supabase
    .from("fishing_spot_weekly_breaks")
    .insert(payload)
    .select("*")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function findExceptionBreaksBySpotAndDateRange(
  spotId: string,
  startDate: string,
  endDate: string,
): Promise<ExceptionBreakWithDate[]> {
  const supabase = await createClient();

  const { data: exceptions, error: exceptionsError } = await supabase
    .from("fishing_spot_date_exceptions")
    .select("id, exception_date, ignore_weekly_breaks")
    .eq("fishing_spot_id", spotId)
    .gte("exception_date", startDate)
    .lte("exception_date", endDate);

  if (exceptionsError) {
    throw new Error(exceptionsError.message);
  }

  if (!exceptions || exceptions.length === 0) {
    return [];
  }

  const exceptionIds = exceptions.map((row) => row.id);
  const exceptionById = new Map(exceptions.map((row) => [row.id, row]));

  const { data, error } = await supabase
    .from("fishing_spot_exception_breaks")
    .select("*")
    .in("date_exception_id", exceptionIds)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const parent = exceptionById.get(row.date_exception_id)!;
    return {
      ...row,
      exception_date: parent.exception_date,
      ignore_weekly_breaks: parent.ignore_weekly_breaks,
    };
  });
}

export async function findExceptionBreaksByExceptionId(
  exceptionId: string,
): Promise<FishingSpotExceptionBreak[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spot_exception_breaks")
    .select("*")
    .eq("date_exception_id", exceptionId)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function replaceExceptionBreaksForException(
  exceptionId: string,
  rows: ExceptionBreakUpsertInput[],
): Promise<FishingSpotExceptionBreak[]> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("fishing_spot_exception_breaks")
    .delete()
    .eq("date_exception_id", exceptionId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (rows.length === 0) {
    return [];
  }

  const payload = rows.map((row) => ({
    date_exception_id: exceptionId,
    start_time: toDbTime(row.start_time),
    end_time: toDbTime(row.end_time),
    label: row.label,
  }));

  const { data, error } = await supabase
    .from("fishing_spot_exception_breaks")
    .insert(payload)
    .select("*")
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function findExceptionBreakSpotIdByExceptionId(
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

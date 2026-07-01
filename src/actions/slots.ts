"use server";

import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { generateAvailabilitySlots } from "@/lib/services/slots.service";

export type GenerateSlotsState = {
  status: "idle" | "success" | "error";
  inserted?: number;
  error?: string;
};

export async function generateSlotsAction(
  _prev: GenerateSlotsState,
  formData: FormData,
): Promise<GenerateSlotsState> {
  const session = await getAuthenticatedManagement();
  if (!session || !hasPermission(session.profile.role, "BUSINESS_SETTINGS")) {
    return { status: "error", error: "権限がありません" };
  }

  const spotId = formData.get("spotId") as string;
  const fromDate = formData.get("fromDate") as string;
  const toDate = formData.get("toDate") as string;

  if (!spotId || !fromDate || !toDate) {
    return { status: "error", error: "すべての項目を入力してください" };
  }

  try {
    const inserted = await generateAvailabilitySlots(spotId, fromDate, toDate);
    return { status: "success", inserted };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "エラーが発生しました",
    };
  }
}

"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  advanceOnlineOrderStatus,
  confirmInPersonOrderPickup,
} from "@/lib/services/online-order.service";
import type {
  AdminAdvanceOrderStatusState,
  AdminConfirmOrderPickupState,
} from "@/types/online-order-action";

function sanitizeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/admin")) {
    return "/admin/orders";
  }
  return value;
}

export async function adminAdvanceOrderStatusAction(
  _prevState: AdminAdvanceOrderStatusState,
  formData: FormData,
): Promise<AdminAdvanceOrderStatusState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/orders");
  }

  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || !orderId) {
    return { error: "注文IDが不正です。" };
  }

  const result = await advanceOnlineOrderStatus(session.profile, orderId);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect(sanitizeReturnTo(formData.get("returnTo")));
}

export async function adminConfirmOrderPickupAction(
  _prevState: AdminConfirmOrderPickupState,
  formData: FormData,
): Promise<AdminConfirmOrderPickupState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/orders");
  }

  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || !orderId) {
    return { error: "注文IDが不正です。" };
  }

  const result = await confirmInPersonOrderPickup(session.profile, orderId);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect(sanitizeReturnTo(formData.get("returnTo")));
}

export type CreateReservationState = {
  error: string | null;
};

export const createReservationInitialState: CreateReservationState = {
  error: null,
};

export type CancelReservationState = {
  error: string | null;
  success: boolean;
};

export const cancelReservationInitialState: CancelReservationState = {
  error: null,
  success: false,
};

export type AdminCancelReservationState = {
  error: string | null;
};

export const adminCancelReservationInitialState: AdminCancelReservationState = {
  error: null,
};

export type AdminMarkCashPaymentReceivedState = {
  error: string | null;
};

export const adminMarkCashPaymentReceivedInitialState: AdminMarkCashPaymentReceivedState = {
  error: null,
};

/** resolveAddonCleanupIssueAction 用。redirect せずインラインで結果を表示するため RefundActionState と同じ形にする */
export type ResolveAddonCleanupIssueState = {
  error?: string;
  success?: string;
};

export const resolveAddonCleanupIssueInitialState: ResolveAddonCleanupIssueState = {};

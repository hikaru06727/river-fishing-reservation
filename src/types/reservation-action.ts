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

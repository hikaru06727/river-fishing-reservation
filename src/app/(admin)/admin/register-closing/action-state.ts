export type UnsettledBlockInfo = {
  total: number;
  bySourceType: { pos: number; reservation: number; manual: number };
};

export type RegisterClosingActionState = {
  error?: string;
  success?: string;
  unsettledBlock?: UnsettledBlockInfo;
};

export const registerClosingInitialState: RegisterClosingActionState = {};

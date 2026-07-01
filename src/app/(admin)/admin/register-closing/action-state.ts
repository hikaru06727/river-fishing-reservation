export type UnsettledEntryInfo = {
  source_type: "pos" | "reservation" | "manual" | "online_order";
  source_id: string;
};

export type UnsettledBlockInfo = {
  total: number;
  bySourceType: { pos: number; reservation: number; manual: number; online_order: number };
  entries: UnsettledEntryInfo[];
};

export type RegisterClosingActionState = {
  error?: string;
  success?: string;
  unsettledBlock?: UnsettledBlockInfo;
};

export const registerClosingInitialState: RegisterClosingActionState = {};

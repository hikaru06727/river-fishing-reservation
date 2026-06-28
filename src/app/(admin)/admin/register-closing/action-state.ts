export type UnsettledEntryInfo = {
  source_type: "pos" | "reservation" | "manual";
  source_id: string;
};

export type UnsettledBlockInfo = {
  total: number;
  bySourceType: { pos: number; reservation: number; manual: number };
  entries: UnsettledEntryInfo[];
};

export type RegisterClosingActionState = {
  error?: string;
  success?: string;
  unsettledBlock?: UnsettledBlockInfo;
};

export const registerClosingInitialState: RegisterClosingActionState = {};

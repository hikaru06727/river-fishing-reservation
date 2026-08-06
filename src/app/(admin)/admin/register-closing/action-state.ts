export type UnsettledEntryInfo = {
  source_type: "pos" | "reservation" | "manual" | "online_order" | "reservation_addon";
  source_id: string;
};

export type UnsettledBlockInfo = {
  total: number;
  bySourceType: {
    pos: number;
    reservation: number;
    manual: number;
    online_order: number;
    reservation_addon: number;
  };
  entries: UnsettledEntryInfo[];
};

export type RegisterClosingActionState = {
  error?: string;
  success?: string;
  unsettledBlock?: UnsettledBlockInfo;
};

export const registerClosingInitialState: RegisterClosingActionState = {};

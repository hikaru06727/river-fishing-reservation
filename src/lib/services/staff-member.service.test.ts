import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  insertStaffMemberMock,
  findStaffMembersByBusinessIdMock,
  findStaffMemberByIdMock,
  disableStaffMemberMock,
  enableStaffMemberMock,
  acceptStaffInvitationMock,
  findBusinessNamesByIdsMock,
  sendStaffInvitationEmailMock,
  updateProfileRoleMock,
} = vi.hoisted(() => ({
  insertStaffMemberMock: vi.fn(),
  findStaffMembersByBusinessIdMock: vi.fn(),
  findStaffMemberByIdMock: vi.fn(),
  disableStaffMemberMock: vi.fn(),
  enableStaffMemberMock: vi.fn(),
  acceptStaffInvitationMock: vi.fn(),
  findBusinessNamesByIdsMock: vi.fn(),
  sendStaffInvitationEmailMock: vi.fn(),
  updateProfileRoleMock: vi.fn(),
}));

vi.mock("@/lib/repositories/staff-members.repository", () => ({
  insertStaffMember: insertStaffMemberMock,
  findStaffMembersByBusinessId: findStaffMembersByBusinessIdMock,
  findStaffMemberById: findStaffMemberByIdMock,
  disableStaffMember: disableStaffMemberMock,
  enableStaffMember: enableStaffMemberMock,
  acceptStaffInvitation: acceptStaffInvitationMock,
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findBusinessNamesByIds: findBusinessNamesByIdsMock,
}));

vi.mock("@/lib/email/staff-invitation-email", () => ({
  sendStaffInvitationEmail: sendStaffInvitationEmailMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: updateProfileRoleMock,
      }),
    }),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    }),
  ),
}));

import {
  inviteStaffMember,
  disableStaff,
  enableStaff,
  getStaffMembers,
  acceptInvitation,
} from "./staff-member.service";

const BUSINESS_ADMIN_PROFILE = {
  id: "admin-user",
  role: "business_admin" as const,
  full_name: "管理者 太郎",
};

const STAFF_PROFILE = {
  id: "staff-user",
  role: "staff" as const,
  full_name: "スタッフ 次郎",
};

const SAMPLE_STAFF = {
  id: "staff-1",
  business_id: "biz-1",
  user_id: null,
  email: "staff@test.com",
  name: "テストスタッフ",
  role: "staff",
  status: "invited" as const,
  invited_at: "2026-06-24T00:00:00Z",
  joined_at: null,
  created_at: "2026-06-24T00:00:00Z",
};

describe("getStaffMembers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("business_admin はスタッフ一覧を取得できる", async () => {
    findStaffMembersByBusinessIdMock.mockResolvedValue([SAMPLE_STAFF]);

    const result = await getStaffMembers(BUSINESS_ADMIN_PROFILE, "biz-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it("staff ロールはスタッフ一覧を取得できない", async () => {
    const result = await getStaffMembers(STAFF_PROFILE, "biz-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("権限");
  });
});

describe("inviteStaffMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("business_admin はスタッフを招待できる", async () => {
    insertStaffMemberMock.mockResolvedValue(SAMPLE_STAFF);
    findBusinessNamesByIdsMock.mockResolvedValue(["テスト事業"]);
    sendStaffInvitationEmailMock.mockResolvedValue(undefined);

    const result = await inviteStaffMember(BUSINESS_ADMIN_PROFILE, {
      businessId: "biz-1",
      email: "staff@test.com",
      name: "テストスタッフ",
    });

    expect(result.ok).toBe(true);
    expect(insertStaffMemberMock).toHaveBeenCalledWith({
      business_id: "biz-1",
      email: "staff@test.com",
      name: "テストスタッフ",
    });
    expect(sendStaffInvitationEmailMock).toHaveBeenCalled();
  });

  it("staff ロールは招待できない", async () => {
    const result = await inviteStaffMember(STAFF_PROFILE, {
      businessId: "biz-1",
      email: "new@test.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("権限");
  });

  it("重複メールの場合はエラーメッセージを返す", async () => {
    insertStaffMemberMock.mockRejectedValue(new Error("unique constraint violation"));

    const result = await inviteStaffMember(BUSINESS_ADMIN_PROFILE, {
      businessId: "biz-1",
      email: "dup@test.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("招待済み");
  });
});

describe("disableStaff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("business_admin はスタッフを無効化できる", async () => {
    disableStaffMemberMock.mockResolvedValue(undefined);

    const result = await disableStaff(BUSINESS_ADMIN_PROFILE, "staff-1");
    expect(result.ok).toBe(true);
    expect(disableStaffMemberMock).toHaveBeenCalledWith("staff-1");
  });

  it("staff ロールは無効化できない", async () => {
    const result = await disableStaff(STAFF_PROFILE, "staff-1");
    expect(result.ok).toBe(false);
  });
});

describe("enableStaff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("business_admin はスタッフを再有効化できる", async () => {
    enableStaffMemberMock.mockResolvedValue(undefined);

    const result = await enableStaff(BUSINESS_ADMIN_PROFILE, "staff-1");
    expect(result.ok).toBe(true);
    expect(enableStaffMemberMock).toHaveBeenCalledWith("staff-1");
  });
});

describe("acceptInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("有効な招待を受諾してロールを更新する", async () => {
    findStaffMemberByIdMock.mockResolvedValue(SAMPLE_STAFF);
    acceptStaffInvitationMock.mockResolvedValue({ ...SAMPLE_STAFF, status: "active", user_id: "user-99" });
    updateProfileRoleMock.mockResolvedValue({ error: null });

    const result = await acceptInvitation("staff-1", "user-99", "staff@test.com");
    expect(result.ok).toBe(true);
    expect(acceptStaffInvitationMock).toHaveBeenCalledWith("staff-1", "user-99");
  });

  it("招待が存在しない場合はエラー", async () => {
    findStaffMemberByIdMock.mockResolvedValue(null);

    const result = await acceptInvitation("nonexistent", "user-99", "staff@test.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("見つかりません");
  });

  it("すでに受諾済みの招待はエラー", async () => {
    findStaffMemberByIdMock.mockResolvedValue({ ...SAMPLE_STAFF, status: "active" });

    const result = await acceptInvitation("staff-1", "user-99", "staff@test.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("使用済み");
  });

  it("メールアドレスが一致しない場合はエラー", async () => {
    findStaffMemberByIdMock.mockResolvedValue(SAMPLE_STAFF);

    const result = await acceptInvitation("staff-1", "user-99", "other@test.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("一致しません");
  });
});

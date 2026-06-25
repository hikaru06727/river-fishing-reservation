import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findProfileByUserIdMaybeMock,
  findStaffMemberByUserIdMock,
} = vi.hoisted(() => ({
  findProfileByUserIdMaybeMock: vi.fn(),
  findStaffMemberByUserIdMock: vi.fn(),
}));

const mockUser = { id: "user-1", email: "test@example.com" };

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn(),
    }),
  ),
}));

vi.mock("@/lib/repositories/profiles.repository", () => ({
  findProfileByUserId: vi.fn(),
  findProfileByUserIdMaybe: findProfileByUserIdMaybeMock,
  findProfileEmailAndRoleByUserId: vi.fn(),
}));

vi.mock("@/lib/repositories/staff-members.repository", () => ({
  findStaffMemberByUserId: findStaffMemberByUserIdMock,
  findStaffMembersByBusinessId: vi.fn(),
  findStaffMemberById: vi.fn(),
  findStaffMemberByEmail: vi.fn(),
  insertStaffMember: vi.fn(),
  updateStaffMember: vi.fn(),
  acceptStaffInvitation: vi.fn(),
  disableStaffMember: vi.fn(),
  enableStaffMember: vi.fn(),
  findAssignedBusinessIdsByStaffUserId: vi.fn(),
}));

import { getAuthenticatedManagement } from "./get-user";

describe("getAuthenticatedManagement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin ロールはそのまま認証される", async () => {
    findProfileByUserIdMaybeMock.mockResolvedValue({ id: "user-1", role: "admin" });

    const result = await getAuthenticatedManagement();
    expect(result).not.toBeNull();
    expect(result?.profile.role).toBe("admin");
    expect(findStaffMemberByUserIdMock).not.toHaveBeenCalled();
  });

  it("business_admin ロールはそのまま認証される", async () => {
    findProfileByUserIdMaybeMock.mockResolvedValue({ id: "user-1", role: "business_admin" });

    const result = await getAuthenticatedManagement();
    expect(result).not.toBeNull();
    expect(result?.profile.role).toBe("business_admin");
    expect(findStaffMemberByUserIdMock).not.toHaveBeenCalled();
  });

  it("staff かつ active なら認証される", async () => {
    findProfileByUserIdMaybeMock.mockResolvedValue({ id: "user-1", role: "staff" });
    findStaffMemberByUserIdMock.mockResolvedValue({ id: "sm-1", user_id: "user-1", status: "active" });

    const result = await getAuthenticatedManagement();
    expect(result).not.toBeNull();
    expect(findStaffMemberByUserIdMock).toHaveBeenCalledWith("user-1");
  });

  it("staff かつ disabled（findStaffMemberByUserId が null）なら認証拒否", async () => {
    findProfileByUserIdMaybeMock.mockResolvedValue({ id: "user-1", role: "staff" });
    findStaffMemberByUserIdMock.mockResolvedValue(null);

    const result = await getAuthenticatedManagement();
    expect(result).toBeNull();
  });

  it("user ロールは認証拒否", async () => {
    findProfileByUserIdMaybeMock.mockResolvedValue({ id: "user-1", role: "user" });

    const result = await getAuthenticatedManagement();
    expect(result).toBeNull();
    expect(findStaffMemberByUserIdMock).not.toHaveBeenCalled();
  });
});

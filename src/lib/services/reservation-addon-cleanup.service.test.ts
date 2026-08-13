import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listUnresolvedAddonCleanupIssues,
  resolveAddonCleanupIssue,
} from "@/lib/services/reservation-addon-cleanup.service";

const {
  findAssignedBusinessIdsByUserIdMock,
  findAssignedBusinessIdsByStaffUserIdMock,
  findUnresolvedAddonCleanupIssuesByBusinessIdMock,
  markAddonCleanupIssueResolvedMock,
} = vi.hoisted(() => ({
  findAssignedBusinessIdsByUserIdMock: vi.fn(),
  findAssignedBusinessIdsByStaffUserIdMock: vi.fn(),
  findUnresolvedAddonCleanupIssuesByBusinessIdMock: vi.fn(),
  markAddonCleanupIssueResolvedMock: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: findAssignedBusinessIdsByUserIdMock,
}));

vi.mock("@/lib/repositories/staff-members.repository", () => ({
  findAssignedBusinessIdsByStaffUserId: findAssignedBusinessIdsByStaffUserIdMock,
}));

vi.mock("@/lib/repositories/reservation-addon-cleanup-issues.repository", () => ({
  findUnresolvedAddonCleanupIssuesByBusinessId: findUnresolvedAddonCleanupIssuesByBusinessIdMock,
  markAddonCleanupIssueResolved: markAddonCleanupIssueResolvedMock,
}));

const BIZ_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RES_ID = "res-2222-2222-2222-222222222222";
const PROFILE_BA = { id: "ba-user-id", role: "business_admin" as const };
const PROFILE_STAFF = { id: "staff-user-id", role: "staff" as const };
const PROFILE_OTHER_BA = { id: "other-ba-id", role: "business_admin" as const };
const PROFILE_USER = { id: "user-id", role: "user" as const };

const SAMPLE_ISSUE = {
  id: "issue-1",
  reservation_id: RES_ID,
  business_id: BIZ_A,
  failed_steps: ["restore_stock"] as const,
  detail: "Error: stock restore failed",
  created_at: new Date().toISOString(),
  resolved_at: null,
  resolved_by: null,
  resolution_note: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  findAssignedBusinessIdsByUserIdMock.mockResolvedValue([BIZ_A]);
  findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue([BIZ_A]);
});

// ============================================================
// listUnresolvedAddonCleanupIssues（アドオン後処理失敗・要対応パネル）
// ============================================================
describe("listUnresolvedAddonCleanupIssues", () => {
  it("business_admin が未対応のアドオン後処理失敗一覧を取得できる", async () => {
    findUnresolvedAddonCleanupIssuesByBusinessIdMock.mockResolvedValue([SAMPLE_ISSUE]);

    const result = await listUnresolvedAddonCleanupIssues(PROFILE_BA, { businessId: BIZ_A });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([SAMPLE_ISSUE]);
  });

  it("staff も ADDON_CLEANUP_MANAGE を持つため閲覧できる", async () => {
    findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue([BIZ_A]);
    findUnresolvedAddonCleanupIssuesByBusinessIdMock.mockResolvedValue([]);

    const result = await listUnresolvedAddonCleanupIssues(PROFILE_STAFF, { businessId: BIZ_A });

    expect(result.ok).toBe(true);
  });

  it("他事業の一覧は 403 を返す", async () => {
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue(["other-biz"]);

    const result = await listUnresolvedAddonCleanupIssues(PROFILE_OTHER_BA, {
      businessId: BIZ_A,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("一般ユーザーは 403 を返す", async () => {
    const result = await listUnresolvedAddonCleanupIssues(PROFILE_USER, { businessId: BIZ_A });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("取得エラー時は 500 を返す", async () => {
    findUnresolvedAddonCleanupIssuesByBusinessIdMock.mockRejectedValue(new Error("DB error"));

    const result = await listUnresolvedAddonCleanupIssues(PROFILE_BA, { businessId: BIZ_A });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
  });
});

// ============================================================
// resolveAddonCleanupIssue（アドオン後処理失敗を対応済みにする）
// ============================================================
describe("resolveAddonCleanupIssue", () => {
  it("business_admin がアドオン後処理失敗を対応済みにできる", async () => {
    markAddonCleanupIssueResolvedMock.mockResolvedValue(true);

    const result = await resolveAddonCleanupIssue(PROFILE_BA, {
      businessId: BIZ_A,
      issueId: SAMPLE_ISSUE.id,
      note: "在庫を手動で調整済み",
    });

    expect(result.ok).toBe(true);
    expect(markAddonCleanupIssueResolvedMock).toHaveBeenCalledWith(
      SAMPLE_ISSUE.id,
      BIZ_A,
      PROFILE_BA.id,
      "在庫を手動で調整済み",
    );
  });

  it("staff は ADDON_CLEANUP_MANAGE があっても対応済みにはできない（403）", async () => {
    const result = await resolveAddonCleanupIssue(PROFILE_STAFF, {
      businessId: BIZ_A,
      issueId: SAMPLE_ISSUE.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(markAddonCleanupIssueResolvedMock).not.toHaveBeenCalled();
  });

  it("他事業の記録は 403 を返す", async () => {
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue(["other-biz"]);

    const result = await resolveAddonCleanupIssue(PROFILE_OTHER_BA, {
      businessId: BIZ_A,
      issueId: SAMPLE_ISSUE.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("対象が見つからない・既に対応済みの場合は 404 を返す", async () => {
    markAddonCleanupIssueResolvedMock.mockResolvedValue(false);

    const result = await resolveAddonCleanupIssue(PROFILE_BA, {
      businessId: BIZ_A,
      issueId: SAMPLE_ISSUE.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("更新エラー時は 500 を返す", async () => {
    markAddonCleanupIssueResolvedMock.mockRejectedValue(new Error("DB error"));

    const result = await resolveAddonCleanupIssue(PROFILE_BA, {
      businessId: BIZ_A,
      issueId: SAMPLE_ISSUE.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Repository 集約後、get-* / auth / email / page が
 * Supabase client を直接 import していないことを文書化するテスト。
 */
describe("Supabase client isolation (static)", () => {
  const root = resolve(__dirname, "../..");

  function fileMustNotImport(relativePath: string, forbidden: string) {
    const content = readFileSync(resolve(root, relativePath), "utf-8");
    expect(content).not.toContain(forbidden);
  }

  function fileMustNotImportFrom(relativePath: string, forbidden: string) {
    const content = readFileSync(resolve(root, relativePath), "utf-8");
    expect(content).not.toMatch(new RegExp(`\\.from\\(["']${forbidden}`));
  }

  // Phase 1
  it("get-reservation.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/reservations/get-reservation.ts", "createClient");
    fileMustNotImport("lib/reservations/get-reservation.ts", "@/lib/supabase/server");
  });

  it("get-my-reservations.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/reservations/get-my-reservations.ts", "createClient");
  });

  it("get-admin-reservations.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/reservations/get-admin-reservations.ts", "createClient");
  });

  it("management-access.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/auth/management-access.ts", "createClient");
    fileMustNotImport("lib/auth/management-access.ts", "@/lib/supabase/server");
  });

  it("checkout route は createAdminClient を直接使わない", () => {
    fileMustNotImport("app/api/checkout/route.ts", "createAdminClient");
  });

  it("webhook route は createAdminClient を直接使わない", () => {
    fileMustNotImport("app/api/webhooks/stripe/route.ts", "createAdminClient");
  });

  // Phase 2
  it("get-user.ts は profiles テーブルを直接クエリしない", () => {
    fileMustNotImportFrom("lib/auth/get-user.ts", "profiles");
  });

  it("fetch-profile-role.ts は profiles テーブルを直接クエリしない", () => {
    fileMustNotImportFrom("lib/auth/fetch-profile-role.ts", "profiles");
  });

  it("get-spots.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/spots/get-spots.ts", "createClient");
    fileMustNotImport("lib/spots/get-spots.ts", "@/lib/supabase/server");
  });

  it("get-spot-by-id.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/spots/get-spot-by-id.ts", "createClient");
  });

  it("get-spot-by-slug.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/spots/get-spot-by-slug.ts", "createClient");
  });

  it("get-plans.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/plans/get-plans.ts", "createClient");
  });

  it("get-plan-by-slug.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/plans/get-plan-by-slug.ts", "createClient");
  });

  it("admin-notification-recipients.ts は createAdminClient を直接使わない", () => {
    fileMustNotImport("lib/email/admin-notification-recipients.ts", "createAdminClient");
  });

  it("reserve/complete/page.tsx は createAdminClient を直接使わない", () => {
    fileMustNotImport("app/reserve/complete/page.tsx", "createAdminClient");
  });

  it("api/spots route は createClient を直接使わない", () => {
    fileMustNotImport("app/api/spots/route.ts", "createClient");
  });

  it("api/plans route は createClient を直接使わない", () => {
    fileMustNotImport("app/api/plans/route.ts", "createClient");
  });

  // Phase 3 — blog / catches
  it("blog page は createClient を直接使わない", () => {
    fileMustNotImport("app/(public)/blog/page.tsx", "createClient");
    fileMustNotImportFrom("app/(public)/blog/page.tsx", "blog_posts");
  });

  it("blog slug page は createClient を直接使わない", () => {
    fileMustNotImport("app/(public)/blog/[slug]/page.tsx", "createClient");
  });

  it("catches page は createClient を直接使わない", () => {
    fileMustNotImport("app/(public)/catches/page.tsx", "createClient");
  });

  it("catches detail page は createClient を直接使わない", () => {
    fileMustNotImport("app/(public)/catches/[id]/page.tsx", "createClient");
  });

  it("api/blog routes は createClient を直接使わない", () => {
    fileMustNotImport("app/api/blog/route.ts", "createClient");
    fileMustNotImport("app/api/blog/[slug]/route.ts", "createClient");
  });

  it("api/catches routes は createClient を直接使わない", () => {
    fileMustNotImport("app/api/catches/route.ts", "createClient");
    fileMustNotImport("app/api/catches/[id]/route.ts", "createClient");
  });

  it("admin blog actions は createAdminClient を直接使わない", () => {
    fileMustNotImport("app/(admin)/admin/blog/actions.ts", "createAdminClient");
    fileMustNotImportFrom("app/(admin)/admin/blog/actions.ts", "blog_posts");
  });

  it("admin catches actions は createAdminClient を直接使わない", () => {
    fileMustNotImport("app/(admin)/admin/catches/actions.ts", "createAdminClient");
    fileMustNotImportFrom("app/(admin)/admin/catches/actions.ts", "catch_reports");
  });

  it("get-admin-plans.ts は createClient を直接使わない", () => {
    fileMustNotImport("lib/plans/get-admin-plans.ts", "createClient");
    fileMustNotImport("lib/plans/get-admin-plans.ts", "@/lib/supabase/server");
  });

  it("admin plans actions は createClient を直接使わない", () => {
    fileMustNotImport("app/(admin)/admin/plans/actions.ts", "createClient");
    fileMustNotImportFrom("app/(admin)/admin/plans/actions.ts", "plans");
  });

  // Phase 4 — reservations API
  it("api/reservations/[id] route は createClient を直接使わない", () => {
    fileMustNotImport("app/api/reservations/[id]/route.ts", "createClient");
    fileMustNotImportFrom("app/api/reservations/[id]/route.ts", "reservations");
  });
});

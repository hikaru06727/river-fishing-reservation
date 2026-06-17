import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Repository 集約後、get-* / management-access / checkout / webhook が
 * Supabase client を直接 import していないことを文書化するテスト。
 */
describe("Supabase client isolation (static)", () => {
  const root = resolve(__dirname, "../..");

  function fileMustNotImport(relativePath: string, forbidden: string) {
    const content = readFileSync(resolve(root, relativePath), "utf-8");
    expect(content).not.toContain(forbidden);
  }

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
});

import { getManagementScope } from "@/lib/auth/management-access";
import { isAdminRole } from "@/lib/auth/role";

const ROLE_LABELS = {
  admin: "管理者",
  business_admin: "事業管理者",
} as const;

export async function ManagementContextBar() {
  const scope = await getManagementScope();

  if (!scope) {
    return null;
  }

  const roleLabel = ROLE_LABELS[scope.role as keyof typeof ROLE_LABELS] ?? scope.role;

  return (
    <div className="rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-foreground">
          ログイン中:{" "}
          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {roleLabel}
          </span>
        </p>
        {isAdminRole(scope.role) ? (
          <p className="text-muted">全事業の管理権限</p>
        ) : scope.businessNames && scope.businessNames.length > 0 ? (
          <p className="text-muted">
            担当事業:{" "}
            <span className="font-medium text-foreground">
              {scope.businessNames.join("、")}
            </span>
          </p>
        ) : (
          <p className="text-amber-700">担当事業が未割当です</p>
        )}
      </div>
    </div>
  );
}

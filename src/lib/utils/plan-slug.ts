/** 管理画面プラン用の slug を自動生成 */
export function generatePlanSlug(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const base = normalized.length > 0 ? normalized : "plan";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

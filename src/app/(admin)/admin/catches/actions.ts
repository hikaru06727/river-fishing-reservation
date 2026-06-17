"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { insertCatchReportAdmin } from "@/lib/repositories/catch-reports.repository";
import { catchSchema } from "@/validations/reservation";

function parseLengthCm(size: string | undefined): number | null {
  if (!size) {
    return null;
  }
  const match = size.match(/([\d.]+)/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export async function createCatch(formData: FormData) {
  const session = await getAuthenticatedManagement();
  if (!session) {
    throw new Error("Forbidden");
  }
  const { user } = session;

  const parsed = catchSchema.safeParse({
    spotId: formData.get("spotId"),
    date: formData.get("date"),
    species: formData.get("species"),
    size: formData.get("size") ?? undefined,
    excerpt: formData.get("excerpt") ?? undefined,
    body: formData.get("body"),
  });

  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    throw new Error(firstError ?? "入力エラー");
  }

  const { spotId, date, species, size, excerpt, body } = parsed.data;
  const title = size ? `${species} ${size}` : species;
  const description = excerpt ? `${excerpt}\n\n${body}` : body;
  const now = new Date().toISOString();

  await insertCatchReportAdmin({
    spot_id: spotId,
    author_id: user.id,
    title,
    fish_species: species,
    length_cm: parseLengthCm(size),
    description,
    caught_date: date,
    status: "published",
    published_at: now,
  });

  revalidatePath("/catches");
  revalidatePath("/admin/catches");
  redirect("/admin/catches");
}

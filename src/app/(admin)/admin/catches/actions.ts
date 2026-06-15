"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";
import { isAdminUser } from "@/lib/auth/role";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const user = await getUser();
  if (!user || !isAdminUser(user)) {
    throw new Error("Forbidden");
  }

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

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("catch_reports").insert({
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

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/catches");
  revalidatePath("/admin/catches");
  redirect("/admin/catches");
}

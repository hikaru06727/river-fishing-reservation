import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/role";

export async function getUser() {  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getProfile() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function requireUser() {
  const user = await getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function requireAdmin() {
  const user = await getUser();

  if (!user || !isAdminUser(user)) {
    throw new Error("Forbidden");
  }

  return user;
}

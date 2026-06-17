import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isManagementProfile } from "@/lib/auth/role";
import type { Profile } from "@/types/database";

export type AuthNavState = {
  isLoggedIn: boolean;
  email: string | null;
  isAdmin: boolean;
};

export async function getAuthNavState(): Promise<AuthNavState> {
  const user = await getUser();
  if (!user) {
    return { isLoggedIn: false, email: null, isAdmin: false };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    isLoggedIn: true,
    email: profile?.email ?? user.email ?? null,
    isAdmin: isManagementProfile(profile),
  };
}

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getUser();

  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function getAuthenticatedManagement(): Promise<{
  user: User;
  profile: Profile;
} | null> {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isManagementProfile(profile)) {
    return null;
  }

  return { user, profile };
}

/** @deprecated getAuthenticatedManagement を使用 */
export async function getAuthenticatedAdmin(): Promise<{
  user: User;
  profile: Profile;
} | null> {
  return getAuthenticatedManagement();
}

export async function requireUser(): Promise<User> {
  const user = await getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function requireAdmin(): Promise<{ user: User; profile: Profile }> {
  const session = await getAuthenticatedManagement();

  if (!session) {
    throw new Error("Forbidden");
  }

  return session;
}

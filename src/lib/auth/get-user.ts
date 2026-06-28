import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  findProfileByUserId,
  findProfileByUserIdMaybe,
  findProfileEmailAndRoleByUserId,
} from "@/lib/repositories/profiles.repository";
import { findStaffMemberByUserId } from "@/lib/repositories/staff-members.repository";
import { isManagementProfile, isStaffRole } from "@/lib/auth/role";
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

  try {
    const profile = await findProfileEmailAndRoleByUserId(user.id);

    return {
      isLoggedIn: true,
      email: profile?.email ?? user.email ?? null,
      isAdmin: isManagementProfile(profile),
    };
  } catch (error) {
    console.error("[getAuthNavState]", error instanceof Error ? error.message : error);
    return {
      isLoggedIn: true,
      email: user.email ?? null,
      isAdmin: false,
    };
  }
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

  try {
    return await findProfileByUserId(user.id);
  } catch (error) {
    console.error("[getProfile]", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getAuthenticatedManagement(): Promise<{
  user: User;
  profile: Profile;
} | null> {
  const user = await getUser();
  if (!user) {
    return null;
  }

  try {
    const profile = await findProfileByUserIdMaybe(user.id);

    if (!profile || !isManagementProfile(profile)) {
      return null;
    }

    // staff は staff_members.status = 'active' の場合のみ許可
    if (isStaffRole(profile.role)) {
      const staffMember = await findStaffMemberByUserId(user.id);
      if (!staffMember) return null;
    }

    return { user, profile };
  } catch (error) {
    console.error(
      "[getAuthenticatedManagement]",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
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

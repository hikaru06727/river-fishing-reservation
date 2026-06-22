import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase 環境変数が未設定です。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。",
    );
  }

  // よくある誤り: ダッシュボード URL に "-project" が混入している
  if (url.includes("-project.supabase.co")) {
    const suggested = url.replace("-project.supabase.co", ".supabase.co");
    console.error(
      "[createClient] URL 形式が不正です:",
      url,
      "→ 正しい形式の例:",
      suggested,
    );
    throw new Error(
      `Supabase URL が不正です。"-project" を除いた ${suggested} を .env.local に設定してください。`,
    );
  }

  return { url, anonKey };
}

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  const client = createServerClient<Database>(url, anonKey, {
    global: {
      fetch: noStoreFetch,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component からの呼び出し時は set 不可
        }
      },
    },
  });

  return client as unknown as SupabaseClient<Database>;
}

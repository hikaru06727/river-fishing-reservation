import { logout } from "@/app/(auth)/actions";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={
          className ??
          "text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
        }
      >
        ログアウト
      </button>
    </form>
  );
}

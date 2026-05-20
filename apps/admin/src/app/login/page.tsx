import { authSignInWithToken } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  invalid_token: "Wrong token.",
  missing_token: "Paste your admin token.",
  not_admin:
    "Signed in, but the account doesn't have admin role. Fix in Supabase Studio.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/";
  const errorMessage = params.error ? ERROR_COPY[params.error] : null;

  const action = authSignInWithToken.bind(null, next);

  return (
    <div className="bg-hero flex min-h-dvh items-center justify-center px-4">
      <form
        action={action}
        className="border-border bg-card shadow-elev flex w-full max-w-sm flex-col gap-5 rounded-2xl border p-6"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-peacock shadow-glow flex h-10 w-10 items-center justify-center rounded-full text-base">
            🦚
          </span>
          <div>
            <p className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
              Mesita
            </p>
            <h1 className="font-display mt-0.5 text-2xl font-semibold tracking-tight">
              Admin sign-in
            </h1>
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              Paste the admin token.
            </p>
          </div>
        </div>

        <label className="block">
          <span className="text-muted-foreground mb-1.5 block text-xs font-medium">
            Token
          </span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="border-border bg-background focus:border-foreground/40 h-11 w-full rounded-xl border px-3 text-sm outline-none transition"
            placeholder="••••••••"
          />
        </label>

        {errorMessage && (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs leading-relaxed">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          className="bg-foreground text-background flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition hover:opacity-90"
        >
          Enter
        </button>
      </form>
    </div>
  );
}

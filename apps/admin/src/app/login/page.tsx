import { GoogleSignInButton } from "./GoogleSignInButton";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  oauth_failed:
    "Google sign-in failed. Try again, or ask another admin if it keeps happening.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? ERROR_COPY[params.error] : null;

  return (
    <div className="bg-hero flex min-h-dvh items-center justify-center px-4">
      <div className="border-border bg-card shadow-elev flex w-full max-w-sm flex-col gap-5 rounded-2xl border p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-peacock shadow-glow flex h-10 w-10 items-center justify-center rounded-full text-base">
            🦚
          </span>
          <div>
            <p className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
              Mesita
            </p>
            <h1 className="font-display mt-0.5 text-2xl font-semibold tracking-tight">
              Admin
            </h1>
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              Sign in with your Google account. Only allowlisted operators
              can perform admin actions — everyone else lands on a polite
              empty state.
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs leading-relaxed">
            {errorMessage}
          </p>
        )}

        <GoogleSignInButton />
      </div>
    </div>
  );
}

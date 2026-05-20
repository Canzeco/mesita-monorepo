import { MagicLinkForm } from "./MagicLinkForm";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  not_admin:
    "Signed in, but that account isn't an admin. Ask someone to set app_metadata.role = \"admin\" in Supabase Studio.",
  oauth_failed:
    "That sign-in didn't go through. Try the link again, or request a fresh one.",
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
              Admin sign-in
            </h1>
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              Enter your email. We&apos;ll send a one-tap sign-in link.
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs leading-relaxed">
            {errorMessage}
          </p>
        )}

        <MagicLinkForm next={next} />
      </div>
    </div>
  );
}

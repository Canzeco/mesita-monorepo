"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// Google + Apple OAuth buttons for the manager sign-in / sign-up surface.
//
// signInWithOAuth() opens a top-level redirect to the provider. After the
// user consents, Supabase Auth redirects back to /auth/callback?code=...
// which exchanges the code for a session and forwards to `next`.
//
// Supabase dashboard config (Authentication → Providers):
//   - Google: enable + paste Google Cloud OAuth Client ID + Secret
//   - Apple: enable + paste Services ID, Team ID, Key ID, Private Key
// Plus add https://manager.mesita.ai/auth/callback (and previews) to
// Authentication → URL Configuration → Redirect URLs.

type Provider = "google" | "apple";

export function OAuthButtons({ next }: { next: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: Provider) => {
    setBusy(provider);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
    // On success the browser is navigating away — no need to clear `busy`.
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => signIn("google")}
        className={cn(
          "border-border bg-background text-foreground hover:bg-muted flex h-12 w-full items-center justify-center gap-2.5 rounded-full border text-sm font-semibold transition disabled:opacity-60",
        )}
      >
        {busy === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </button>

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => signIn("apple")}
        className={cn(
          "bg-foreground text-background flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-sm font-semibold transition hover:opacity-90 disabled:opacity-60",
        )}
      >
        {busy === "apple" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AppleIcon className="h-4 w-4" />
        )}
        Continue with Apple
      </button>

      {error && (
        <p className={cn(ERROR_BOX_CLASS, "leading-relaxed")}>{error}</p>
      )}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.05 12.04c-.03-2.84 2.32-4.2 2.43-4.27-1.32-1.93-3.38-2.2-4.12-2.23-1.76-.18-3.43 1.03-4.32 1.03-.9 0-2.27-1.01-3.74-.98-1.92.03-3.7 1.12-4.69 2.84-2 3.47-.51 8.6 1.43 11.42.95 1.38 2.08 2.93 3.55 2.88 1.43-.06 1.97-.93 3.7-.93 1.73 0 2.21.93 3.72.9 1.54-.03 2.51-1.41 3.45-2.79 1.09-1.6 1.54-3.15 1.57-3.23-.04-.02-3.01-1.16-3.04-4.6zM14.21 4.04c.79-.96 1.33-2.29 1.18-3.62-1.14.05-2.52.76-3.34 1.71-.73.84-1.38 2.2-1.21 3.5 1.28.1 2.58-.65 3.37-1.59z" />
    </svg>
  );
}

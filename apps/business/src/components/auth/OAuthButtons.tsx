"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// Google OAuth button for the business sign-in / sign-up surface.
//
// signInWithOAuth() opens a top-level redirect to Google. After the user
// consents, Supabase Auth redirects back to /auth/callback?code=... which
// exchanges the code for a session and forwards to `next`.
//
// Supabase dashboard config (Authentication → Providers → Google):
// enable + paste Google Cloud OAuth Client ID + Secret. Plus add
// https://business.mesita.ai/auth/callback (and the *.vercel.app pattern)
// to Authentication → URL Configuration → Redirect URLs.

type Provider = "google";

export function OAuthButtons({ next }: { next: string }) {
  const supabase = useBrowserSupabase();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: Provider) => {
    setBusy(provider);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        // Force Google's account chooser. Without this, Google reuses
        // the active browser session and the user can't switch identities
        // after landing on an "Not authorised" / wrong-account state.
        queryParams: { prompt: "select_account" },
      },
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
        className="border-border bg-background text-foreground hover:bg-muted flex h-12 w-full items-center justify-center gap-2.5 rounded-full border text-sm font-semibold transition disabled:opacity-60"
      >
        {busy === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
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

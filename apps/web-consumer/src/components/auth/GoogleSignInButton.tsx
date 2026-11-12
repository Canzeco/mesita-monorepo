"use client";

import { useState } from "react";
import { Spinner } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { oauthCallbackPath } from "@/lib/auth-redirect";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";

// Continue with Google (MESITA-3777). Google sends the guest back to
// /auth/callback with the raw `next` (a Pay QR, a shared place), which
// turns the code into a session and runs post-signin like a phone code.
// `prompt=select_account` lets a phone with several Google accounts pick.
// The page hides this button inside app webviews, where Google refuses.
export function GoogleSignInButton({ next }: { next?: string }) {
  const supabase = useBrowserSupabase();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${oauthCallbackPath(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    // On success the browser is already on its way to Google.
    if (oauthError) {
      setError("We couldn't open Google. Try again, or use your phone.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending}
        className="border-border bg-card text-foreground flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? <Spinner size="sm" /> : <GoogleGlyph />}
        Continue with Google
      </button>
      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
    </div>
  );
}

// Google's four-colour mark, inline (lucide has no brand marks).
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.46c-.28 1.4-1.11 2.59-2.36 3.39v2.82h3.81c2.24-2.07 3.58-5.13 3.58-8.45z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.91-2.91l-3.81-2.97c-1.06.72-2.41 1.16-4.1 1.16-3.16 0-5.83-2.13-6.79-5h-4v3.06A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.21 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.67h-4A12 12 0 0 0 0 12c0 1.91.46 3.73 1.21 5.33l4-3.06z" />
      <path fill="#EA4335" d="M12 4.74c1.77 0 3.36.61 4.61 1.8l3.39-3.39C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.21 6.67l4 3.06C6.17 6.87 8.84 4.74 12 4.74z" />
    </svg>
  );
}

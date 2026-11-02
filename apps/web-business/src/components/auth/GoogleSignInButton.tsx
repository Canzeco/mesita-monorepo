"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";

function getAuthBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const rawBase = configured && configured.length > 0 ? configured : window.location.origin;
  return rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
}

// Single "Sign in with Google" button. The OAuth redirectTo is the bare
// `/auth/callback` so it matches the Supabase allow-list verbatim —
// stashing extra state in query params would force every operator to
// register a wildcard variant. The admin shell always re-routes to /
// after signin; deep-link state isn't preserved (low-stakes for admin).
export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const redirectTo = `${getAuthBaseUrl()}/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          // Force Google's account chooser every time. Without this,
          // Google silently reuses whichever account is already logged
          // into the browser — operators can't switch identities after
          // landing on a "Not authorised" page.
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setPending(false);
      }
      // On success, the browser is already redirecting to Google.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start sign-in.");
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="border-border bg-background hover:bg-muted flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-semibold transition disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleGlyph />
        )}
        Sign in with Google
      </button>
      {error && (
        <p className={`${ERROR_BOX_CLASS} leading-relaxed`}>
          {error}
        </p>
      )}
    </>
  );
}

// Inline SVG — keeps the dep footprint flat (lucide doesn't ship the
// brand mark).
function GoogleGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.46c-.28 1.4-1.11 2.59-2.36 3.39v2.82h3.81c2.24-2.07 3.58-5.13 3.58-8.45z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.91-2.91l-3.81-2.97c-1.06.72-2.41 1.16-4.1 1.16-3.16 0-5.83-2.13-6.79-5h-4v3.06A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.21 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.67h-4A12 12 0 0 0 0 12c0 1.91.46 3.73 1.21 5.33l4-3.06z"
      />
      <path
        fill="#EA4335"
        d="M12 4.74c1.77 0 3.36.61 4.61 1.8l3.39-3.39C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.21 6.67l4 3.06C6.17 6.87 8.84 4.74 12 4.74z"
      />
    </svg>
  );
}

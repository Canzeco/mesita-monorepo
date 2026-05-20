"use client";

import { useMemo, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

// Magic-link sign-in for admin. Sends a one-tap email link via
// supabase.auth.signInWithOtp. The link target is /auth/callback, which
// exchanges the code for a session cookie. Middleware then verifies the
// resulting session has app_metadata.role === "admin"; if not, it
// signs the user out and bounces to /login?error=not_admin.

export function MagicLinkForm({ next }: { next: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email address.");
      setPending(false);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        // Don't create new users — admin emails must be pre-provisioned
        // in Supabase Studio with app_metadata.role = "admin".
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      // Supabase returns "Signups not allowed for otp" when the email
      // doesn't exist + shouldCreateUser is false. Translate that into
      // a clear admin-side message.
      const lower = error.message.toLowerCase();
      if (
        lower.includes("not allowed") ||
        lower.includes("signups") ||
        lower.includes("user not found")
      ) {
        setError(
          "That email isn't on the admin list. Ask someone to add you in Supabase Studio.",
        );
      } else {
        setError(error.message);
      }
      setPending(false);
      return;
    }

    setSent(true);
    setPending(false);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-secondary/10 text-secondary flex h-10 w-10 items-center justify-center rounded-full">
          <Mail className="h-5 w-5" />
        </span>
        <p className="font-display text-lg font-semibold tracking-tight">
          Check your inbox
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We sent a sign-in link to{" "}
          <span className="text-foreground font-semibold">{email}</span>.
          Click it to enter the admin console.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="text-muted-foreground hover:text-foreground mt-2 text-xs underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="block">
        <span className="text-muted-foreground mb-1.5 block text-xs font-medium">
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-border bg-background focus:border-foreground/40 h-11 w-full rounded-xl border px-3 text-sm outline-none transition"
          placeholder="you@canzeco.com"
        />
      </label>

      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs leading-relaxed">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Send magic link"
        )}
      </button>
    </form>
  );
}

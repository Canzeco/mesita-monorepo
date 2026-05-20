"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Phone,
  Send,
  Video,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiSubmitVerification,
  type Verification,
  type VerificationMethod,
} from "@/lib/api/verifications";
import { Field } from "@/components/shared";
import { INPUT_CLASS } from "@/lib/ui-classes";
import { isEmail } from "@/lib/validators";
import { cn } from "@/lib/utils";

// Three methods the manager can pick from. The first two are MOCKED for
// v0 — we just capture the choice. Only the video URL actually carries a
// payload, and even that we don't validate as a real video; the admin
// reviews it. Auto-mode (server-side) approves on insert regardless.
const METHODS: {
  id: VerificationMethod;
  label: string;
  blurb: string;
  Icon: typeof Phone;
}[] = [
  {
    id: "ai_call",
    label: "AI phone call",
    blurb:
      "We call the Google-listed phone with a 6-digit code. Pick up and read it back.",
    Icon: Phone,
  },
  {
    id: "video",
    label: "Walkthrough video",
    blurb:
      "Paste a ≤1-minute video URL showing the venue's interior (Loom, Drive, YouTube unlisted).",
    Icon: Video,
  },
  {
    id: "postcard",
    label: "Postcard",
    blurb:
      "We mail a code to the venue's listed address. Slowest option — takes a few days.",
    Icon: Mail,
  },
];

export function VerifyForm({
  venue,
  requesterEmail: initialEmail,
  latest,
}: {
  venue: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
  requesterEmail: string;
  latest: Verification | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [method, setMethod] = useState<VerificationMethod>("video");
  const [videoUrl, setVideoUrl] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [pending, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!isEmail(cleanEmail)) {
      setError("Contact email must look like name@domain.tld.");
      return;
    }
    if (method === "video") {
      const cleanUrl = videoUrl.trim();
      if (!/^https:\/\/[^\s]+$/.test(cleanUrl)) {
        setError("Paste an https:// URL to a hosted video.");
        return;
      }
    }

    startSubmit(async () => {
      try {
        await apiSubmitVerification(supabase, {
          venueId: venue.id,
          method,
          requesterEmail: cleanEmail,
          videoUrl: method === "video" ? videoUrl.trim() : undefined,
        });
        // Server refresh so the layout picks up the new status (which
        // may have flipped to 'active' under auto-mode).
        router.refresh();
        router.replace(`/unit/${venue.id}/home`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PendingBanner latest={latest} />

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Section title="What we'll verify">
          <div className="border-border bg-card grid grid-cols-1 gap-3 rounded-2xl border p-4 sm:grid-cols-2">
            <ReadOnlyField label="Venue">{venue.name}</ReadOnlyField>
            <ReadOnlyField label="Google-listed phone">
              {venue.phone ?? "—"}
            </ReadOnlyField>
            <ReadOnlyField label="Address" wide>
              {venue.address ?? "—"}
            </ReadOnlyField>
          </div>
        </Section>

        <Section title="Pick a method">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {METHODS.map((m) => {
              const Icon = m.Icon;
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "border-border flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition",
                    active
                      ? "border-foreground bg-foreground/[0.04] shadow-sm"
                      : "bg-card hover:border-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition",
                      active
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="font-display text-sm font-semibold tracking-tight">
                    {m.label}
                  </p>
                  <p className="text-muted-foreground text-[12px] leading-snug">
                    {m.blurb}
                  </p>
                </button>
              );
            })}
          </div>
        </Section>

        {method === "video" && (
          <Section title="Video URL">
            <Field
              label="Paste a hosted video URL"
              hint="≤1 minute. Loom, Drive, YouTube unlisted, anything public-via-link is fine."
            >
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://loom.com/share/..."
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
                required
                className={INPUT_CLASS}
              />
            </Field>
          </Section>
        )}

        <Section title="Contact email">
          <Field
            label="Where can we reach you if we need a follow-up?"
            hint="We'll only use this if the verification needs a second pass."
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              className={INPUT_CLASS}
            />
          </Field>
        </Section>

        {error && (
          <p className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition disabled:opacity-50",
              "bg-pink-gradient shadow-glow text-white",
            )}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit for verification
              </>
            )}
          </button>
          <p className="text-muted-foreground text-[12px]">
            Auto-mode may approve instantly — otherwise an admin reviews
            within a day.
          </p>
        </div>
      </form>
    </div>
  );
}

function PendingBanner({ latest }: { latest: Verification | null }) {
  if (!latest) return null;
  if (latest.status === "pending") {
    return (
      <div className="border-secondary/40 bg-secondary/5 text-secondary flex items-start gap-3 rounded-2xl border p-4 text-sm">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Your latest request is awaiting review</p>
          <p className="mt-0.5 leading-relaxed">
            Submitting again replaces it. Pick the same method or a different
            one — both are valid.
          </p>
        </div>
      </div>
    );
  }
  if (latest.status === "rejected") {
    return (
      <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Your last request was rejected</p>
          <p className="mt-0.5 leading-relaxed">
            {latest.reject_reason ?? "No reason provided."}
          </p>
          <p className="mt-1 leading-relaxed">
            Try a different method or fix the issue and submit again.
          </p>
        </div>
      </div>
    );
  }
  if (latest.status === "approved") {
    return (
      <div className="border-secondary/40 bg-secondary/5 text-secondary flex items-start gap-3 rounded-2xl border p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="font-semibold">
          Already approved. You should be redirected to your venue shortly.
        </p>
      </div>
    );
  }
  return null;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ReadOnlyField({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-muted-foreground text-[10px] font-medium tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{children}</p>
    </div>
  );
}

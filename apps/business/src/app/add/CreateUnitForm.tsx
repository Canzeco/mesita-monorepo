"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Send,
  Sparkles,
  Video,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiEnrichCreateVenue,
  apiPlacesAutocomplete,
  type PlacePrediction,
} from "@/lib/api/venues";
import {
  apiLookupVenue,
  apiSubmitVerification,
  apiVerifyCallCode,
  type LookupResult,
  type LookupVenue,
  type VerificationMethod,
} from "@/lib/api/verifications";
import { Field } from "@/components/shared";
import { INPUT_CLASS } from "@/lib/ui-classes";
import { isEmail } from "@/lib/validators";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 220;

// Two verification methods. Postcard came up in the schema but UX-wise
// is too slow for v0; not surfaced. The EF still accepts it if needed
// later.
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
      "Paste a ≤3-minute video URL showing the venue's interior (Loom, Drive, YouTube unlisted).",
    Icon: Video,
  },
];

export function CreateUnitForm({ signedInEmail }: { signedInEmail: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  // Search/autocomplete state.
  const sessionTokenRef = useRef(newSessionToken());
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlacePrediction | null>(null);

  // Lookup state (after pick).
  const [lookupPending, startLookup] = useTransition();
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Generate-profile state (manager-create-unit).
  const [generatePending, startGenerate] = useTransition();
  const [generateStage, setGenerateStage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Submit-verification state.
  const [method, setMethod] = useState<VerificationMethod>("video");
  const [videoUrl, setVideoUrl] = useState("");
  const [email, setEmail] = useState(signedInEmail);
  const [verifyPending, startVerify] = useTransition();
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // ai_call phase 2: after submit returns, we sit on an OTP card until
  // the operator enters the 6-digit code (or cancels back to the
  // method picker).
  const [otp, setOtp] = useState<
    | {
        verificationId: string;
        venueId: string;
        venuePhone: string | null;
        mockCode: string | null;
      }
    | null
  >(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpPending, startOtp] = useTransition();
  const [otpError, setOtpError] = useState<string | null>(null);

  // Debounced autocomplete.
  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await apiPlacesAutocomplete(
          supabase,
          query,
          sessionTokenRef.current,
        );
        if (!cancelled) setPredictions(results);
      } catch (err) {
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : "Search failed.");
          setPredictions([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, selected, supabase]);

  const pick = (prediction: PlacePrediction) => {
    setSelected(prediction);
    setQuery(`${prediction.mainText} · ${prediction.secondaryText}`.trim());
    setPredictions([]);
    setLookup(null);
    setLookupError(null);
    setGenerateError(null);
    setVerifyError(null);
    startLookup(async () => {
      try {
        const r = await apiLookupVenue(supabase, prediction.placeId);
        setLookup(r);
      } catch (err) {
        setLookupError(
          err instanceof Error ? err.message : "Could not look up that venue.",
        );
      }
    });
  };

  const reset = () => {
    setSelected(null);
    setQuery("");
    setPredictions([]);
    setLookup(null);
    setLookupError(null);
    setGenerateError(null);
    setVerifyError(null);
    sessionTokenRef.current = newSessionToken();
  };

  const refreshLookup = async () => {
    if (!selected) return;
    try {
      const r = await apiLookupVenue(supabase, selected.placeId);
      setLookup(r);
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : "Could not refresh lookup.",
      );
    }
  };

  const onGenerate = () => {
    if (!selected || generatePending) return;
    setGenerateError(null);
    setGenerateStage("Fetching Google profile…");
    const stages = [
      "Fetching Google profile…",
      "Scanning the venue's website…",
      "Cross-checking social signals…",
      "Synthesising the catalog entry…",
    ];
    let stageStep = 0;
    const stageInterval = window.setInterval(() => {
      stageStep = Math.min(stageStep + 1, stages.length - 1);
      setGenerateStage(stages[stageStep]);
    }, 6000);

    startGenerate(async () => {
      try {
        await apiEnrichCreateVenue(supabase, selected.placeId);
        setGenerateStage("Done");
        await refreshLookup();
      } catch (err) {
        setGenerateError(
          err instanceof Error ? err.message : "Could not create venue.",
        );
        setGenerateStage(null);
      } finally {
        window.clearInterval(stageInterval);
      }
    });
  };

  const onSubmitVerification = (
    e: React.FormEvent<HTMLFormElement>,
    venueId: string,
    venuePhone: string | null,
  ) => {
    e.preventDefault();
    setVerifyError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!isEmail(cleanEmail)) {
      setVerifyError("Contact email must look like name@domain.tld.");
      return;
    }
    if (method === "video") {
      if (!/^https:\/\/[^\s]+$/.test(videoUrl.trim())) {
        setVerifyError("Paste an https:// URL to a hosted video.");
        return;
      }
    }
    startVerify(async () => {
      try {
        const r = await apiSubmitVerification(supabase, {
          venueId,
          method,
          requesterEmail: cleanEmail,
          videoUrl: method === "video" ? videoUrl.trim() : undefined,
        });
        // ai_call always lands status='pending' — we wait for the
        // operator to enter the 6-digit code via the OTP card.
        if (method === "ai_call") {
          setOtp({
            verificationId: r.id,
            venueId,
            venuePhone,
            mockCode: r.mockCode,
          });
          setOtpCode("");
          setOtpError(null);
          return;
        }
        if (r.status === "approved") {
          router.push(`/unit/${venueId}/home`);
          router.refresh();
          return;
        }
        // Manual review — refresh the lookup so the UI shows
        // "pending_by_me" state with the new request.
        await refreshLookup();
      } catch (err) {
        setVerifyError(
          err instanceof Error ? err.message : "Could not submit.",
        );
      }
    });
  };

  const onVerifyOtp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!otp || otpPending) return;
    setOtpError(null);
    const cleanCode = otpCode.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setOtpError("Code must be 6 digits.");
      return;
    }
    startOtp(async () => {
      try {
        const { venueId } = await apiVerifyCallCode(
          supabase,
          otp.verificationId,
          cleanCode,
        );
        router.push(`/unit/${venueId}/home`);
        router.refresh();
      } catch (err) {
        setOtpError(err instanceof Error ? err.message : "Could not verify.");
      }
    });
  };

  const cancelOtp = () => {
    setOtp(null);
    setOtpCode("");
    setOtpError(null);
    // The pending row stays in the DB — operator can resubmit and a new
    // code will be generated (the EF dedups by deleting prior pending).
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Search card — big elevated input, the page's primary action. */}
      <div className="relative">
        <div className="border-border bg-card shadow-elev rounded-3xl border p-1">
          <div className="border-border bg-background flex items-center gap-3 rounded-[20px] border px-5">
            <Search className="text-muted-foreground h-5 w-5 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                if (selected) {
                  setSelected(null);
                  setLookup(null);
                }
                if (next.trim().length < 2) setPredictions([]);
              }}
              placeholder="Search by venue name — e.g. Casa Luminar, Strana…"
              className="placeholder:text-muted-foreground/60 h-14 w-full bg-transparent text-base outline-none"
            />
            {selected && !searching && !lookupPending && (
              <button
                type="button"
                onClick={reset}
                className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-semibold"
              >
                Clear
              </button>
            )}
            {(searching || lookupPending) && (
              <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
            )}
          </div>
        </div>

        {!selected && predictions.length > 0 && (
          <ul className="border-border bg-card shadow-elev absolute inset-x-0 z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border p-1">
            {predictions.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className="hover:bg-muted/60 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      p.inMesita
                        ? "bg-secondary/15 text-secondary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block truncate text-sm font-semibold">
                        {p.mainText}
                      </span>
                      {p.inMesita && (
                        <span className="bg-secondary/15 text-secondary inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                          On Mesita
                        </span>
                      )}
                    </span>
                    {p.secondaryText && (
                      <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
                        {p.secondaryText}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {searchError && (
        <p className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm">
          {searchError}
        </p>
      )}

      {!selected &&
        !searching &&
        !searchError &&
        query.trim().length >= 2 &&
        predictions.length === 0 && (
          <p className="text-muted-foreground px-1 text-xs">
            No matches. Try a different spelling, drop the city qualifier,
            or paste the venue&apos;s exact Google profile name.
          </p>
        )}

      {/* Result card */}
      {selected && lookupError && (
        <ErrorCard message={lookupError} onRetry={refreshLookup} />
      )}

      {selected && lookup && otp && (
        <OtpCard
          venuePhone={otp.venuePhone}
          mockCode={otp.mockCode}
          code={otpCode}
          setCode={setOtpCode}
          pending={otpPending}
          error={otpError}
          onSubmit={onVerifyOtp}
          onCancel={cancelOtp}
        />
      )}

      {selected && lookup && !otp && (
        <>
          {lookup.state === "not_in_mesita" && (
            <NotInMesitaCard
              prediction={selected}
              pending={generatePending}
              stage={generateStage}
              error={generateError}
              onGenerate={onGenerate}
            />
          )}

          {lookup.state === "web_listed_unclaimed" && (
            <WebListedCard
              venue={lookup.venue}
              method={method}
              setMethod={setMethod}
              videoUrl={videoUrl}
              setVideoUrl={setVideoUrl}
              email={email}
              setEmail={setEmail}
              pending={verifyPending}
              error={verifyError}
              onSubmit={(e) =>
                onSubmitVerification(e, lookup.venue.id, lookup.venue.phone)
              }
            />
          )}

          {lookup.state === "pending_by_me" && (
            <PendingByMeCard
              venue={lookup.venue}
              method={method}
              setMethod={setMethod}
              videoUrl={videoUrl}
              setVideoUrl={setVideoUrl}
              email={email}
              setEmail={setEmail}
              pending={verifyPending}
              error={verifyError}
              onSubmit={(e) =>
                onSubmitVerification(e, lookup.venue.id, lookup.venue.phone)
              }
            />
          )}

          {lookup.state === "pending_by_other" && (
            <PendingByOtherCard
              venue={lookup.venue}
              method={method}
              setMethod={setMethod}
              videoUrl={videoUrl}
              setVideoUrl={setVideoUrl}
              email={email}
              setEmail={setEmail}
              pending={verifyPending}
              error={verifyError}
              onSubmit={(e) =>
                onSubmitVerification(e, lookup.venue.id, lookup.venue.phone)
              }
            />
          )}

          {lookup.state === "verified_partner" && (
            <VerifiedPartnerCard
              venue={lookup.venue}
              ownerEmail={lookup.owner.email}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── State-specific cards ──────────────────────────────────────────────

function NotInMesitaCard({
  prediction,
  pending,
  stage,
  error,
  onGenerate,
}: {
  prediction: PlacePrediction;
  pending: boolean;
  stage: string | null;
  error: string | null;
  onGenerate: () => void;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <StatusBadge tone="muted">Not on Mesita yet</StatusBadge>
      <div>
        <p className="font-display text-lg font-semibold tracking-tight">
          {prediction.mainText}
        </p>
        {prediction.secondaryText && (
          <p className="text-muted-foreground text-[12px]">
            {prediction.secondaryText}
          </p>
        )}
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">
        We&apos;ll generate the Mesita profile from Google + the venue&apos;s
        own channels and list it as a web listing. After that you can claim
        ownership in the same step.
      </p>
      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onGenerate}
        disabled={pending}
        className={cn(
          "flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50",
          "bg-pink-gradient shadow-glow text-white",
        )}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {stage ?? "Generating profile…"}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate profile
          </>
        )}
      </button>
      <p className="text-muted-foreground text-center text-[11px]">
        Takes up to 60 seconds.
      </p>
    </section>
  );
}

function WebListedCard(props: {
  venue: LookupVenue;
  method: VerificationMethod;
  setMethod: (m: VerificationMethod) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-5">
      <StatusBadge tone="info">Web listed · no verified owner</StatusBadge>
      <VenueIdentity venue={props.venue} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        This venue is on Mesita but no one has proved ownership yet. Pick a
        method below to claim it.
      </p>
      <VerificationForm {...props} submitLabel="Submit verification" />
    </section>
  );
}

function PendingByMeCard(props: {
  venue: LookupVenue;
  method: VerificationMethod;
  setMethod: (m: VerificationMethod) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="border-secondary/30 bg-card flex flex-col gap-5 rounded-2xl border p-5">
      <StatusBadge tone="warn">
        <Clock className="h-3 w-3" />
        Your verification is awaiting review
      </StatusBadge>
      <VenueIdentity venue={props.venue} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        You can submit a fresh request below — it replaces the pending one.
      </p>
      <VerificationForm {...props} submitLabel="Replace pending request" />
    </section>
  );
}

function PendingByOtherCard(props: {
  venue: LookupVenue;
  method: VerificationMethod;
  setMethod: (m: VerificationMethod) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-5">
      <StatusBadge tone="warn">
        <Clock className="h-3 w-3" />
        Someone else is verifying — you can also submit
      </StatusBadge>
      <VenueIdentity venue={props.venue} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Another operator has a pending claim on this venue. Whoever gets
        approved first becomes the verified owner.
      </p>
      <VerificationForm {...props} submitLabel="Submit a competing claim" />
    </section>
  );
}

function VerifiedPartnerCard({
  venue,
  ownerEmail,
}: {
  venue: LookupVenue;
  ownerEmail: string | null;
}) {
  return (
    <section className="border-secondary/40 bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <StatusBadge tone="secondary">
        <CheckCircle2 className="h-3 w-3" />
        Verified partner
      </StatusBadge>
      <VenueIdentity venue={venue} />
      <div className="border-border bg-background flex items-center gap-3 rounded-xl border p-3">
        <span className="bg-muted text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <Mail className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[10px] font-medium tracking-[0.14em] uppercase">
            Owner
          </p>
          <p className="truncate text-sm font-semibold">
            {ownerEmail ?? "(email hidden)"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {ownerEmail && (
          <a
            href={`mailto:${ownerEmail}?subject=${encodeURIComponent(
              `About ${venue.name} on Mesita`,
            )}`}
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          >
            <Mail className="h-4 w-4" />
            Contact owner
          </a>
        )}
        <a
          href={`mailto:fraud@canzeco.com?subject=${encodeURIComponent(
            `Fraud report — ${venue.name} (${venue.id})`,
          )}`}
          className="border-destructive/40 text-destructive hover:bg-destructive/5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
        >
          <AlertTriangle className="h-4 w-4" />
          Report fraud
        </a>
      </div>
    </section>
  );
}

// AI-call phase 2. The submit EF dialled the venue's Google-listed
// phone with a 6-digit code; operator picks up, hears the code, types
// it here. In mock mode (no Twilio configured) the EF also returns
// the plain code so the operator can self-test the loop.
function OtpCard({
  venuePhone,
  mockCode,
  code,
  setCode,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  venuePhone: string | null;
  mockCode: string | null;
  code: string;
  setCode: (v: string) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <section className="border-foreground/15 bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <StatusBadge tone="info">
        <Phone className="h-3 w-3" />
        Call placed · enter the 6-digit code
      </StatusBadge>
      <p className="text-sm leading-relaxed">
        We rang{" "}
        <span className="font-mono font-semibold">
          {venuePhone ?? "(no phone on file)"}
        </span>{" "}
        and read out a 6-digit code. Pick up at the venue, write it down,
        and type it below.
      </p>

      {mockCode && (
        <div className="border-amber-200 bg-amber-50 text-amber-900 flex items-start gap-3 rounded-xl border p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Mock mode — no real call placed</p>
            <p className="mt-0.5 leading-relaxed">
              Twilio isn&apos;t configured yet, so type{" "}
              <span className="font-mono font-bold tracking-widest">
                {mockCode}
              </span>{" "}
              to complete the loop.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          autoFocus
          className="border-border bg-background h-14 w-full rounded-xl border px-4 text-center font-mono text-2xl tracking-[0.5em] outline-none"
        />
        {error && (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending || code.length !== 6}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50",
              "bg-pink-gradient shadow-glow text-white",
            )}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Verify code
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="border-border text-muted-foreground inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-destructive mt-1 inline-flex items-center gap-1 text-xs font-semibold underline"
        >
          Retry
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </section>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────

function VenueIdentity({ venue }: { venue: LookupVenue }) {
  return (
    <div className="border-border bg-background grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-2">
      <ReadOnlyField label="Venue" wide>
        {venue.name}
      </ReadOnlyField>
      <ReadOnlyField label="Google-listed phone">
        {venue.phone ?? "—"}
      </ReadOnlyField>
      <ReadOnlyField label="Address">{venue.address ?? "—"}</ReadOnlyField>
    </div>
  );
}

function VerificationForm({
  method,
  setMethod,
  videoUrl,
  setVideoUrl,
  email,
  setEmail,
  pending,
  error,
  onSubmit,
  submitLabel,
}: {
  method: VerificationMethod;
  setMethod: (m: VerificationMethod) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  : "bg-background hover:border-foreground/30",
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

      {method === "video" && (
        <Field
          label="Hosted video URL"
          hint="≤3 minutes. Loom, Drive, YouTube unlisted, anything public-via-link is fine."
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
      )}

      <Field
        label="Contact email"
        hint="Used only if we need a follow-up — we won't email you otherwise."
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

      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={cn(
          "flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50",
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
            {submitLabel}
          </>
        )}
      </button>
    </form>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "muted" | "info" | "warn" | "secondary";
  children: React.ReactNode;
}) {
  const cls = {
    muted: "bg-muted text-muted-foreground",
    info: "bg-secondary/15 text-secondary",
    warn: "bg-amber-100 text-amber-700",
    secondary: "bg-secondary/15 text-secondary",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase",
        cls,
      )}
    >
      {children}
    </span>
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
      <p className="mt-0.5 truncate text-sm font-semibold">{children}</p>
    </div>
  );
}

// Untouched helper from the previous version.
function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}


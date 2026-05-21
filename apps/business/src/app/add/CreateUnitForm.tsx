"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  Search,
  Sparkles,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiEnrichCreateVenue,
  apiPlacesAutocomplete,
  type PlacePrediction,
  type PredictionStatus,
} from "@/lib/api/venues";
import {
  apiLookupVenue,
  apiManagerSendsEmailOtp,
  apiManagerSendsPhoneOtp,
  apiManagerVerifiesEmail,
  apiManagerVerifiesPhone,
  type LookupMethods,
  type LookupResult,
  type LookupVenue,
} from "@/lib/api/verifications";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 220;

// Rolling status messages cycled into the Generate button while
// manager-create-unit is running.
const GENERATE_STAGE_MS = 6000;
const GENERATE_STAGES = [
  "Fetching Google profile…",
  "Scanning the venue's website…",
  "Cross-checking social signals…",
  "Synthesising the catalog entry…",
];

// Mesita ops WhatsApp number (E.164). Direct fallback channel for
// ownership claims that can't be auto-verified by phone or email.
// Hardcoded so the "Talk to us" button always works regardless of
// Supabase env config — the lookup EF still surfaces `methods.manual`
// but the UI no longer reads it.
const MESITA_OPS_WHATSAPP_E164 = "+524445499597";

// Callbacks the parent provides for each terminal outcome of a
// verification flow. The picker + bodies are self-contained but don't
// know the page's routing strategy.
type VerificationCallbacks = {
  supabase: SupabaseClient;
  signedInEmail: string;
  onApproved: (venueId: string) => void;
  onAwaitingAdmin: () => void;
};

export function CreateUnitForm({ signedInEmail }: { signedInEmail: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

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
          setSearchError(errMsg(err, "Search failed."));
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
    startLookup(async () => {
      try {
        const r = await apiLookupVenue(supabase, prediction.placeId);
        setLookup(r);
      } catch (err) {
        setLookupError(errMsg(err, "Could not look up that venue."));
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
    sessionTokenRef.current = newSessionToken();
  };

  const refreshLookup = async () => {
    if (!selected) return;
    try {
      const r = await apiLookupVenue(supabase, selected.placeId);
      setLookup(r);
    } catch (err) {
      setLookupError(errMsg(err, "Could not refresh lookup."));
    }
  };

  const onGenerate = () => {
    if (!selected || generatePending) return;
    setGenerateError(null);
    setGenerateStage(GENERATE_STAGES[0]);
    let stageStep = 0;
    const stageInterval = window.setInterval(() => {
      stageStep = Math.min(stageStep + 1, GENERATE_STAGES.length - 1);
      setGenerateStage(GENERATE_STAGES[stageStep]);
    }, GENERATE_STAGE_MS);

    startGenerate(async () => {
      try {
        await apiEnrichCreateVenue(supabase, selected.placeId);
        setGenerateStage("Done");
        await refreshLookup();
      } catch (err) {
        setGenerateError(errMsg(err, "Could not create venue."));
        setGenerateStage(null);
      } finally {
        window.clearInterval(stageInterval);
      }
    });
  };

  const verificationCallbacks: VerificationCallbacks = {
    supabase,
    signedInEmail,
    onApproved: (venueId) => {
      router.push(`/unit/${venueId}/home`);
      router.refresh();
    },
    onAwaitingAdmin: () => {
      void refreshLookup();
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search box */}
      <div className="relative">
        <div className="border-border bg-card shadow-elev rounded-[26px] border p-[5px]">
          <div className="border-border bg-background flex items-center gap-3 rounded-[20px] border px-5">
            <Search className="text-muted-foreground h-[19px] w-[19px] shrink-0" />
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
          <ul className="border-border bg-card shadow-elev absolute inset-x-0 z-20 mt-2.5 max-h-80 overflow-y-auto rounded-[18px] border p-1.5">
            {predictions.map((p) => {
              const status = predictionStatus(p);
              const meta = PREDICTION_BADGE[status];
              return (
                <li key={p.placeId}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="hover:bg-muted/60 flex w-full items-start gap-3 rounded-[13px] p-3 text-left transition"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        meta.iconClass,
                      )}
                    >
                      <meta.Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block truncate text-sm font-semibold">
                          {p.mainText}
                        </span>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] uppercase",
                            meta.badgeClass,
                          )}
                        >
                          {meta.label}
                        </span>
                      </span>
                      {p.secondaryText && (
                        <span className="text-muted-foreground mt-0.5 block truncate text-[11.5px]">
                          {p.secondaryText}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
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
          <p className="text-muted-foreground px-1 text-xs leading-relaxed">
            No matches. Try a different spelling, drop the city qualifier, or
            paste the venue&apos;s exact Google profile name.
          </p>
        )}

      {selected && lookupError && (
        <ErrorCard message={lookupError} onRetry={refreshLookup} />
      )}

      {selected && lookup && (
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
              methods={lookup.methods}
              {...verificationCallbacks}
            />
          )}

          {lookup.state === "pending_by_me" && (
            <PendingByMeCard
              venue={lookup.venue}
              methods={lookup.methods}
              codeVerified={
                typeof lookup.verification.payload.codeVerifiedAt === "string"
              }
              {...verificationCallbacks}
            />
          )}

          {lookup.state === "pending_by_other" && (
            <PendingByOtherCard
              venue={lookup.venue}
              methods={lookup.methods}
              {...verificationCallbacks}
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
    <section className="border-border bg-card flex flex-col gap-4 rounded-[22px] border p-6">
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
      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
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

function WebListedCard({
  venue,
  methods,
  ...callbacks
}: {
  venue: LookupVenue;
  methods: LookupMethods;
} & VerificationCallbacks) {
  return (
    <section className="border-border bg-card flex flex-col gap-5 rounded-[22px] border p-6">
      <StatusBadge tone="info">Web listed · no verified owner</StatusBadge>
      <VenueIdentity venue={venue} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Prove you own this venue. Phone and email checks land instantly when
        the code clears — manual takes a short look from our team.
      </p>
      <MethodsPicker venue={venue} methods={methods} {...callbacks} />
    </section>
  );
}

function PendingByMeCard({
  venue,
  methods,
  codeVerified,
  ...callbacks
}: {
  venue: LookupVenue;
  methods: LookupMethods;
  // True when the operator already passed the OTP step — the row is
  // only sitting in the admin queue because auto-verify is OFF for
  // that method. Different copy + no re-submit form.
  codeVerified: boolean;
} & VerificationCallbacks) {
  if (codeVerified) {
    return (
      <section className="border-secondary/40 bg-card flex flex-col gap-5 rounded-[22px] border p-6">
        <StatusBadge tone="secondary">
          <CheckCircle2 className="h-3 w-3" />
          Code verified · admin reviewing
        </StatusBadge>
        <VenueIdentity venue={venue} />
        <p className="text-muted-foreground text-sm leading-relaxed">
          We received your code and confirmed it&apos;s correct. A Mesita
          admin is doing a final review and will grant ownership shortly —
          you&apos;ll see this venue in your dashboard once they approve. No
          action needed from you.
        </p>
      </section>
    );
  }
  return (
    <section className="border-secondary/30 bg-card flex flex-col gap-5 rounded-[22px] border p-6">
      <StatusBadge tone="warn">
        <Clock className="h-3 w-3" />
        Your verification is awaiting review
      </StatusBadge>
      <VenueIdentity venue={venue} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Re-submit below if you didn&apos;t finish the loop — the new request
        replaces the pending one.
      </p>
      <MethodsPicker venue={venue} methods={methods} {...callbacks} />
    </section>
  );
}

function PendingByOtherCard({
  venue,
  methods,
  ...callbacks
}: {
  venue: LookupVenue;
  methods: LookupMethods;
} & VerificationCallbacks) {
  return (
    <section className="border-border bg-card flex flex-col gap-5 rounded-[22px] border p-6">
      <StatusBadge tone="warn">
        <Clock className="h-3 w-3" />
        Someone else is verifying — you can also submit
      </StatusBadge>
      <VenueIdentity venue={venue} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Another operator has a pending claim. Whoever proves ownership first
        wins — if it&apos;s really your venue, run any of the methods below.
      </p>
      <MethodsPicker venue={venue} methods={methods} {...callbacks} />
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
    <section className="border-secondary/40 bg-card flex flex-col gap-4 rounded-[22px] border p-6">
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

// ── Methods picker ────────────────────────────────────────────────────

// Three verification paths share the same parent card body. The picker
// only renders chips for the methods that are actually available — phone
// when the venue has a Google-listed number, email when a Firecrawl-
// discovered email is on-domain with the website, and the manual
// fallback always. A bare listing (no phone, no on-domain email)
// collapses to the manual body directly with no picker chrome.

type MethodKey = "phone" | "email" | "manual";

function MethodsPicker({
  venue,
  methods,
  ...callbacks
}: {
  venue: LookupVenue;
  methods: LookupMethods;
} & VerificationCallbacks) {
  const bareListing = !methods.phone.available && !methods.email.available;

  const initialMethod: MethodKey = methods.phone.available
    ? "phone"
    : methods.email.available
      ? "email"
      : "manual";

  const [method, setMethod] = useState<MethodKey>(initialMethod);

  if (bareListing) {
    // Skip the picker chrome entirely — there's only one option to take.
    return <WhatsAppBody venue={venue} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/70 grid grid-flow-col auto-cols-fr gap-1 rounded-2xl p-1">
        {methods.phone.available && (
          <MethodChip
            active={method === "phone"}
            onClick={() => setMethod("phone")}
          >
            <Phone className="h-4 w-4" />
            Phone
          </MethodChip>
        )}
        {methods.email.available && (
          <MethodChip
            active={method === "email"}
            onClick={() => setMethod("email")}
          >
            <Mail className="h-4 w-4" />
            Email
          </MethodChip>
        )}
        <MethodChip
          active={method === "manual"}
          onClick={() => setMethod("manual")}
        >
          <MessagesSquare className="h-4 w-4" />
          Talk to us
        </MethodChip>
      </div>

      {method === "phone" && (
        <PhoneBody venue={venue} methods={methods} {...callbacks} />
      )}
      {method === "email" && (
        <EmailBody venue={venue} methods={methods} {...callbacks} />
      )}
      {method === "manual" && <WhatsAppBody venue={venue} />}
    </div>
  );
}

function MethodChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
        active
          ? "bg-card text-foreground ring-foreground/5 shadow-md ring-1"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ── Phone OTP body ────────────────────────────────────────────────────

type CallState =
  | { kind: "idle" }
  | { kind: "placing" }
  | { kind: "awaiting_code"; verificationId: string; mockCode: string | null }
  | { kind: "verifying"; verificationId: string; mockCode: string | null };

function PhoneBody({
  venue,
  methods,
  supabase,
  signedInEmail,
  onApproved,
  onAwaitingAdmin,
}: {
  venue: LookupVenue;
  methods: LookupMethods;
} & VerificationCallbacks) {
  const [state, setState] = useState<CallState>({ kind: "idle" });
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const phoneDisplay = methods.phone.displayPhone ?? venue.phone ?? "";

  const placeCall = () => {
    if (state.kind === "placing" || state.kind === "verifying") return;
    setError(null);
    setOtpCode("");
    setState({ kind: "placing" });
    void (async () => {
      try {
        const r = await apiManagerSendsPhoneOtp(
          supabase,
          venue.id,
          signedInEmail,
        );
        setState({
          kind: "awaiting_code",
          verificationId: r.verificationId,
          mockCode: r.mockCode,
        });
      } catch (err) {
        setError(errMsg(err, "Could not place call."));
        setState({ kind: "idle" });
      }
    })();
  };

  const verifyCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.kind !== "awaiting_code") return;
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Code must be 6 digits.");
      return;
    }
    const { verificationId, mockCode } = state;
    setError(null);
    setState({ kind: "verifying", verificationId, mockCode });
    void (async () => {
      try {
        const { venueId: vId, awaitingAdmin } = await apiManagerVerifiesPhone(
          supabase,
          verificationId,
          code,
        );
        if (awaitingAdmin) onAwaitingAdmin();
        else onApproved(vId);
      } catch (err) {
        setError(errMsg(err, "Could not verify."));
        setState({ kind: "awaiting_code", verificationId, mockCode });
      }
    })();
  };

  if (state.kind === "idle" || state.kind === "placing") {
    const placing = state.kind === "placing";
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          We&apos;ll dial{" "}
          <span className="text-foreground font-mono font-semibold">
            {phoneDisplay}
          </span>{" "}
          and read out a 6-digit code. Pick up at the venue and type it in
          right here.
        </p>
        <button
          type="button"
          onClick={placeCall}
          disabled={placing}
          className={cn(
            "flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold transition disabled:opacity-50",
            "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {placing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Dialing…
            </>
          ) : (
            <>
              <Phone className="h-5 w-5" />
              Call my venue
            </>
          )}
        </button>
        {error && <ErrorBlurb>{error}</ErrorBlurb>}
      </div>
    );
  }

  const verifying = state.kind === "verifying";
  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-2 text-[12.5px] leading-snug">
        <span className="bg-secondary/10 text-secondary flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Phone className="h-3.5 w-3.5" />
        </span>
        <p>
          Called{" "}
          <span className="text-foreground font-mono font-semibold">
            {phoneDisplay}
          </span>
          . Pick up and type the 6-digit code we read out.
        </p>
      </div>

      <form onSubmit={verifyCode} className="flex flex-col gap-3">
        <OtpInput
          value={otpCode}
          onChange={setOtpCode}
          disabled={verifying}
          hasError={!!error}
          autoFocus
        />
        {state.mockCode && <MockCodePill code={state.mockCode} />}
        {error && <ErrorBlurb>{error}</ErrorBlurb>}

        <button
          type="submit"
          disabled={verifying || otpCode.length !== 6}
          className={cn(
            "mt-1 flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50",
            "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {verifying ? (
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
      </form>

      <button
        type="button"
        onClick={placeCall}
        disabled={verifying}
        className="text-muted-foreground hover:text-foreground -mt-1 inline-flex items-center justify-center gap-1.5 self-center text-[12px] font-medium transition disabled:opacity-50"
      >
        <Phone className="h-3.5 w-3.5" />
        Didn&apos;t pick up? Re-dial with a fresh code
      </button>
    </div>
  );
}

// ── Email OTP body ────────────────────────────────────────────────────

type EmailState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "awaiting_code"; verificationId: string; mockCode: string | null }
  | { kind: "verifying"; verificationId: string; mockCode: string | null };

function EmailBody({
  venue,
  methods,
  supabase,
  signedInEmail,
  onApproved,
  onAwaitingAdmin,
}: {
  venue: LookupVenue;
  methods: LookupMethods;
} & VerificationCallbacks) {
  const [state, setState] = useState<EmailState>({ kind: "idle" });
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const emailDisplay = methods.email.displayEmail ?? venue.email ?? "";

  const sendEmail = () => {
    if (state.kind === "sending" || state.kind === "verifying") return;
    setError(null);
    setOtpCode("");
    setState({ kind: "sending" });
    void (async () => {
      try {
        const r = await apiManagerSendsEmailOtp(
          supabase,
          venue.id,
          signedInEmail,
        );
        setState({
          kind: "awaiting_code",
          verificationId: r.verificationId,
          mockCode: r.mockCode,
        });
      } catch (err) {
        setError(errMsg(err, "Could not send code."));
        setState({ kind: "idle" });
      }
    })();
  };

  const verifyCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.kind !== "awaiting_code") return;
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Code must be 6 digits.");
      return;
    }
    const { verificationId, mockCode } = state;
    setError(null);
    setState({ kind: "verifying", verificationId, mockCode });
    void (async () => {
      try {
        const { venueId: vId, awaitingAdmin } = await apiManagerVerifiesEmail(
          supabase,
          verificationId,
          code,
        );
        if (awaitingAdmin) onAwaitingAdmin();
        else onApproved(vId);
      } catch (err) {
        setError(errMsg(err, "Could not verify."));
        setState({ kind: "awaiting_code", verificationId, mockCode });
      }
    })();
  };

  if (state.kind === "idle" || state.kind === "sending") {
    const sending = state.kind === "sending";
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          We&apos;ll email a 6-digit code to{" "}
          <span className="text-foreground font-mono font-semibold break-all">
            {emailDisplay}
          </span>{" "}
          — the address we found on the venue&apos;s own website. Open it and
          type the code in right here.
        </p>
        <button
          type="button"
          onClick={sendEmail}
          disabled={sending}
          className={cn(
            "flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold transition disabled:opacity-50",
            "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {sending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Mail className="h-5 w-5" />
              Email the code
            </>
          )}
        </button>
        {error && <ErrorBlurb>{error}</ErrorBlurb>}
      </div>
    );
  }

  const verifying = state.kind === "verifying";
  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-2 text-[12.5px] leading-snug">
        <span className="bg-secondary/10 text-secondary flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Mail className="h-3.5 w-3.5" />
        </span>
        <p>
          Code sent to{" "}
          <span className="text-foreground font-mono font-semibold break-all">
            {emailDisplay}
          </span>
          . Check the inbox and type it below.
        </p>
      </div>

      <form onSubmit={verifyCode} className="flex flex-col gap-3">
        <OtpInput
          value={otpCode}
          onChange={setOtpCode}
          disabled={verifying}
          hasError={!!error}
          autoFocus
        />
        {state.mockCode && <MockCodePill code={state.mockCode} />}
        {error && <ErrorBlurb>{error}</ErrorBlurb>}

        <button
          type="submit"
          disabled={verifying || otpCode.length !== 6}
          className={cn(
            "mt-1 flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50",
            "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {verifying ? (
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
      </form>

      <button
        type="button"
        onClick={sendEmail}
        disabled={verifying}
        className="text-muted-foreground hover:text-foreground -mt-1 inline-flex items-center justify-center gap-1.5 self-center text-[12px] font-medium transition disabled:opacity-50"
      >
        <Mail className="h-3.5 w-3.5" />
        Didn&apos;t get it? Re-send with a fresh code
      </button>
    </div>
  );
}

// ── WhatsApp fallback body ────────────────────────────────────────────

// Always-available manual path. Opens a wa.me deep-link with a
// prefilled claim message to Mesita ops. No DB row, no admin queue —
// ops handles the conversation directly. Phone/email auto-verify
// remain the happy paths; this is the fallback when neither is
// available or when the operator wants a human.
function WhatsAppBody({ venue }: { venue: LookupVenue }) {
  const waNumber = MESITA_OPS_WHATSAPP_E164.replace(/[^\d]/g, "");
  const message = `Hi Mesita — I'd like to claim "${venue.name}" on Mesita. Venue ID: ${venue.id}.`;
  const href = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        Send our team a WhatsApp — we&apos;ll verify in person and follow up.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="bg-whatsapp flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold text-white transition hover:opacity-90"
      >
        <MessageCircle className="h-5 w-5" />
        Talk to us on WhatsApp
      </a>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────

function MockCodePill({ code }: { code: string }) {
  return (
    <p className="inline-flex items-center justify-center gap-1.5 self-center rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800">
      <AlertTriangle className="h-3 w-3" />
      Mock mode · type{" "}
      <span className="font-mono font-bold tracking-[0.18em] text-amber-900">
        {code}
      </span>
    </p>
  );
}

function ErrorBlurb({ children }: { children: React.ReactNode }) {
  return <p className={cn(ERROR_BOX_CLASS, "text-sm")}>{children}</p>;
}

// 6-cell OTP input. Native <input> sits invisibly over the cells so
// autoComplete="one-time-code", paste, and the on-screen numeric
// keypad all keep working; the visible cells just reflect its value.
function OtpInput({
  value,
  onChange,
  disabled,
  hasError,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  hasError: boolean;
  autoFocus?: boolean;
}) {
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  // The "next empty" cell shows the focus ring while typing. Once all
  // six are filled, no cell is highlighted — the row reads as complete.
  const focusIndex = value.length < 6 ? value.length : -1;
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="6-digit verification code"
        aria-invalid={hasError}
        className="absolute inset-0 z-10 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none disabled:cursor-not-allowed"
      />
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
        {cells.map((char, i) => {
          const filled = char !== "";
          const focused = !disabled && i === focusIndex;
          return (
            <div
              key={i}
              className={cn(
                "bg-background flex h-14 items-center justify-center rounded-xl border font-mono text-2xl font-semibold tabular-nums transition",
                hasError
                  ? "border-destructive/50"
                  : focused
                    ? "border-primary ring-primary/15 ring-2"
                    : filled
                      ? "border-foreground/20"
                      : "border-border",
                disabled && "opacity-60",
              )}
            >
              {char}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Resolves a prediction to one of the four picker statuses.
function predictionStatus(p: PlacePrediction): PredictionStatus {
  if (p.status) return p.status;
  return p.inMesita ? "web_listed" : "not_in_mesita";
}

const PREDICTION_BADGE: Record<
  PredictionStatus,
  {
    label: string;
    Icon: typeof MapPin;
    iconClass: string;
    badgeClass: string;
  }
> = {
  not_in_mesita: {
    label: "Not on Mesita",
    Icon: MapPin,
    iconClass: "bg-muted text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
  },
  web_listed: {
    label: "Web listed",
    Icon: MapPin,
    iconClass: "bg-secondary/15 text-secondary",
    badgeClass: "bg-secondary/15 text-secondary",
  },
  verified_partner_other: {
    label: "Verified partner",
    Icon: CheckCircle2,
    iconClass: "bg-amber-100 text-amber-700",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  verified_partner_self: {
    label: "You own this",
    Icon: Crown,
    iconClass: "bg-pink-gradient text-white",
    badgeClass: "bg-pink-gradient text-white",
  },
};

function VenueIdentity({ venue }: { venue: LookupVenue }) {
  return (
    <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4">
      <p className="font-display text-lg leading-tight font-semibold tracking-tight">
        {venue.name}
      </p>
      <div className="text-muted-foreground flex flex-col gap-1.5 text-[12px] sm:flex-row sm:items-center sm:gap-4">
        <span className="inline-flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-mono">
            {venue.phone ?? (
              <span className="text-muted-foreground italic">
                no phone listed
              </span>
            )}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={venue.address ?? undefined}>
            {venue.address ?? "no address"}
          </span>
        </span>
      </div>
    </div>
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

function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

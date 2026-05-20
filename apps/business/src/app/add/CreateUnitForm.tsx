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
import type { SupabaseClient } from "@supabase/supabase-js";
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
} from "@/lib/api/verifications";
import { Field } from "@/components/shared";
import { INPUT_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 220;

// Callbacks the parent provides for each terminal outcome of the
// verification form. The form is self-contained — it owns method,
// OTP, and video state — but doesn't know the page's routing
// strategy, so the parent decides what to do.
type VerificationCallbacks = {
  supabase: SupabaseClient;
  signedInEmail: string;
  onApproved: (venueId: string) => void;
  onAwaitingAdmin: () => void;
  onPendingForReview: () => void;
};

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

  // Verification outcomes share the same wiring across all three
  // claimable-state cards: approved → push to the unit; pending
  // (admin queue or OTP-verified-awaiting-admin) → refresh the
  // lookup so the card re-renders into the right pending state.
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
    onPendingForReview: () => {
      void refreshLookup();
    },
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
            <WebListedCard venue={lookup.venue} {...verificationCallbacks} />
          )}

          {lookup.state === "pending_by_me" && (
            <PendingByMeCard
              venue={lookup.venue}
              codeVerified={
                typeof (lookup.verification.payload as Record<string, unknown>)
                  .codeVerifiedAt === "string"
              }
              {...verificationCallbacks}
            />
          )}

          {lookup.state === "pending_by_other" && (
            <PendingByOtherCard
              venue={lookup.venue}
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

function WebListedCard({
  venue,
  ...callbacks
}: { venue: LookupVenue } & VerificationCallbacks) {
  return (
    <section className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-5">
      <StatusBadge tone="info">Web listed · no verified owner</StatusBadge>
      <VenueIdentity venue={venue} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        This venue is on Mesita but no one has proved ownership. Pick a
        verification path below — both happen right here on this page.
      </p>
      <VerificationForm
        venueId={venue.id}
        venuePhone={venue.phone}
        {...callbacks}
      />
    </section>
  );
}

function PendingByMeCard({
  venue,
  codeVerified,
  ...callbacks
}: {
  venue: LookupVenue;
  // True when the operator already passed the phone OTP step — the
  // row is only sitting here because phone auto-confirm is OFF on the
  // admin side. Different copy + no re-submit form.
  codeVerified: boolean;
} & VerificationCallbacks) {
  if (codeVerified) {
    return (
      <section className="border-secondary/40 bg-card flex flex-col gap-5 rounded-2xl border p-5">
        <StatusBadge tone="secondary">
          <CheckCircle2 className="h-3 w-3" />
          Code verified · admin reviewing
        </StatusBadge>
        <VenueIdentity venue={venue} />
        <p className="text-muted-foreground text-sm leading-relaxed">
          We received your OTP and confirmed it&apos;s correct. A Mesita
          admin is doing a final review and will grant ownership shortly
          — you&apos;ll see this venue in your dashboard once they
          approve. No action needed from you.
        </p>
      </section>
    );
  }
  return (
    <section className="border-secondary/30 bg-card flex flex-col gap-5 rounded-2xl border p-5">
      <StatusBadge tone="warn">
        <Clock className="h-3 w-3" />
        Your verification is awaiting review
      </StatusBadge>
      <VenueIdentity venue={venue} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Re-submit below if you didn&apos;t pick up — the new request
        replaces the pending one.
      </p>
      <VerificationForm
        venueId={venue.id}
        venuePhone={venue.phone}
        {...callbacks}
      />
    </section>
  );
}

function PendingByOtherCard({
  venue,
  ...callbacks
}: { venue: LookupVenue } & VerificationCallbacks) {
  return (
    <section className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-5">
      <StatusBadge tone="warn">
        <Clock className="h-3 w-3" />
        Someone else is verifying — you can also submit
      </StatusBadge>
      <VenueIdentity venue={venue} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Another operator has a pending claim. Whoever proves ownership
        first wins — if it&apos;s really your venue, just pick up the
        phone.
      </p>
      <VerificationForm
        venueId={venue.id}
        venuePhone={venue.phone}
        {...callbacks}
      />
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

// ── Verification form ─────────────────────────────────────────────────

// Single self-contained form. Both methods are visible up top via a
// compact Phone | Video tab strip; switching tabs swaps the body
// in-place. Whichever you pick, the whole flow — including the OTP
// entry for phone — runs on this same page. No nav, no modal, no
// separate OTP card.

// Phone state machine: idle → placing → awaiting_code (after the EF
// returns the verification ID) → verifying (after the operator
// submits the code). Errors push it back one step.
type TabKey = "ai_call" | "video";

type CallState =
  | { kind: "idle" }
  | { kind: "placing" }
  | {
      kind: "awaiting_code";
      verificationId: string;
      mockCode: string | null;
    }
  | {
      kind: "verifying";
      verificationId: string;
      mockCode: string | null;
    };

function VerificationForm({
  venueId,
  venuePhone,
  supabase,
  signedInEmail,
  onApproved,
  onAwaitingAdmin,
  onPendingForReview,
}: {
  venueId: string;
  venuePhone: string | null;
} & VerificationCallbacks) {
  const [tab, setTab] = useState<TabKey>("ai_call");

  // Phone state.
  const [callState, setCallState] = useState<CallState>({ kind: "idle" });
  const [otpCode, setOtpCode] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Video state.
  const [videoUrl, setVideoUrl] = useState("");
  const [videoPending, startVideo] = useTransition();
  const [videoError, setVideoError] = useState<string | null>(null);

  const switchTab = (next: TabKey) => {
    setTab(next);
    setPhoneError(null);
    setVideoError(null);
  };

  const placeCall = () => {
    if (callState.kind === "placing" || callState.kind === "verifying") return;
    setPhoneError(null);
    setOtpCode("");
    setCallState({ kind: "placing" });
    void (async () => {
      try {
        const r = await apiSubmitVerification(supabase, {
          venueId,
          method: "ai_call",
          requesterEmail: signedInEmail,
        });
        setCallState({
          kind: "awaiting_code",
          verificationId: r.id,
          mockCode: r.mockCode,
        });
      } catch (err) {
        setPhoneError(
          err instanceof Error ? err.message : "Could not place call.",
        );
        setCallState({ kind: "idle" });
      }
    })();
  };

  const verifyCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (callState.kind !== "awaiting_code") return;
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setPhoneError("Code must be 6 digits.");
      return;
    }
    const { verificationId, mockCode } = callState;
    setPhoneError(null);
    setCallState({ kind: "verifying", verificationId, mockCode });
    void (async () => {
      try {
        const { venueId: vId, awaitingAdmin } = await apiVerifyCallCode(
          supabase,
          verificationId,
          code,
        );
        if (awaitingAdmin) onAwaitingAdmin();
        else onApproved(vId);
      } catch (err) {
        setPhoneError(
          err instanceof Error ? err.message : "Could not verify.",
        );
        setCallState({ kind: "awaiting_code", verificationId, mockCode });
      }
    })();
  };

  const submitVideo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^https:\/\/[^\s]+$/.test(videoUrl.trim())) {
      setVideoError("Paste an https:// URL to a hosted video.");
      return;
    }
    setVideoError(null);
    startVideo(async () => {
      try {
        const r = await apiSubmitVerification(supabase, {
          venueId,
          method: "video",
          requesterEmail: signedInEmail,
          videoUrl: videoUrl.trim(),
        });
        if (r.status === "approved") onApproved(venueId);
        else onPendingForReview();
      } catch (err) {
        setVideoError(
          err instanceof Error ? err.message : "Could not submit.",
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <MethodTabs tab={tab} setTab={switchTab} />
      {tab === "ai_call" ? (
        <PhoneSection
          venuePhone={venuePhone}
          state={callState}
          otpCode={otpCode}
          setOtpCode={setOtpCode}
          error={phoneError}
          onPlaceCall={placeCall}
          onVerify={verifyCode}
        />
      ) : (
        <VideoSection
          videoUrl={videoUrl}
          setVideoUrl={setVideoUrl}
          pending={videoPending}
          error={videoError}
          onSubmit={submitVideo}
        />
      )}
    </div>
  );
}

function MethodTabs({
  tab,
  setTab,
}: {
  tab: TabKey;
  setTab: (next: TabKey) => void;
}) {
  return (
    <div className="bg-muted/60 grid grid-cols-2 gap-1 rounded-full p-1">
      <TabButton active={tab === "ai_call"} onClick={() => setTab("ai_call")}>
        <Phone className="h-4 w-4" />
        Phone call
      </TabButton>
      <TabButton active={tab === "video"} onClick={() => setTab("video")}>
        <Video className="h-4 w-4" />
        Video
      </TabButton>
    </div>
  );
}

function TabButton({
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
        "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-[13px] font-semibold transition",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function PhoneSection({
  venuePhone,
  state,
  otpCode,
  setOtpCode,
  error,
  onPlaceCall,
  onVerify,
}: {
  venuePhone: string | null;
  state: CallState;
  otpCode: string;
  setOtpCode: (v: string) => void;
  error: string | null;
  onPlaceCall: () => void;
  onVerify: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  if (state.kind === "idle" || state.kind === "placing") {
    const placing = state.kind === "placing";
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          We dial{" "}
          <span className="text-foreground font-mono font-semibold">
            {venuePhone ?? "the Google-listed phone"}
          </span>{" "}
          and read out a 6-digit code. Pick up at the venue and type
          the code below — all on this page.
        </p>
        <button
          type="button"
          onClick={onPlaceCall}
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

  // awaiting_code or verifying — same layout; the verify button
  // switches into a spinner while the EF round-trip is in flight.
  const verifying = state.kind === "verifying";
  return (
    <div className="flex flex-col gap-3">
      <div className="border-secondary/30 bg-secondary/5 text-secondary flex items-start gap-2 rounded-xl border p-3 text-[13px] leading-relaxed">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          We called{" "}
          <span className="text-foreground font-mono font-semibold">
            {venuePhone ?? "the venue"}
          </span>{" "}
          and read out a 6-digit code. Pick up at the venue and type
          it below.
        </p>
      </div>

      {state.mockCode && (
        <div className="border-amber-200 bg-amber-50 text-amber-900 flex items-start gap-2 rounded-xl border p-3 text-[12px] leading-relaxed">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Mock mode</span> — Twilio
            isn&apos;t wired yet, so no real call was placed. Type{" "}
            <span className="font-mono font-bold tracking-widest">
              {state.mockCode}
            </span>{" "}
            to complete the loop.
          </p>
        </div>
      )}

      <form onSubmit={onVerify} className="flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otpCode}
          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          autoFocus
          disabled={verifying}
          className="border-border bg-background h-14 w-full rounded-xl border px-4 text-center font-mono text-2xl tracking-[0.5em] outline-none disabled:opacity-60"
        />
        {error && <ErrorBlurb>{error}</ErrorBlurb>}
        <button
          type="submit"
          disabled={verifying || otpCode.length !== 6}
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50",
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
        onClick={onPlaceCall}
        disabled={verifying}
        className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center justify-center gap-1.5 self-center text-[12px] font-medium transition disabled:opacity-50"
      >
        <Phone className="h-3.5 w-3.5" />
        Didn&apos;t pick up? Re-dial with a fresh code
      </button>
    </div>
  );
}

function VideoSection({
  videoUrl,
  setVideoUrl,
  pending,
  error,
  onSubmit,
}: {
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field
        label="Walkthrough video URL"
        hint="≤3 minutes showing the venue's interior. Loom, Drive, YouTube unlisted — anything public-via-link is fine."
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
          autoFocus
          className={INPUT_CLASS}
        />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50",
          "bg-foreground text-background",
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
            Submit walkthrough for review
          </>
        )}
      </button>
      <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
        Reviewed by a Mesita admin — usually within 24 hours.
      </p>
      {error && <ErrorBlurb>{error}</ErrorBlurb>}
    </form>
  );
}

function ErrorBlurb({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
      {children}
    </p>
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

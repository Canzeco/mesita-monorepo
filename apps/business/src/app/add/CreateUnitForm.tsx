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
  apiEnrichCreatePlace,
  apiPlacesAutocomplete,
  type PlacePrediction,
  type PredictionStatus,
} from "@/lib/api/places";
import {
  apiLookupPlace,
  apiBusinessSendsEmailOtp,
  apiBusinessSendsPhoneOtp,
  apiBusinessVerifiesEmail,
  apiBusinessVerifiesPhone,
  type LookupMethods,
  type LookupResult,
  type LookupPlace,
} from "@/lib/api/verifications";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { placePath } from "@/lib/business-route-contract";
import { isOtpCode } from "@/lib/validators";

const SEARCH_DEBOUNCE_MS = 220;

// Rolling status messages cycled into the Generate button while
// business-create-project is running.
const GENERATE_STAGE_MS = 6000;
const GENERATE_STAGES = [
  "Fetching Google profile…",
  "Scanning the place's website…",
  "Cross-checking social signals…",
  "Synthesising the catalog entry…",
];

// Mesita ops contact channels. Direct fallback for ownership claims
// that can't be auto-verified by phone or email. WhatsApp is the
// LATAM-friendly primary; email is the universal fallback for regions
// where WhatsApp isn't dominant (US, most of Europe) and also the
// natural channel when the operator needs to attach proof documents
// (business license, utility bill, staff photo with signage).
// Hardcoded so the "Talk to us" buttons always work regardless of
// Supabase env config.
const MESITA_OPS_WHATSAPP_E164 = "+524445499597";
const MESITA_OPS_EMAIL = "hello@mesita.ai";

// Callbacks the parent provides for each terminal outcome of a
// verification flow. The picker + bodies are self-contained but don't
// know the page's routing strategy.
type VerificationCallbacks = {
  supabase: SupabaseClient;
  signedInEmail: string;
  onApproved: (projectId: string) => void;
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

  // Generate-profile state (business-create-project).
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
        const r = await apiLookupPlace(supabase, prediction.placeId);
        setLookup(r);
      } catch (err) {
        setLookupError(errMsg(err, "Could not look up that place."));
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
      const r = await apiLookupPlace(supabase, selected.placeId);
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
        await apiEnrichCreatePlace(supabase, selected.placeId);
        setGenerateStage("Done");
        await refreshLookup();
      } catch (err) {
        setGenerateError(errMsg(err, "Could not create place."));
        setGenerateStage(null);
      } finally {
        window.clearInterval(stageInterval);
      }
    });
  };

  const verificationCallbacks: VerificationCallbacks = {
    supabase,
    signedInEmail,
    onApproved: (projectId) => {
      router.push(placePath(projectId));
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
              placeholder="Search by place name — e.g. Casa Luminar, Strana…"
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
              const meta = PREDICTION_BADGE[p.status];
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
            paste the place&apos;s exact Google profile name.
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
              place={lookup.place}
              methods={lookup.methods}
              {...verificationCallbacks}
            />
          )}

          {lookup.state === "pending_by_me" && (
            <PendingByMeCard
              place={lookup.place}
              methods={lookup.methods}
              codeVerified={
                typeof lookup.verification.payload.codeVerifiedAt === "string"
              }
              {...verificationCallbacks}
            />
          )}

          {lookup.state === "pending_by_other" && (
            <PendingByOtherCard
              place={lookup.place}
              methods={lookup.methods}
              {...verificationCallbacks}
            />
          )}

          {lookup.state === "verified_partner" && (
            <VerifiedPartnerCard
              place={lookup.place}
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
        We&apos;ll generate the Mesita profile from Google + the place&apos;s
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
  place,
  methods,
  ...callbacks
}: {
  place: LookupPlace;
  methods: LookupMethods;
} & VerificationCallbacks) {
  return (
    <section className="border-border bg-card flex flex-col gap-5 rounded-[22px] border p-6">
      <StatusBadge tone="info">Web listed · no verified owner</StatusBadge>
      <PlaceIdentity place={place} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Prove you own this place. Phone and email codes land instantly; Talk to
        us is the manual path when neither works for this listing.
      </p>
      <MethodsPicker place={place} methods={methods} {...callbacks} />
    </section>
  );
}

function PendingByMeCard({
  place,
  methods,
  codeVerified,
  ...callbacks
}: {
  place: LookupPlace;
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
        <PlaceIdentity place={place} />
        <p className="text-muted-foreground text-sm leading-relaxed">
          We received your code and confirmed it&apos;s correct. A Mesita admin
          is doing a final review and will grant ownership shortly — you&apos;ll
          see this place in your dashboard once they approve. No action needed
          from you.
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
      <PlaceIdentity place={place} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Re-submit below if you didn&apos;t finish the loop — the new request
        replaces the pending one.
      </p>
      <MethodsPicker place={place} methods={methods} {...callbacks} />
    </section>
  );
}

function PendingByOtherCard({
  place,
  methods,
  ...callbacks
}: {
  place: LookupPlace;
  methods: LookupMethods;
} & VerificationCallbacks) {
  return (
    <section className="border-border bg-card flex flex-col gap-5 rounded-[22px] border p-6">
      <StatusBadge tone="warn">
        <Clock className="h-3 w-3" />
        Someone else is verifying — you can also submit
      </StatusBadge>
      <PlaceIdentity place={place} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Another operator has a pending claim. Whoever proves ownership first
        wins — if it&apos;s really your place, run any of the methods below.
      </p>
      <MethodsPicker place={place} methods={methods} {...callbacks} />
    </section>
  );
}

function VerifiedPartnerCard({
  place,
  ownerEmail,
}: {
  place: LookupPlace;
  ownerEmail: string | null;
}) {
  return (
    <section className="border-secondary/40 bg-card flex flex-col gap-4 rounded-[22px] border p-6">
      <StatusBadge tone="secondary">
        <CheckCircle2 className="h-3 w-3" />
        Verified partner
      </StatusBadge>
      <PlaceIdentity place={place} />
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
              `About ${place.name} on Mesita`,
            )}`}
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          >
            <Mail className="h-4 w-4" />
            Contact owner
          </a>
        )}
        <a
          href={`mailto:fraud@canzeco.com?subject=${encodeURIComponent(
            `Fraud report — ${place.name} (${place.id})`,
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

// Three verification paths share the same parent card body. All three
// chips are always rendered — phone, email, and the manual "Talk to us"
// fallback — so operators see the full set of supported methods even
// when this specific place doesn't expose a Google-listed phone or a
// Firecrawl-discovered on-domain email. When the auto-method isn't
// available for the place, selecting its chip shows a short
// explanatory body that points to the manual fallback. The picker
// auto-lands on the first actionable method (phone → email → manual)
// so a bare listing opens straight on the WhatsApp/email panel.

type MethodKey = "phone" | "email" | "manual";

function MethodsPicker({
  place,
  methods,
  ...callbacks
}: {
  place: LookupPlace;
  methods: LookupMethods;
} & VerificationCallbacks) {
  const initialMethod: MethodKey = methods.phone.available
    ? "phone"
    : methods.email.available
      ? "email"
      : "manual";

  const [method, setMethod] = useState<MethodKey>(initialMethod);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/70 grid auto-cols-fr grid-flow-col gap-1 rounded-2xl p-1">
        <MethodChip
          active={method === "phone"}
          unavailable={!methods.phone.available}
          onClick={() => setMethod("phone")}
        >
          <Phone className="h-4 w-4" />
          Phone
        </MethodChip>
        <MethodChip
          active={method === "email"}
          unavailable={!methods.email.available}
          onClick={() => setMethod("email")}
        >
          <Mail className="h-4 w-4" />
          Email
        </MethodChip>
        <MethodChip
          active={method === "manual"}
          onClick={() => setMethod("manual")}
        >
          <MessagesSquare className="h-4 w-4" />
          Talk to us
        </MethodChip>
      </div>

      {method === "phone" &&
        (methods.phone.available ? (
          <PhoneBody place={place} methods={methods} {...callbacks} />
        ) : (
          <MethodUnavailableBody method="phone" methods={methods} />
        ))}
      {method === "email" &&
        (methods.email.available ? (
          <EmailBody place={place} methods={methods} {...callbacks} />
        ) : (
          <MethodUnavailableBody method="email" methods={methods} />
        ))}
      {method === "manual" && <WhatsAppBody place={place} />}
    </div>
  );
}

// Shown when the operator selects an auto-verify chip (phone or email)
// that isn't available for this specific place — e.g. the GMB profile
// has no public phone, or no Firecrawl-discovered on-domain email.
// Keeps the chip visible so operators see the full supported set, and
// nudges them to the best next action: the other auto-method when it's
// available (still instant), otherwise the manual Talk-to-us path.
function MethodUnavailableBody({
  method,
  methods,
}: {
  method: "phone" | "email";
  methods: LookupMethods;
}) {
  const Icon = method === "phone" ? Phone : Mail;
  const title =
    method === "phone" ? "Phone check unavailable" : "Email check unavailable";
  const what =
    method === "phone"
      ? "a public phone number on Google"
      : "a verified email on the place's website";

  // Pick the best alternative the operator can take right now. We
  // prefer the other instant auto-method (Phone/Email) when its data
  // is available for this place, and only fall back to the manual
  // path when both auto-methods are out of reach.
  const alternative =
    method === "phone" && methods.email.available
      ? { label: "Email", detail: "the code lands instantly when it clears." }
      : method === "email" && methods.phone.available
        ? { label: "Phone", detail: "the code lands instantly when it clears." }
        : {
            label: "Talk to us",
            detail: "we'll verify ownership manually within minutes.",
          };

  return (
    <div className="border-border bg-muted/30 flex items-start gap-3 rounded-2xl border p-4">
      <span className="bg-muted text-muted-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[13px] font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1 text-[12.5px] leading-relaxed">
          We couldn&apos;t find {what} for this place. Use{" "}
          <span className="text-foreground font-medium">
            {alternative.label}
          </span>{" "}
          — {alternative.detail}
        </p>
      </div>
    </div>
  );
}

function MethodChip({
  active,
  unavailable,
  onClick,
  children,
}: {
  active: boolean;
  // Renders the chip as a dimmed glyph when the auto-method isn't
  // available for the place. The chip still clicks through so the
  // MethodUnavailableBody can explain — we just want the picker row to
  // signal "this one's not applicable here" at a glance.
  unavailable?: boolean;
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
        unavailable && !active && "opacity-55",
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
  | {
      kind: "awaiting_code";
      verificationId: string;
      mockCode: string | null;
      phoneDialed: string;
      mockMode: boolean;
    }
  | {
      kind: "verifying";
      verificationId: string;
      mockCode: string | null;
      phoneDialed: string;
      mockMode: boolean;
    };

function PhoneBody({
  place,
  methods,
  supabase,
  signedInEmail,
  onApproved,
  onAwaitingAdmin,
}: {
  place: LookupPlace;
  methods: LookupMethods;
} & VerificationCallbacks) {
  const [state, setState] = useState<CallState>({ kind: "idle" });
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const phoneDisplay = methods.phone.displayPhone ?? place.phone ?? "";

  const placeCall = () => {
    if (state.kind === "placing" || state.kind === "verifying") return;
    setError(null);
    setOtpCode("");
    setState({ kind: "placing" });
    void (async () => {
      try {
        const r = await apiBusinessSendsPhoneOtp(
          supabase,
          place.id,
          signedInEmail,
        );
        setState({
          kind: "awaiting_code",
          verificationId: r.verificationId,
          mockCode: r.mockCode,
          phoneDialed: r.phoneDialed,
          mockMode: r.mockMode ?? !!r.mockCode,
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
    if (!isOtpCode(code)) {
      setError("Code must be 6 digits.");
      return;
    }
    const { verificationId, mockCode, phoneDialed, mockMode } = state;
    setError(null);
    setState({
      kind: "verifying",
      verificationId,
      mockCode,
      phoneDialed,
      mockMode,
    });
    void (async () => {
      try {
        const { projectId: vId, awaitingAdmin } = await apiBusinessVerifiesPhone(
          supabase,
          verificationId,
          code,
        );
        if (awaitingAdmin) onAwaitingAdmin();
        else onApproved(vId);
      } catch (err) {
        setError(errMsg(err, "Could not verify."));
        setState({
          kind: "awaiting_code",
          verificationId,
          mockCode,
          phoneDialed,
          mockMode,
        });
      }
    })();
  };

  if (state.kind === "idle" || state.kind === "placing") {
    const placing = state.kind === "placing";
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          We&apos;ll dial the number on file and read out a 6-digit code. In
          test mode you&apos;ll see a Mesita mock line and the code on screen —
          we don&apos;t call{" "}
          <span className="text-foreground font-mono font-semibold">
            {phoneDisplay}
          </span>{" "}
          yet.
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
              Call my place
            </>
          )}
        </button>
        {error && <ErrorBlurb>{error}</ErrorBlurb>}
      </div>
    );
  }

  const verifying = state.kind === "verifying";
  const dialed =
    state.kind === "awaiting_code" || state.kind === "verifying"
      ? state.phoneDialed
      : phoneDisplay;
  const mockMode =
    state.kind === "awaiting_code" || state.kind === "verifying"
      ? state.mockMode
      : false;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-2 text-[12.5px] leading-snug">
        <span className="bg-secondary/10 text-secondary flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Phone className="h-3.5 w-3.5" />
        </span>
        <p>
          {mockMode ? (
            <>
              Mock line{" "}
              <span className="text-foreground font-mono font-semibold">
                {dialed}
              </span>{" "}
              — we didn&apos;t call the place. Type the 6-digit code below.
            </>
          ) : (
            <>
              Called{" "}
              <span className="text-foreground font-mono font-semibold">
                {dialed}
              </span>
              . Pick up and type the 6-digit code we read out.
            </>
          )}
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
  | {
      kind: "awaiting_code";
      verificationId: string;
      mockCode: string | null;
      sentTo: string;
      mockMode: boolean;
    }
  | {
      kind: "verifying";
      verificationId: string;
      mockCode: string | null;
      sentTo: string;
      mockMode: boolean;
    };

function EmailBody({
  place,
  methods,
  supabase,
  signedInEmail,
  onApproved,
  onAwaitingAdmin,
}: {
  place: LookupPlace;
  methods: LookupMethods;
} & VerificationCallbacks) {
  const [state, setState] = useState<EmailState>({ kind: "idle" });
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const emailDisplay = methods.email.displayEmail ?? place.email ?? "";

  const sendEmail = () => {
    if (state.kind === "sending" || state.kind === "verifying") return;
    setError(null);
    setOtpCode("");
    setState({ kind: "sending" });
    void (async () => {
      try {
        const r = await apiBusinessSendsEmailOtp(
          supabase,
          place.id,
          signedInEmail,
        );
        setState({
          kind: "awaiting_code",
          verificationId: r.verificationId,
          mockCode: r.mockCode,
          sentTo: r.sentTo,
          mockMode: r.mockMode ?? !!r.mockCode,
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
    if (!isOtpCode(code)) {
      setError("Code must be 6 digits.");
      return;
    }
    const { verificationId, mockCode, sentTo, mockMode } = state;
    setError(null);
    setState({ kind: "verifying", verificationId, mockCode, sentTo, mockMode });
    void (async () => {
      try {
        const { projectId: vId, awaitingAdmin } = await apiBusinessVerifiesEmail(
          supabase,
          verificationId,
          code,
        );
        if (awaitingAdmin) onAwaitingAdmin();
        else onApproved(vId);
      } catch (err) {
        setError(errMsg(err, "Could not verify."));
        setState({
          kind: "awaiting_code",
          verificationId,
          mockCode,
          sentTo,
          mockMode,
        });
      }
    })();
  };

  if (state.kind === "idle" || state.kind === "sending") {
    const sending = state.kind === "sending";
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          We&apos;ll email a 6-digit code to the on-domain address on file. In
          test mode you&apos;ll see a mock inbox and the code on screen — we
          don&apos;t email{" "}
          <span className="text-foreground font-mono font-semibold break-all">
            {emailDisplay}
          </span>{" "}
          yet.
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
  const sentTo =
    state.kind === "awaiting_code" || state.kind === "verifying"
      ? state.sentTo
      : emailDisplay;
  const mockMode =
    state.kind === "awaiting_code" || state.kind === "verifying"
      ? state.mockMode
      : false;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-2 text-[12.5px] leading-snug">
        <span className="bg-secondary/10 text-secondary flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Mail className="h-3.5 w-3.5" />
        </span>
        <p>
          {mockMode ? (
            <>
              Mock inbox{" "}
              <span className="text-foreground font-mono font-semibold break-all">
                {sentTo}
              </span>{" "}
              — we didn&apos;t email the place. Type the 6-digit code below.
            </>
          ) : (
            <>
              Code sent to{" "}
              <span className="text-foreground font-mono font-semibold break-all">
                {sentTo}
              </span>
              . Check the inbox and type it below.
            </>
          )}
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

// ── Talk-to-us fallback body ──────────────────────────────────────────

// Always-available manual path. Opens a wa.me deep-link OR a mailto:
// with a prefilled claim message to Mesita ops. No DB row, no admin
// queue — ops handles the conversation directly. Phone/email
// auto-verify remain the happy paths; this is the fallback when
// neither is available or when the operator wants a human.
//
// WhatsApp is the primary CTA (LATAM-friendly, where most operators
// live), and email is the universal secondary — better for regions
// where WhatsApp isn't dominant (US, most of Europe) and also the
// natural channel when ops asks the operator to attach proof of
// ownership (business license, utility bill, staff photo with signage).
function WhatsAppBody({ place }: { place: LookupPlace }) {
  const waNumber = MESITA_OPS_WHATSAPP_E164.replace(/[^\d]/g, "");
  const waMessage = `Hi Mesita — I'd like to claim "${place.name}" on Mesita. Place ID: ${place.id}.`;
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

  const emailSubject = `Claim "${place.name}" on Mesita`;
  const emailBody = `Hi Mesita team,\n\nI'd like to claim "${place.name}" on Mesita.\n\nPlace ID: ${place.id}\n\nHappy to share proof of ownership (business license, utility bill, or a staff photo with signage) if helpful.\n\nThanks,`;
  const mailHref = `mailto:${MESITA_OPS_EMAIL}?subject=${encodeURIComponent(
    emailSubject,
  )}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        Reach our team and we&apos;ll verify ownership manually — we usually
        reply within minutes, and never more than one business day.
      </p>
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="bg-whatsapp flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold text-white transition hover:opacity-90"
      >
        <MessageCircle className="h-5 w-5" />
        Talk to us on WhatsApp
      </a>
      <a
        href={mailHref}
        className="border-border bg-card text-foreground hover:bg-muted/50 flex h-14 items-center justify-center gap-2 rounded-full border text-base font-semibold transition"
      >
        <Mail className="h-5 w-5" />
        Email {MESITA_OPS_EMAIL}
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

function PlaceIdentity({ place }: { place: LookupPlace }) {
  return (
    <div className="border-border bg-background flex flex-col gap-3 rounded-xl border p-4">
      <p className="font-display text-lg leading-tight font-semibold tracking-tight">
        {place.name}
      </p>
      <div className="text-muted-foreground flex flex-col gap-1.5 text-[12px] sm:flex-row sm:items-center sm:gap-4">
        <span className="inline-flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-mono">
            {place.phone ?? (
              <span className="text-muted-foreground italic">
                no phone listed
              </span>
            )}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={place.address ?? undefined}>
            {place.address ?? "no address"}
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

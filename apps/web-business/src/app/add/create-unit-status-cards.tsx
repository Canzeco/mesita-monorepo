import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Sparkles,
} from "lucide-react";
import type { PlacePrediction } from "@/lib/api/places";
import type { LookupMethods, LookupPlace } from "@/lib/api/verifications";
import { CTA_BUTTON_CLASS, ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { MethodsPicker } from "./create-unit-methods";
import {
  PlaceIdentity,
  StatusBadge,
  type VerificationCallbacks,
} from "./create-unit-shared";

// ── State-specific cards ──────────────────────────────────────────────

export function NotInMesitaCard({
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

export function WebListedCard({
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

export function PendingByMeCard({
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

export function PendingByOtherCard({
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

export function VerifiedPartnerCard({
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
        Mesita partner
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
            className={cn(CTA_BUTTON_CLASS, "px-4 py-2")}
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

export function ErrorCard({
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

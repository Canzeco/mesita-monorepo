// Small server-safe display atoms for the (shell) console: state badges,
// payment-state pill, data row. Rows not cards — these are calm utility
// chrome, not decoration.
//
// Two ladders, deliberately kept apart: an ORGANIZATION is Not connected
// or Connected (does money land), a PLACE is Listed or Verified (can a
// guest reach it, did someone prove they run it). Neither describes the
// other, so neither badge is reusable for the other.
import { cn } from "@/lib/utils";
import type {
  OrganizationState,
  PaymentAccountState,
  PlaceState,
} from "@/lib/model/types";

const PLACE_STATE_LABEL: Record<PlaceState, string> = {
  listed: "Listed",
  verified: "Verified",
};

const PLACE_STATE_DOT: Record<PlaceState, string> = {
  listed: "bg-muted-foreground/50",
  verified: "bg-emerald-500",
};

export function PlaceStateBadge({
  state,
  className,
}: {
  state: PlaceState;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", PLACE_STATE_DOT[state])}
      />
      {PLACE_STATE_LABEL[state]}
    </span>
  );
}

const ORG_STATE_LABEL: Record<OrganizationState, string> = {
  not_connected: "Not connected",
  connected: "Connected",
};

const ORG_STATE_DOT: Record<OrganizationState, string> = {
  not_connected: "bg-muted-foreground/50",
  connected: "bg-emerald-500",
};

export function OrgStateBadge({ state }: { state: OrganizationState }) {
  return (
    <span className="border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
      <span className={cn("h-1.5 w-1.5 rounded-full", ORG_STATE_DOT[state])} />
      {ORG_STATE_LABEL[state]}
    </span>
  );
}

/**
 * "READY", NOT "LIVE" (MESITA-1643).
 *
 * `paymentAccountState` returns `live` the moment Stripe reports
 * charges_enabled and payouts_enabled. That says the ACCOUNT can take a
 * charge. It does not say Mesita sends any — the charge path does not exist
 * yet; the consumer ticket-payment endpoint still refuses the Mesita method
 * with a 410. (Named in prose only: the EF-name-is-the-ACL guard scans this
 * app's source for consumer EF names and cannot tell code from a comment.)
 *
 * A green "Live" pill after eight minutes of KYC is therefore a lie that fails
 * SILENTLY, days later, while an owner waits for money that structurally
 * cannot arrive. That is worse than the loud error that started this issue.
 *
 * One flag flips the whole vocabulary back when the charge path ships. Do not
 * hand-edit the strings below — flip CARD_PAYMENTS_LIVE and the label, the
 * tone and the caption move together.
 */
export const CARD_PAYMENTS_LIVE = false;

const STATE_LABEL: Record<PaymentAccountState, string> = {
  none: "No account",
  // "Not finished" says whose move it is. "Pending" did not, and it was also
  // the word for the opposite situation (MESITA-1645).
  unfinished: "Not finished",
  in_review: "Stripe is checking",
  charges_only: "Charges only",
  live: CARD_PAYMENTS_LIVE ? "Live" : "Ready",
  restricted: "Restricted",
};

/** Said under the pill when the account is done but Mesita is not sending
 *  payments through it yet. Null once the charge path is live. */
export const READY_CAPTION = CARD_PAYMENTS_LIVE
  ? null
  : "Your account is ready. Mesita starts sending payments through it when card payments go live \u2014 we\u2019ll email you.";

const STATE_CLASS: Record<PaymentAccountState, string> = {
  none: "bg-muted text-muted-foreground",
  // Amber is "you have something to do". Waiting on Stripe is not a debt the
  // owner can settle, so it is neutral — the same reason the intake matrix
  // refuses rose for a function that simply has not run.
  unfinished: "bg-amber-500/15 text-amber-700",
  in_review: "bg-muted text-muted-foreground",
  charges_only: "bg-amber-500/15 text-amber-700",
  // Blue, not emerald, while CARD_PAYMENTS_LIVE is false: green reads as
  // "money is flowing", and it is not.
  live: CARD_PAYMENTS_LIVE
    ? "bg-emerald-500/15 text-emerald-700"
    : "bg-sky-500/15 text-sky-700",
  restricted: "bg-destructive/10 text-destructive",
};

/**
 * Stripe's `disabled_reason` is an ENUM, and the card printed it raw
 * (MESITA-1645). "rejected.fraud" is an accusation in a data row with no
 * explanation; "requirements.past_due" is not a sentence. Same rule as the
 * Edge Function's failure copy: say what it means for the restaurant, and
 * never make them read our vendor's vocabulary.
 *
 * The `rejected.*` family deliberately does NOT state the reason. Those are
 * decisions with consequences a support conversation should carry, not a
 * badge.
 */
const DISABLED_REASON_COPY: Record<string, string> = {
  "requirements.past_due": "Stripe needs a few more details before this account can take payments.",
  "requirements.pending_verification": "Stripe is verifying what you sent. Nothing to do right now.",
  "listed": "Stripe is reviewing this account. Nothing to do right now.",
  "under_review": "Stripe is reviewing this account. Nothing to do right now.",
  "platform_paused": "Payments are paused on this account. Write to us and we'll sort it out.",
  "rejected.fraud": "Stripe closed this account. Write to us and we'll help you from here.",
  "rejected.terms_of_service": "Stripe closed this account. Write to us and we'll help you from here.",
  "rejected.listed": "Stripe closed this account. Write to us and we'll help you from here.",
  "rejected.other": "Stripe closed this account. Write to us and we'll help you from here.",
};

export function disabledReasonCopy(reason: string | null | undefined): string {
  if (!reason) return "Stripe has paused this account.";
  const known = DISABLED_REASON_COPY[reason];
  if (known) return known;
  // An unmapped reason is still OURS to explain, not Stripe's to announce.
  // Default-safe, same posture as the EF's allowlist.
  return "Stripe has paused this account. Write to us and we'll sort it out.";
}

export function StatePill({ state }: { state: PaymentAccountState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        STATE_CLASS[state],
      )}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

export function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-4 border-b py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

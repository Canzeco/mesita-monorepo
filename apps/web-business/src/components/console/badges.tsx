// Small server-safe display atoms for the (shell) console: state badges,
// payment-state pill, data row. Rows not cards — these are calm utility
// chrome, not decoration.
//
// Two ladders, deliberately kept apart: a PAYMENT ACCOUNT is somewhere on
// Stripe's lifecycle (does money land, can it leave), a PLACE is Listed or
// Verified (can a guest reach it, did someone prove they run it). Neither
// describes the other, so neither badge is reusable for the other. They were
// two ENTITIES' ladders until MESITA-1892 — the organization's and the
// place's — and the account is the place's own now; the distinction that
// mattered survives it, because Stripe's state and Atlas's state are still
// different questions.
//
// A third chip, Partner, is deliberately SHARED (MESITA-1867): the catalogue
// banner and the place heading print one word from one component in one
// colour. Two pages drawing the same fact in two violets was the drift this
// file exists to prevent.
import { cn } from "@/lib/utils";
import type {
  PaymentAccountState,
  PlaceState,
} from "@/lib/model/types";

/** The bordered-chip grammar every state chip on a heading wears: 11px, a
 *  dot, the card's own background. One string so a new chip cannot drift. */
const CHIP_CLASS =
  "border-border bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold";

const PLACE_STATE_LABEL: Record<PlaceState, string> = {
  listed: "Listed",
  verified: "Verified",
};

const PLACE_STATE_DOT: Record<PlaceState, string> = {
  listed: "bg-muted-foreground/50",
  verified: "bg-foreground",
};

export function PlaceStateBadge({
  state,
  className,
}: {
  state: PlaceState;
  className?: string;
}) {
  return (
    <span className={cn(CHIP_CLASS, className)}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", PLACE_STATE_DOT[state])}
      />
      {PLACE_STATE_LABEL[state]}
    </span>
  );
}

/**
 * PARTNER, ONE WORD, ONE COLOUR (MESITA-1867).
 *
 * Rendered only while the fact is true — the caller decides. There is no
 * "Not a partner" twin: on the Partner box the CTA IS the not-yet state, and
 * a muted pill beside a price and a button would be three atoms for one
 * fact.
 *
 * IT WAS VIOLET — "neither Listed's grey nor Verified's green nor a payment
 * state's amber, a different ladder, a different hue". MESITA-1936 took the
 * hues away, and the dot briefly became `bg-foreground`, which every CTA
 * button on the screen already wears: the pill's signature stopped being a
 * signature, and products-lane.test.tsx caught it.
 *
 * GOLD, because Partner IS a tier the product names out loud, which is one of
 * the three places chroma still survives here. Same token the mock's Partner
 * badge uses, so the two consoles say it the same way.
 */
export function PartnerPill({ className }: { className?: string }) {
  return (
    <span className={cn(CHIP_CLASS, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--tier-gold)]" />
      Partner
    </span>
  );
}

// ORG_STATE_BADGE IS GONE (MESITA-1847). It read `charges_enabled` alone and
// said "Connected", while `StatePill` on the same screen says "Ready" only at
// charges AND payouts AND details submitted — one account, two ladders, two
// vocabularies, free to disagree in front of the owner. The precise one stays.
// An exported badge nobody renders is an invitation to say it twice again.

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

/**
 * The Mesita Pay switch's own sentence, DERIVED from the same flag as the
 * caption 40px above it (MESITA-1867). A static "Guests can pay by card"
 * under a Ready pill whose caption says Mesita is not sending payments yet
 * is two lines in one box disagreeing about whether money moves. Flip
 * CARD_PAYMENTS_LIVE and both move together.
 */
export function mesitaPaySwitchLine(on: boolean): string {
  if (CARD_PAYMENTS_LIVE) {
    return on
      ? "Guests can pay by card at every place that turns it on."
      : "Turn on so places can take card payments inside Mesita.";
  }
  return on
    ? "Places can turn on card payments; Mesita starts sending them when card payments go live."
    : "Turn on so places can offer card payments once they go live.";
}

/**
 * Why the Mesita Pay switch is locked, per account state \u2014 never "connect
 * Stripe first" to someone who did (MESITA-1867). The switch's lock is
 * Stripe Ready; the line names the rung the account is actually on, and
 * "see above" points at the PaymentsCard in the same box that says the rest.
 *
 * `live` is unreachable through the page's `stripeReady` predicate (a Ready
 * account unlocks the switch), and `charges_only` clears it too \u2014 charges
 * and details are what the predicate reads, payouts are not. Both rows exist
 * so the Record is total and a new state cannot fall through to "connect
 * first".
 */
const PAY_LOCKED_LINE: Record<PaymentAccountState, string> = {
  none: "Needs a Ready Stripe account \u2014 connect Stripe first.",
  unfinished: "Finish Stripe onboarding first.",
  in_review: "Stripe is checking the account.",
  restricted: "Stripe restricted the account \u2014 see above.",
  charges_only: "Stripe still needs payouts enabled \u2014 see above.",
  live: "Ready.",
};

export function mesitaPayLockedLine(
  state: PaymentAccountState,
  orphaned: boolean,
): string {
  // An orphaned mirror reads `restricted` from paymentAccountState, but for
  // the owner it is an account that is not there: the door is Connect again.
  return orphaned ? PAY_LOCKED_LINE.none : PAY_LOCKED_LINE[state];
}

// THE LADDER IS A SHAPE NOW, NOT A HUE (MESITA-1936).
//
// These six states used to be six tints, and the tints were carrying real
// product distinctions that this file argues for at length: amber meant "you
// owe an action", and blue-not-green meant "the account is ready but Mesita is
// not sending money yet". Greyscale six hues and all six become one chip —
// which is precisely what the tests in payments-states.test.tsx caught.
//
// So the mechanism moves to FILL / OUTLINE / DASHED, the vocabulary the mock
// console shipped in MESITA-1934, and every distinction survives without a hue:
//
//   filled ink     the owner's move, and the only one that shouts
//   solid fill     a settled, finished state
//   outline        a real state nobody has to act on
//   dashed         waiting on somebody else — "not here yet", the same thing
//                  SoonStrip and EmptyState already mean by a dashed border
//   destructive    reserved, and the one place chroma survives here
const PILL_RING = "border";
const STATE_CLASS: Record<PaymentAccountState, string> = {
  none: `${PILL_RING} border-border text-muted-foreground`,
  // FILLED, because this is the only state on the ladder where the owner has
  // something to do. It replaces amber and keeps amber's whole job: be the one
  // that pulls the eye. Waiting on Stripe must never look like this.
  unfinished: "bg-foreground text-paper",
  // DASHED, because it is not the owner's move. A debt they cannot settle
  // should not wear the shape that asks them to settle it.
  in_review: `${PILL_RING} border-dashed border-border text-muted-foreground`,
  charges_only: `${PILL_RING} border-border text-foreground`,
  // A SOLID FILL, never the ink one: "Ready" is finished, but while
  // CARD_PAYMENTS_LIVE is false Mesita is not sending payments through it, so
  // it must not wear the shape that means "act". Green read as "money is
  // flowing" and this is the same refusal, spelled without a colour.
  live: CARD_PAYMENTS_LIVE
    ? "bg-foreground text-paper"
    : "bg-muted text-foreground",
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

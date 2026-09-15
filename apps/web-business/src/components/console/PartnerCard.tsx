"use client";

// The catalogue's Mesita Partner box (MESITA-1867).
//
// ── HOW IT GOT HERE ───────────────────────────────────────────────────────
//
// MESITA-1798 made this a `role="switch"` in the Capabilities-ladder grammar
// — Partner, on or off, owner-only, Stripe Ready as the lock. MESITA-1863
// stripped the capability list from under the switch: joining put every held
// place on plan=pro at ZERO rates, so the three things it listed were
// partner-GATED and none partner-DELIVERED, and the operator met three off
// switches on Capabilities right after reading that the partnership had
// unlocked them. MESITA-1864 made the locked state a dimmed track and one
// line instead of a pill, so the state every new organization met still
// showed Partnership as a thing you turn on. MESITA-1861 deleted the 9.5rem
// right well; MESITA-1866 folded the switch under the Stripe box with a seam.
//
// ── TWO TIERS NOW, AND THIS IS THE FIRST ──────────────────────────────────
//
// Pato, 2026-09-15: the Stripe onboarding is friction that shrinks the
// market, so Partner stops being Stripe-locked. **Mesita Partner** is a
// yearly subscription, and since MESITA-1892 it is bought PER PLACE — the
// organization that used to hold it for every place at once is gone, and
// `places.partnered` is the column. It is what a place needs for Visit
// Rewards, Accept Prepays and guest checks. **Mesita Pay** (the Stripe
// account and card payments inside Mesita) is an optional add-on on top, and
// it is where the switch this file used to be went: `MesitaPayCard.tsx`.
//
// So this box is a price, a door, and a price list. Not partnered: the price
// at display rank and, for an owner, one CTA — no pill, because the CTA IS
// the state and a "Not a partner" chip beside it would be three atoms for one
// fact. Partnered: the shared `PartnerPill` and when it renews. The list
// under the hairline renders in EVERY state, because a paid tier with no
// stated benefits is a price with no price list — but it keeps the
// MESITA-1863 truth: the lead says each place turns these on itself, the
// marker is a dash and never a check (a check means "done" on this route,
// see LifecycleBanner), and the badge is qualified with "once a strategy is
// on", which is true at the state every subscriber lands in.
//
// ── THE MODAL HAS A BUTTON NOW (MESITA-1877) ──────────────────────────────
//
// It shipped without one on purpose: checkout did not exist, and a disabled
// "Continue" is a knob that pretends (house law, SoonStrip.tsx). The
// subscription is real now, so the INFO line that stood in for it is gone and
// the button is the commitment — the last thing in the modal, after the price
// and what it buys, because that is the order someone decides in.
//
// THE WORD ON THE BUTTON IS "MEMBERSHIP", AND IT IS THE ONLY ONE. Pato,
// 2026-09-15: *"call it membership or something."* The thing you BUY is the
// Membership; the thing you BECOME is a Partner — one purchase noun, one
// status noun, never two names for one fact. So the pill, the banner and the
// badge all still say Partner, and the word Membership appears exactly where
// money does.
//
// The price is the CATALOG's now, off `membership_plans` through the console
// viewer's envelope, so the number an owner reads is the number Stripe bills.
// `PARTNER_PRICE_LABEL` survives as the fallback for a payload that carries
// none — a price box with no price is worse than a stale one.
//
// State: whether the modal is open, and the action's own. Nothing here
// mutates a row directly, so nothing needs re-seeding.

import { useActionState, useCallback, useState } from "react";
import { startMembershipAction } from "@/app/(shell)/actions/place-setup";
import { PartnerPill } from "@/components/console/badges";
import { Modal } from "@/components/shared/Modal";
import type { Membership, MembershipPrice } from "@/lib/api/console";
import { membershipPriceLabel } from "@/lib/business/plans";
import { formatShortDate } from "@/lib/format";
import {
  CTA_BUTTON_CLASS,
  ERROR_BOX_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

/**
 * What the subscription lets each place turn on. Rendered by the box and by
 * the modal from this one array, so the two can never list different perks.
 * Three lines, nouns not verbs, one clause each — held to that on purpose:
 * three check-lines would read as a pricing page inside an OPERATE surface.
 */
export const PARTNER_PERKS = [
  ["Visit Rewards", "Conservative or Aggressive discounts at the bill."],
  ["Accept Prepays", "Redeem a guest's balance as a bill reduction."],
  [
    "Guest checks",
    "On Mesita Validate (QR), and the Partner badge once a strategy is on.",
  ],
] as const;

/**
 * What the partnered state says under the pill. ONE sentence, and which one
 * depends on facts the payload may not carry:
 *
 *   no membership row   "Renews yearly." — true, and all we know. A place
 *                       made a partner by the operator switch has no
 *                       subscription to date, and neither does one whose
 *                       billing read failed. Neither may be told a date.
 *   cancelling          the date is an ENDING, so it must not wear the word
 *                       "renews" — that is the one way this line can lie.
 *   past due            still a partner (Stripe is dunning), and the console
 *                       says what needs doing without saying it is over.
 */
export function membershipLine(
  membership: Membership | null | undefined,
): string {
  if (!membership || !membership.renewsAt) return "Renews yearly.";
  const on = formatShortDate(membership.renewsAt);
  if (membership.state === "past_due") {
    return `Payment due — we'll retry the card. Paid through ${on}.`;
  }
  if (membership.cancelAtPeriodEnd) return `Ends ${on}.`;
  return `Renews ${on}.`;
}

/** The price at display rank — the box's anchor, restated in the modal at
 *  the commitment moment. One rank, one source (the catalog, or the label
 *  that stands in for it). */
function PriceLine({ price }: { price: MembershipPrice | null }) {
  const label = membershipPriceLabel(price);
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-display text-lg font-semibold tracking-tight">
        {label.amount}
      </span>
      <span className="text-muted-foreground text-[12px]">{label.suffix}</span>
    </p>
  );
}

/** The lead and the list. The lead is what keeps the list honest: "turns
 *  these on" says the place does it, from the two views that hold the
 *  switches — the subscription opens the gate and delivers nothing itself. */
function Perks() {
  return (
    <div className="flex flex-col gap-2">
      {/* A sentence, not an eyebrow: 12px muted, never the 10px tiny label
          — it carries the one qualifier that keeps the list honest. */}
      <p className="text-muted-foreground text-xs leading-snug">
This place then turns these on, from its own product views
      </p>
      <ul className="flex flex-col gap-1 text-[13px] leading-snug">
        {PARTNER_PERKS.map(([name, clause]) => (
          <li key={name} className="flex gap-2">
            {/* A dash, never a check: on this route a check means "done". */}
            <span aria-hidden className="text-muted-foreground shrink-0">
              &ndash;
            </span>
            <span className="min-w-0">
              <span className="font-medium">{name}</span>{" "}
              <span className="text-muted-foreground">&mdash; {clause}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The commitment. A form, not an onClick: the action redirects to Stripe,
 *  and a redirect out of a server action is only a redirect when the form
 *  submits it. `pending` disables the button because Checkout sessions are a
 *  network hop away and a second click is a second session. */
function BuyForm({ placeId }: { placeId: string }) {
  const [state, action, pending] = useActionState(startMembershipAction, {
    error: null,
  });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="placeId" value={placeId} />
      {state.error && <p className={ERROR_BOX_CLASS}>{state.error}</p>}
      <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={pending}>
        {pending ? "Opening checkout…" : "Continue to checkout"}
      </button>
      {/* Where the money goes, said before they leave rather than on the
          Stripe page where it is too late to be a decision. */}
      <p className="text-muted-foreground text-center text-[11px] leading-snug">
        Stripe takes the payment. Renews every year until you cancel.
      </p>
    </form>
  );
}

export function PartnerCard({
  placeId,
  partnered,
  isOwner,
  membership = null,
  price = null,
}: {
  placeId: string;
  partnered: boolean;
  isOwner: boolean;
  membership?: Membership | null;
  price?: MembershipPrice | null;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="flex flex-col gap-3">
      {partnered ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <PartnerPill />
            <span className="text-sm">{membershipLine(membership)}</span>
          </div>
          {/* Still honest about what is not built. Checkout shipped; cancelling
              from here has not (MESITA-1868), so the line narrowed rather than
              disappearing — and it goes entirely once the membership is
              already ending, where it would be an offer to do what is done. */}
          {!membership?.cancelAtPeriodEnd && (
            <p className="text-muted-foreground text-xs leading-snug">
              Cancelling from here lands with the next release.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <PriceLine price={price} />
          {isOwner ? (
            <button
              type="button"
              className={CTA_BUTTON_CLASS}
              onClick={() => setOpen(true)}
            >
              Become a partner
            </button>
          ) : (
            <span className="text-muted-foreground text-xs leading-snug">
              An owner subscribes.
            </span>
          )}
        </div>
      )}

      {/* The price list, under a hairline, in every state: it is what they
          pay for, and what they paid for. */}
      <div className="border-border/60 border-t pt-3">
        <Perks />
      </div>

      {open && (
        <Modal
          title="Mesita Membership"
          description={`${membershipPriceLabel(price).amount} ${
            membershipPriceLabel(price).suffix
          }, for this place.`}
          onClose={close}
        >
          <div className="flex flex-col gap-4">
            <PriceLine price={price} />
            <Perks />
            <BuyForm placeId={placeId} />
          </div>
        </Modal>
      )}
    </div>
  );
}

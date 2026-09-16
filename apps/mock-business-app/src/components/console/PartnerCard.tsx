"use client";

// THE MEMBERSHIP, and the two faces it wears (MESITA-1927).
//
// Snapshot of `apps/web-business/src/components/console/PartnerCard.tsx`,
// carrying its composition and two deliberate corrections — see the strip in
// `PartnerBanner.tsx` for the first, and `ManageMembership` below for the
// second.
//
// ── PARTNER IS NOT A PRODUCT ──────────────────────────────────────────────
//
// The obvious shape is a ninth card in the catalogue's grid, and Pato asked
// for exactly that. It does not survive the grid's own grammar: every card
// there answers "is this running at this place, and what is the verb", with a
// closed vocabulary of Free / On / Off / Locked / Soon. A yearly subscription
// cannot answer it — `On` because you BOUGHT it and `On` because you flipped
// a switch at the venue are different facts, and the grid has one word for
// both. And the gate cannot sit as a peer of the five products it gates, or
// five Locked cards read as five paywalls rather than one purchase.
//
// So it is ranked ABOVE the grid, and sized by the decision in it.
//
// ── ONE PURCHASE NOUN, ONE STATUS NOUN ────────────────────────────────────
//
// The thing you BUY is the **Membership**; the thing you BECOME is a
// **Partner**. The pill, the badge and the rail all still say Partner, and
// the word Membership appears only where money does — this file's title, its
// button, its price.
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMock } from "@/mock/MockStore";
import { Modal } from "@/components/shared/Modal";
import type { MembershipState, MockPlace } from "@/mock/types";
import {
  CTA_BUTTON_CLASS,
  PILL_BUTTON_CLASS,
  QUIET_LINK_BUTTON_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** The price, as one constant. The real console reads it off
 *  `membership_plans` through the console viewer's envelope so the number an
 *  owner reads is the number Stripe bills; there is no envelope here, and a
 *  second spelling of the amount anywhere in this app would be the drift that
 *  constant exists to prevent. */
export const MEMBERSHIP_PRICE = {
  amount: "MX$1,000",
  suffix: "+ IVA a year, for this place",
} as const;

/** What the subscription lets this place turn on. Rendered by the box and by
 *  the modal from this one array, so the two can never list different perks.
 *  Three lines, nouns not verbs, one clause each — held to that on purpose:
 *  a longer list would read as a pricing page inside an OPERATE surface. */
export const PARTNER_PERKS = [
  ["Visit Rewards", "Conservative or Aggressive discounts at the bill."],
  ["Accept Prepays", "Redeem a guest's balance as a bill reduction."],
  [
    "Guest checks",
    "On Mesita Validate (QR), and the Partner badge once a strategy is on.",
  ],
] as const;

/** The date, the console's way. `web-business` formats with the VIEWER's
 *  locale; this app renders against a FIXED clock so that a screenshot taken
 *  an hour later is byte-identical, and a locale-dependent string would put
 *  that guarantee back in the browser's hands. */
const RENEWS_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function membershipDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : RENEWS_FORMAT.format(d);
}

/**
 * WHAT THE STRIP SAYS, and the two ways this line could lie.
 *
 *   none        "Renews yearly." — true, and all this console knows. A place
 *               made a partner by the operator switch has no subscription to
 *               date, and neither does one whose billing read failed. Neither
 *               may be shown a day.
 *   cancelling  the date is an ENDING, so it must never wear the word
 *               "renews". This is the one way the line can actively mislead.
 *   past_due    still a partner — Stripe is dunning — so it says what needs
 *               doing without saying it is over.
 */
export function membershipLine(place: Pick<MockPlace, "membership" | "renewsAt">): {
  lead: string;
  rest: string;
} {
  if (place.membership === "none" || !place.renewsAt) {
    return { lead: "Renews yearly.", rest: "Product access included." };
  }
  const on = membershipDate(place.renewsAt);
  if (place.membership === "past_due") {
    return { lead: `Paid through ${on}.`, rest: "We'll retry the card." };
  }
  if (place.membership === "cancelling") {
    return { lead: `Ends ${on}.`, rest: "Product access until then." };
  }
  return { lead: `Renews ${on}.`, rest: "Product access included." };
}

/** THE CHIP IS NOT THE STATUS — the heading's Partner badge is.
 *
 *  `PlaceHeading` renders `PlaceFacts` on every place view, so this screen
 *  already carries a gold **Partner** badge top right. A green check and an
 *  "Active" chip a hundred pixels below it is the same single fact twice, in
 *  two colours, and `shared/Badges.tsx` opens with the rule that forbids it.
 *
 *  So the chip appears ONLY when the state is not plain active, because only
 *  then is it carrying something the heading cannot: that Stripe is retrying,
 *  or that this is running out. Null is the common case and the quiet one. */
export function membershipChip(
  state: MembershipState,
): { label: string; tone: string } | null {
  if (state === "past_due") {
    return { label: "Payment due", tone: "bg-[color:var(--tier-gold)]/18 text-[color:var(--tier-gold-ink)]" };
  }
  if (state === "cancelling") {
    return { label: "Ending", tone: "bg-muted text-muted-foreground" };
  }
  return null;
}

function Perks() {
  return (
    <div className="flex flex-col gap-2">
      {/* A sentence, not an eyebrow: it carries the one qualifier that keeps
          the list honest. Joining does not turn these on — the place does,
          from the views that hold the switches. */}
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

/** The price at display rank — the box's anchor, restated in the modal at the
 *  commitment moment. One rank, one source. */
function PriceLine() {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-display text-lg font-semibold tracking-tight">
        {MEMBERSHIP_PRICE.amount}
      </span>
      <span className="text-muted-foreground text-[12px]">
        {MEMBERSHIP_PRICE.suffix}
      </span>
    </p>
  );
}

/**
 * The door out: cancel, the invoices, the card on file. In the real console
 * this is Stripe's Billing Portal, so Mesita owns none of that logic; here it
 * says so and moves nothing, because there is no subscription to manage.
 *
 * IT USES `QUIET_LINK_BUTTON_CLASS`, AND THAT IS A CORRECTION.
 * `web-business` spells this control inline — `text-xs font-semibold
 * underline` — which leaves it with no focus ring and a hit area around 16px
 * against a 44px minimum. This is the only way to cancel a subscription or
 * fix a failed card, so a keyboard user seeing nothing on tab and a thumb
 * missing on a phone are not cosmetic. The constant carries both laws by
 * construction, which is the whole reason it is a constant.
 *
 * OWNER-ONLY, matching the real EF: the person who signed the yearly
 * commitment is the person who ends it.
 */
export function ManageMembership({ place }: { place: MockPlace }) {
  const [note, setNote] = useState<string | null>(null);
  if (place.myRole !== "owner") {
    return (
      <p className="text-muted-foreground text-xs leading-snug">
        An owner manages the membership.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className={QUIET_LINK_BUTTON_CLASS}
        onClick={() =>
          setNote(
            "Stripe's Billing Portal opens here in the real console. Nothing is real in the mock, so nothing opened.",
          )
        }
      >
        Manage membership
      </button>
      {/* Always mounted: a live region that appears together with its message
          does not announce. It is a NOTE, not an error — nothing failed. */}
      <div aria-live="polite">
        {note && (
          <p className="text-muted-foreground max-w-prose text-xs leading-snug">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The unpartnered face: a price, a door, and a price list.
 *
 * No pill, because the CTA IS the state — a "Not a partner" chip beside a
 * button that says how to stop being one is three atoms for one fact. The
 * list renders under the hairline in every state, because a paid tier with no
 * stated benefits is a price with no price list.
 */
export function PartnerCard({ place }: { place: MockPlace }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const isOwner = place.myRole === "owner";

  return (
    <div className="flex flex-col gap-3">
      <p className={TINY_LABEL_CLASS}>Mesita Membership</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <PriceLine />
        {isOwner ? (
          <button type="button" className={CTA_BUTTON_CLASS} onClick={() => setOpen(true)}>
            Get the Membership
          </button>
        ) : (
          <span className="text-muted-foreground text-xs leading-snug">
            An owner subscribes.
          </span>
        )}
      </div>
      <div className="border-border/60 border-t pt-3">
        <Perks />
      </div>
      {open && <MembershipModal place={place} onClose={close} />}
    </div>
  );
}

/**
 * The commitment, and the round trip back.
 *
 * In the real console the button posts a server action that redirects to
 * Stripe Checkout, and Stripe redirects back to `?membership=return` while a
 * webhook writes `places.partnered` on its own connection. THAT RACE IS THE
 * INTERESTING PART and nobody has ever looked at it: seeing it needs a real
 * card, a real redirect and an unpartnered place.
 *
 * So the mock performs the trip. It moves the local store and lands on the
 * same query the real return_url uses, which puts the notice, the wording and
 * the ordering on screen where they can be read. No network, no dependency —
 * the whole thing is `setScenario` and a `router.replace`.
 */
function MembershipModal({ place, onClose }: { place: MockPlace; onClose: () => void }) {
  const { setScenario } = useMock();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const buy = () => {
    if (pending) return; // a second click is a second checkout session
    setPending(true);
    setScenario({ partnered: true, membership: "active" });
    router.replace(`/places/${encodeURIComponent(place.id)}/products?membership=return`);
    onClose();
  };

  return (
    <Modal
      title="Mesita Membership"
      description={`${MEMBERSHIP_PRICE.amount} ${MEMBERSHIP_PRICE.suffix}.`}
      onClose={onClose}
      labelledBy="membership-modal-title"
    >
      <div className="flex flex-col gap-4">
        <PriceLine />
        <Perks />
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={buy}
            disabled={pending}
            className={cn(PILL_BUTTON_CLASS, "justify-center px-5 py-2.5 text-sm")}
          >
            {pending ? "Opening checkout…" : "Continue to checkout"}
          </button>
          {/* Where the money goes, said BEFORE they leave rather than on the
              Stripe page where it is too late to be a decision. */}
          <p className="text-muted-foreground text-center text-[11px] leading-snug">
            Stripe takes the payment. Renews every year until you cancel.
          </p>
        </div>
      </div>
    </Modal>
  );
}

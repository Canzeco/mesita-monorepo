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
// closed vocabulary of Free / On / Off / Locked / Soon. A subscription
// cannot answer it — `On` because you BOUGHT it and `On` because you flipped
// a switch at the venue are different facts, and the grid has one word for
// both. And the gate cannot sit as a peer of the five products it gates, or
// five Locked cards read as five paywalls rather than one purchase.
//
// So it is ranked ABOVE the grid, and sized by the decision in it.
//
// ── THE LADDER, NOT A PURCHASE NOUN (MESITA-1997) ─────────────────────────
//
// Pato, 2026-09-19: *"Is not partner / Is pro and ultra / and both include
// partnership badge."*
//
// So "Mesita Membership" is gone as a thing you buy. You buy a **rung** —
// Mesita Pro or Mesita Ultra — and `partner` is purely the STATUS both of
// them grant. The pill, the badge and the rail still say Partner; what
// changed is that no screen sells it any more, because nothing is called
// that on the price list.
//
// ── AND PAYING IS NOT BEING A PARTNER (MESITA-2019) ───────────────────────
//
// Pato: *"Partner is just for the ultra."* With the badge at Mesita Ultra,
// Mesita Pro is a rung that bills every month and wears none, so this file
// asks TWO different questions where it used to ask one. `PartnerBanner`
// branches on the BILL (`plan !== "free"`) — a Pro place needs the Manage
// plan door, not a buy button for a subscription it has. The badge itself
// reads `isPartner`.
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMock } from "@/mock/MockStore";
import { Modal } from "@/components/shared/Modal";
import {
  type MembershipState,
  type MockPlace,
  PLAN_LABEL,
  PLAN_RANK,
  type PlanTier,
} from "@/mock/types";
import {
  addedBy,
  PlanComparison,
  planPrice,
} from "@/components/console/PlanComparison";
import { PRODUCT_LABEL } from "@/lib/product-keys";
import { placePlanHref } from "@/lib/console-routes";
import {
  CTA_BUTTON_CLASS,
  PILL_BUTTON_CLASS,
  QUIET_LINK_BUTTON_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** THE THREE RUNGS, as one constant.
 *
 *  The real console reads the prices off `place_plans` through the viewer's
 *  envelope so the number an owner sees is the number Stripe bills; there is
 *  no envelope here, and a second spelling of any amount anywhere in this app
 *  would be the drift this constant exists to prevent.
 *
 *  FREE IS A ROW. A rung with no price line is a rung an operator cannot
 *  compare against the two beside it — and Free is a real rung here, not the
 *  absence of one: it carries four products.
 *
 *  `perks` is what the rung ADDS to the one below it, never the running
 *  total. Ultra restating Pro's rails would read as two ways to buy the same
 *  thing, and the ladder's whole argument is that each step buys something
 *  the step below does not have. */
// `PLAN_RUNGS` AND `rungFor` ARE GONE (MESITA-2009). They were a hand-typed
// price-and-perk list for two rungs, and they had ALREADY DRIFTED from the
// array that actually decides entitlement: they sold Member Visits and Online
// Payments as Pro perks, grouped "Orders and Reservations" into one line that
// matches no product, and listed "The Partner badge", which is not a product
// at all.
//
// `PlanComparison` derives every column from `SPECS` — the same array a
// product's own card reads for its floor — so the ladder and the products can
// no longer disagree. Moving two floors down to Start in this issue was one
// character each, and the screen followed.

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
 *   none        "Renews monthly." — true, and all this console knows. A place
 *               made a partner by the operator switch has no subscription to
 *               date, and neither does one whose billing read failed. Neither
 *               may be shown a day.
 *   cancelling  the date is an ENDING, so it must never wear the word
 *               "renews". This is the one way the line can actively mislead.
 *   past_due    still a partner — Stripe is dunning — so it says what needs
 *               doing without saying it is over.
 */
/** Small counts as words, the way the rest of this console writes them.
 *  Past ten a numeral reads better than a word, and `??` falls through. */
const NUMBER_WORD: Record<number, string> = {
  0: "No",
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
};

export function membershipLine(
  place: Pick<MockPlace, "membership" | "renewsAt" | "plan">,
): {
  lead: string;
  rest: string;
} {
  // FREE RENEWS NOTHING (MESITA-1997). This line used to run only under a
  // partnered strip, so `none` could safely mean "a partner with no
  // subscription row". The heading above it prints on every rung now, and
  // "Renews monthly." over a place that pays nothing is the plainest lie on
  // the screen.
  if (place.plan === "free") {
    // THE COUNT IS DERIVED (MESITA-2009). It read "Four products, at no
    // cost." as a literal, and it was already wrong: Online Reputation folded
    // into Mesita Profile's Activity half in MESITA-2007, so Free carries
    // three. A hand-typed count beside a list the reader can see is the one
    // number they WILL check.
    const free = addedBy("free").length;
    return {
      lead: "No subscription.",
      rest: `${free === 1 ? "One product" : `${NUMBER_WORD[free] ?? free} products`}, at no cost.`,
    };
  }
  if (place.membership === "none" || !place.renewsAt) {
    return { lead: "Renews monthly.", rest: "Product access included." };
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

/** THE CHIP IS NOT THE STATUS — the banner's Partner badge is.
 *
 *  `PartnerBanner` states the fact one gap to the left (MESITA-1943; the badge
 *  used to live in `PlaceHeading`, which is gone). A green check and an
 *  "Active" chip beside it is the same single fact twice, in two colours, and
 *  `shared/Badges.tsx` opens with the rule that forbids it.
 *
 *  So the chip appears ONLY when the state is not plain active, because only
 *  then is it carrying something the badge cannot: that Stripe is retrying, or
 *  that this is running out. Null is the common case and the quiet one. */
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

/** What the rung being bought adds, in the modal. Same source as the grid
 *  behind it, so the column an operator clicked and the sheet that opened
 *  cannot list different things. */
function Perks({ tier }: { tier: PlanTier }) {
  const adds = addedBy(tier);
  return (
    <ul className="flex flex-col gap-1 text-[13px] leading-snug">
      {adds.map((spec) => (
        <li key={spec.key} className="flex gap-2">
          {/* A dash, never a check: on this route a check means "done". */}
          <span aria-hidden className="text-muted-foreground shrink-0">
            &ndash;
          </span>
          <span className="min-w-0 font-medium">{PRODUCT_LABEL[spec.key]}</span>
        </li>
      ))}
    </ul>
  );
}


/**
 * The door out: change the rung, cancel, the invoices, the card on file. In the real console
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
 * OWNER-ONLY, matching the real EF: the person who signed the
 * commitment is the person who ends it.
 */
export function ManagePlan({ place }: { place: MockPlace }) {
  const [note, setNote] = useState<string | null>(null);
  if (place.myRole !== "owner") {
    return (
      <p className="text-muted-foreground text-xs leading-snug">
        An owner manages the plan.
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
        Manage plan
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
 * THE FREE FACE: where this place stands, and the two rungs above it.
 *
 * It used to be one price and one button, because there was one thing to buy.
 * With two rungs the card has to let them be COMPARED, which is the whole
 * reason a ladder is a ladder — so the paid rungs sit side by side and Free
 * is stated once, quietly, above them. A third column for the rung they are
 * already on would spend a third of the width telling them nothing.
 *
 * No "Not a partner" pill: the CTAs ARE the state, and a chip beside a button
 * that says how to stop being one is three atoms for one fact.
 *
 * ULTRA CARRIES NO BUY BUTTON, and that is a decision, not an omission
 * (MESITA-1997). Its only built product is the Answering Agent — Customer
 * Intelligence and Marketing Intelligence are both unbuilt. A tier that takes
 * money for four things and delivers one is the same lie `SoonStrip` refuses
 * on a single card, and it is worse here because money changes hands.
 */
export function PartnerCard({ place }: { place: MockPlace }) {
  const [buying, setBuying] = useState<PlanTier | null>(null);
  const close = useCallback(() => setBuying(null), []);
  const isOwner = place.myRole === "owner";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={TINY_LABEL_CLASS}>Plans</p>
        {/* Where they stand, said once. `PLAN_LABEL` so this and every Locked
            card in the grid below name the rung identically. */}
        <p className="text-muted-foreground text-xs leading-snug">
          This place is on {PLAN_LABEL[place.plan]}.
        </p>
      </div>
      {/* A sentence, not an eyebrow: it carries the one qualifier that keeps
          both lists honest. Buying does not turn these on — the place does,
          from the views that hold the switches. */}
      <p className="text-muted-foreground text-xs leading-snug">
        Whichever you buy, this place then turns these on from its own product
        views.
      </p>
      {/* THE LADDER IS `PlanComparison` NOW (MESITA-2009) — three rungs,
          derived from `SPECS`, instead of the two this file used to spell out
          by hand. Free is IN the grid rather than filtered out: an operator on
          Free comparing three paid rungs needs to see what they already have,
          or the columns read as three prices for an unknown baseline.

          THE VERB COMES FROM HERE, through the `action` slot, because the buy
          flow and its modal live in this file and the grid is presentation. */}
      <PlanComparison
        current={place.plan}
        action={(tier) => {
          if (PLAN_RANK[tier] <= PLAN_RANK[place.plan]) return null;
          if (tier === "ultra") {
            return (
              <p className="text-muted-foreground text-xs leading-snug">
                Soon. The Answering Agent is the only part of it that runs
                today.
              </p>
            );
          }
          if (!isOwner) {
            return (
              <p className="text-muted-foreground text-xs leading-snug">
                An owner subscribes.
              </p>
            );
          }
          return (
            <button
              type="button"
              className={cn(CTA_BUTTON_CLASS, "w-full justify-center")}
              onClick={() => setBuying(tier)}
            >
              Get {PLAN_LABEL[tier]}
            </button>
          );
        }}
      />
      {buying && <PlanModal place={place} tier={buying} onClose={close} />}
    </div>
  );
}

/**
 * The commitment, and the round trip back.
 *
 * In the real console the button posts a server action that redirects to
 * Stripe Checkout, and Stripe redirects back to `?membership=return` while a
 * webhook writes the rung on its own connection. THAT RACE IS THE INTERESTING
 * PART and nobody has ever looked at it: seeing it needs a real card, a real
 * redirect and a Free place.
 *
 * So the mock performs the trip. It moves the local store and lands on the
 * same query the real return_url uses, which puts the notice, the wording and
 * the ordering on screen where they can be read. No network, no dependency —
 * the whole thing is `setScenario` and a `router.replace`.
 *
 * THE QUERY KEEPS ITS OLD NAME. `?membership=return` is what the real
 * return_url sends and renaming it here would make the mock rehearse a round
 * trip the console does not have.
 */
function PlanModal({
  place,
  tier,
  onClose,
}: {
  place: MockPlace;
  tier: PlanTier;
  onClose: () => void;
}) {
  const { setScenario } = useMock();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const buy = () => {
    if (pending) return; // a second click is a second checkout session
    setPending(true);
    setScenario({ plan: tier, membership: "active" });
    // BACK TO PLAN, WHICH IS WHERE THEY LEFT FROM (MESITA-2012). It was the
    // Setup index while the ladder lived there; a checkout that returned to a
    // screen with no prices on it would strand the notice away from the thing
    // it is about.
    router.replace(`${placePlanHref(place.id)}?membership=return`);
    onClose();
  };

  return (
    <Modal
      title={PLAN_LABEL[tier]}
      description={`${planPrice(tier)}${tier === "free" ? "" : " + IVA a month, for this place"}.`}
      onClose={onClose}
      labelledBy="membership-modal-title"
    >
      <div className="flex flex-col gap-4">
        <Perks tier={tier} />
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={buy}
            disabled={pending}
            className={cn(PILL_BUTTON_CLASS, "justify-center px-5 py-2.5 text-sm")}
          >
            {pending ? "Opening checkout\u2026" : "Continue to checkout"}
          </button>
          {/* Where the money goes, said BEFORE they leave rather than on the
              Stripe page where it is too late to be a decision. */}
          <p className="text-muted-foreground text-center text-[11px] leading-snug">
            Stripe takes the payment. Renews every month until you cancel.
          </p>
        </div>
      </div>
    </Modal>
  );
}

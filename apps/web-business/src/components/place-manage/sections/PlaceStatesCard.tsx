"use client";

// Place States (MESITA-3588): what the business decides, read-only, beside
// Profile States (what comes from Google or Mesita). The list and its words
// are Main §10 (MESITA-3586): Owned · Plan · Billing · Stripe · Reservations ·
// House Credits Contract · House Credits · Cash Payments · Cash Payments
// Cashback · Mesita Payments · Mesita Payments Cashback · Mesita Prepayments.
// A failed read shows "?", never a false no.

import { useEffect, useState } from "react";
import { StorefrontIcon } from "@phosphor-icons/react/dist/ssr";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/ui/manage";
import {
  getBilling,
  getPlacePayments,
  getTeam,
  listVerifications,
  type PlaceBilling,
  type PlacePayments,
  type TeamMember,
} from "@/lib/business-api";
import { FREE_PLAN, planName } from "@/lib/plans";
import { StateRow } from "./StateCard";
import { moneyPlaceStates, ownedChip, ownedState, type StripeState } from "./place-states";

type Read<T> = T | null | undefined; // undefined = reading, null = failed

const STRIPE_DETAIL: Record<StripeState, string> = {
  None: "No Stripe account yet. Mesita Payments and Prepayments need one.",
  Onboarding: "Account started; the owner hasn't finished Stripe's form.",
  "In review": "Form done; Stripe is verifying the account.",
  Connected: "Takes cards and pays out to the bank.",
  "Action needed": "Takes cards; Stripe wants more details by a deadline.",
  "Payouts paused": "Takes cards; Stripe holds payouts until the bank account is fixed.",
  Restricted: "Stripe switched the account off.",
};

export function PlaceStatesCard({ place }: { place: AdminPlace }) {
  const [owner, setOwner] = useState<Read<TeamMember | false>>(undefined);
  // Claim pending (Main §10): a claim request Mesita has not decided yet.
  const [claims, setClaims] = useState<Read<number>>(undefined);
  const [billing, setBilling] = useState<Read<PlaceBilling>>(undefined);
  const [payments, setPayments] = useState<Read<PlacePayments>>(undefined);

  useEffect(() => {
    let alive = true;
    getTeam(place.id).then((r) => {
      if (alive) setOwner(r.ok ? (r.data.members.find((m) => m.role === "owner" && m.live) ?? false) : null);
    });
    listVerifications(place.id).then((r) => {
      if (alive) setClaims(r.ok ? r.data.pending.length : null);
    });
    getBilling(place.id).then((r) => {
      if (alive) setBilling(r.ok ? r.data : null);
    });
    getPlacePayments(place.id).then((r) => {
      if (alive) setPayments(r.ok ? r.data : null);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const chipOf = <T,>(v: Read<T>, chip: string) => (v === undefined ? "…" : v === null ? "?" : chip);

  // Owned (Main §10): Owned · Claim pending · Unclaimed. An owner seat
  // (MESITA-3158) wins over a pending claim, so the claims read only
  // matters while there is no owner.
  const ownedRead: Read<true> = owner
    ? true
    : owner === null || claims === null
      ? null
      : owner === undefined || claims === undefined
        ? undefined
        : true;
  const owned = ownedChip(ownedState(Boolean(owner), (claims ?? 0) > 0));
  const ownedDetail =
    ownedRead === undefined
      ? "Reading who runs this place…"
      : ownedRead === null
        ? "Couldn't read who runs this place."
        : owner
          ? `Claimed and verified: ${owner.name ?? owner.email ?? "an owner"} owns it.`
          : owned.chip === "Claim pending"
            ? "Someone asked to claim this place; Mesita hasn't decided yet."
            : "Nobody has claimed and verified this place.";

  // Plan (MESITA-3174): Free · Pro · Max, the subscription the place pays.
  const plan = billing ? (billing.subscription ? planName(billing.subscription.tier) : FREE_PLAN) : FREE_PLAN;

  const p = payments ?? null;
  const m = moneyPlaceStates({
    account: p?.account ?? null,
    settings: p?.settings ?? null,
    contract: p?.contract ?? null,
    codeSet: p?.code_set === true,
    feeHold: p?.fee.hold === true,
    feeOverdue: p?.fee.invoice?.overdue === true,
    reservations: typeof place.reservations_enabled === "boolean" ? place.reservations_enabled : null,
  });
  const money = (chip: string) => chipOf(payments, chip);

  return (
    <SectionCard icon={<StorefrontIcon size={20} />} title="Place States">
      <div className="mt-5 flex flex-col">
        <StateRow name="Owned" on={owned.on} chip={chipOf(ownedRead, owned.chip)} detail={ownedDetail} />
        <StateRow
          name="Plan"
          on={plan !== FREE_PLAN}
          chip={chipOf(billing, plan)}
          detail={billing === null ? "Couldn't read the plan." : "What the place pays Mesita: Free · Pro · Max."}
        />
        <StateRow
          name="Billing"
          on={m.billing.on}
          chip={money(m.billing.chip)}
          detail={m.billing.on ? "No unpaid Mesita invoice." : "Mesita's invoice is unpaid: card payments are off until it is paid."}
        />
        <StateRow
          name="Stripe"
          on={m.stripe.on}
          chip={money(m.stripe.chip)}
          detail={payments === null ? "Couldn't read the Stripe account." : STRIPE_DETAIL[m.stripe.chip as StripeState] ?? ""}
        />
        <StateRow
          name="Reservations"
          on={m.reservations.on}
          chip={m.reservations.chip}
          detail="Takes bookings through Mesita. Staff switch it in Settings."
        />
        <StateRow
          name="House Credits Contract"
          on={m.houseCreditsContract.on}
          chip={money(m.houseCreditsContract.chip)}
          detail="The owner's agreement with Mesita to run House Credits. Separate from Stripe."
        />
        <StateRow
          name="House Credits"
          on={m.houseCredits.on}
          chip={money(m.houseCredits.chip)}
          detail="New credit can be born here (cashback, vouchers). Off never stops guests spending what they hold."
        />
        <StateRow
          name="Cash Payments"
          on={m.cashPayments.on}
          chip={money(m.cashPayments.chip)}
          detail="Staff confirm a bill paid in cash or on the place's own terminal. Needs the switch and the waiter's code."
        />
        <StateRow
          name="Cash Payments Cashback"
          on={m.cashPaymentsCashback.on}
          chip={money(m.cashPaymentsCashback.chip)}
          detail="Back as House Credits on the cash bill the waiter marks Received. Needs House Credits and Cash Payments."
        />
        <StateRow
          name="Mesita Payments"
          on={m.mesitaPayments.on}
          chip={money(m.mesitaPayments.chip)}
          detail="Guests pay the bill by card in the app. Needs Stripe taking cards and no unpaid Mesita invoice."
        />
        <StateRow
          name="Mesita Payments Cashback"
          on={m.mesitaPaymentsCashback.on}
          chip={money(m.mesitaPaymentsCashback.chip)}
          detail="Back as House Credits on the card part of a bill. Needs House Credits and Mesita Payments."
        />
        <StateRow
          name="Mesita Prepayments"
          on={m.mesitaPrepayments.on}
          chip={money(m.mesitaPrepayments.chip)}
          detail="Guests can buy prepaid vouchers here now. Needs House Credits, a voucher switched on, Stripe taking cards and no unpaid invoice."
        />
      </div>
    </SectionCard>
  );
}

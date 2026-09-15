"use client";

// The Organization screen's Mesita Partner box (MESITA-1867).
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
// yearly subscription per ORGANIZATION — every held place is in — and it is
// what a place needs for Visit Rewards, Accept Prepays and guest checks.
// **Mesita Pay** (the Stripe account and card payments inside Mesita) is an
// optional add-on on top, and it is where the switch this file used to be
// went: `MesitaPayCard.tsx`.
//
// So this box is a price, a door, and a price list. Not partnered: the price
// at display rank and, for an owner, one CTA — no pill, because the CTA IS
// the state and a "Not a partner" chip beside it would be three atoms for one
// fact. Partnered: the shared `PartnerPill` and "Renews yearly." The list
// under the hairline renders in EVERY state, because a paid tier with no
// stated benefits is a price with no price list — but it keeps the
// MESITA-1863 truth: the lead says each place turns these on itself, the
// marker is a dash and never a check (a check means "done" on this route,
// see LifecycleBanner), and the badge is qualified with "once a strategy is
// on", which is true at the state every subscriber lands in.
//
// THE MODAL HAS NO BUTTON. Checkout is MESITA-1868; until it ships, a disabled
// "Continue" would be a knob that pretends (house law, SoonStrip.tsx). The CTA
// that opens the modal already demonstrates the door; the modal restates the
// commitment — price, what it unlocks — and says, in one INFO line, that the
// checkout lands with the next release. PR 2 adds the real button here.
//
// No `useState(partnered)` any more: nothing here writes, so nothing here
// needs re-seeding, and the page dropped its `key=` remount with it. The only
// state is whether the modal is open.

import { useCallback, useState } from "react";
import { PartnerPill } from "@/components/console/badges";
import { Modal } from "@/components/shared/Modal";
import { PARTNER_PRICE_LABEL } from "@/lib/business/plans";
import {
  CTA_BUTTON_CLASS,
  INFO_BOX_CLASS,
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

/** The price at display rank — the box's anchor, restated in the modal at
 *  the commitment moment. One rank, one source (PARTNER_PRICE_LABEL). */
function PriceLine() {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-display text-lg font-semibold tracking-tight">
        {PARTNER_PRICE_LABEL.amount}
      </span>
      <span className="text-muted-foreground text-[12px]">
        {PARTNER_PRICE_LABEL.suffix}
      </span>
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
        Each place then turns these on, from Rewards and Capabilities
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

export function PartnerCard({
  partnered,
  isOwner,
}: {
  partnered: boolean;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="flex flex-col gap-3">
      {partnered ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <PartnerPill />
            <span className="text-sm">Renews yearly.</span>
          </div>
          {/* Honest about what is not built: the subscription's own doors are
              MESITA-1868. Said once, quietly, instead of a Manage button that
              opens nothing. */}
          <p className="text-muted-foreground text-xs leading-snug">
            Renewal and cancellation land with the next release.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <PriceLine />
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
          title="Mesita Partner"
          description={`${PARTNER_PRICE_LABEL.amount} ${PARTNER_PRICE_LABEL.suffix}, per organization.`}
          onClose={close}
        >
          <div className="flex flex-col gap-4">
            <PriceLine />
            <Perks />
            <div className={INFO_BOX_CLASS}>
              Checkout lands with the next release.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

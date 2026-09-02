"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { formatCurrency } from "@/lib/api/profile";
import {
  bonusFor,
  bonusPctFor,
  CREDIT_PLACES,
  expiryDaysFor,
  formatUnlock,
  holdHoursFor,
  type ControlsPolicy,
  type CreditPlace,
} from "@/lib/mock/credits-mock";
import { cn } from "@/lib/utils";

// Buy Credits at a place.
//
// The sheet's job is to make the TRADE legible, because the trade is the whole
// model: a bonus AND a hold, moving together. Cabaret pays 25% and holds the
// money three days; a place that has set nothing inherits the console default
// and holds it three hours for 5%. Seeing those side by side is what shows a
// prepay is a term deposit rather than a discount at the table — the place is
// buying float, and the bonus is the rate it pays for it.
//
// AND THE EXPIRY IS ON THIS SHEET, not only on the card afterwards. This is the
// screen where a guest agrees to the terms; a life the money has is a term, and
// a term first met on the balance you already paid for is a term you were not
// offered. It rides the same lines as the hold rather than a warning of its
// own — 90 days is generous, and shouting it would sell it as a catch.
//
// ALL THREE NUMBERS ARE RESOLVED THROUGH THE POLICY, never read off the place
// alone: `bonusPct`/`lockHours`/`expiryDays` are null on every place that has
// set nothing, which is all of them today, and the console owns what null
// means.
//
// Preset amounts rather than a free field: this is a demo of a shape, and a
// numeric keypad on a phone would be three taps of friction for no insight.

const AMOUNTS = [50_000, 100_000, 200_000];

function PlaceRow({
  place,
  policy,
  selected,
  onSelect,
}: {
  place: CreditPlace;
  policy: ControlsPolicy;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold tracking-tight">
          {place.name}
        </span>
        <span className="text-muted-foreground block text-xs">
          +{bonusPctFor(place, policy)}% · held{" "}
          {formatUnlock(holdHoursFor(place, policy))} · {expiryDaysFor(
            place,
            policy,
          )}d to spend
        </span>
      </span>
    </button>
  );
}

export function BuyCreditsSheet({
  open,
  onClose,
  onBuy,
  busy,
  policy,
  heldCents,
  onHoldCents,
}: {
  open: boolean;
  onClose: () => void;
  onBuy: (placeId: string, paidCents: number) => Promise<boolean>;
  busy: boolean;
  /** Console-owned terms. A place's own values win where it set them. */
  policy: ControlsPolicy;
  /** Everything already held, across every place. */
  heldCents: number;
  /** The part of it still inside a hold, and therefore spendable nowhere. */
  onHoldCents: number;
}) {
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [paidCents, setPaidCents] = useState<number>(AMOUNTS[1]);

  const place = CREDIT_PLACES.find((p) => p.id === placeId) ?? null;
  const bonus = place ? bonusFor(paidCents, bonusPctFor(place, policy)) : 0;

  async function submit() {
    if (!place) return;
    const ok = await onBuy(place.id, paidCents);
    if (ok) {
      setPlaceId(null);
      onClose();
    }
  }

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Buy Credits">
      <div className={SHEET_TITLE_CLASS}>Buy Credits</div>
      <div className={SHEET_BODY_CLASS}>
        <div className="flex flex-col gap-5">
          {/* WHAT YOU ALREADY HOLD (2026-09-02 design review). This line used
              to lead the Wallet itself, where it was the first thing read on a
              screen whose subject was underneath it — and it describes money
              that can be spent nowhere but the place that issued it. Here it is
              standing where a guest is deciding whether to add more, which is
              the one moment the number is actually load-bearing. Suppressed at
              zero: a first-time buyer does not need to be told they hold
              nothing. */}
          {heldCents > 0 && (
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="text-foreground text-sm font-bold tabular-nums">
                {formatCurrency(heldCents)}
              </span>{" "}
              already held
              {onHoldCents > 0 && (
                <> · {formatCurrency(onHoldCents)} still inside its hold</>
              )}{" "}
              · spendable only where you paid
            </p>
          )}

          <div>
            <div className="type-eyebrow text-muted-foreground mb-2">
              Where
            </div>
            <div className="flex flex-col gap-2">
              {CREDIT_PLACES.map((p) => (
                <PlaceRow
                  key={p.id}
                  place={p}
                  policy={policy}
                  selected={p.id === placeId}
                  onSelect={() => setPlaceId(p.id)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="type-eyebrow text-muted-foreground mb-2">
              How much
            </div>
            <div className="flex gap-2">
              {AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setPaidCents(amount)}
                  aria-pressed={amount === paidCents}
                  className={cn(
                    "flex-1 rounded-2xl border py-3 text-sm font-bold tabular-nums transition",
                    amount === paidCents
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50",
                  )}
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
          </div>

          {place && (
            <div className="border-border bg-card rounded-2xl border p-4">
              <div className="type-eyebrow text-muted-foreground">
                You would get
              </div>
              <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                {formatCurrency(paidCents + bonus)}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                {formatCurrency(paidCents)} paid, +{formatCurrency(bonus)} from{" "}
                {place.name} · unlocks in{" "}
                {formatUnlock(holdHoursFor(place, policy))} · expires{" "}
                {expiryDaysFor(place, policy)} days after today
              </div>
            </div>
          )}

          <Button onClick={submit} disabled={!place || busy}>
            {busy
              ? "Working…"
              : place
                ? `Pay ${formatCurrency(paidCents)}`
                : "Pick a place"}
          </Button>

          <p className="text-muted-foreground text-xs">
            Emulated. No money moves, nothing is charged, and the balance lives
            in this browser only.
          </p>
        </div>
      </div>
    </LocalSheet>
  );
}

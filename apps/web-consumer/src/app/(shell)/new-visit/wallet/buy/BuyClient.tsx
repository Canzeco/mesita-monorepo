"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  WalletParkedNote,
  WalletScreen,
} from "@/components/consumer/wallet/WalletScreen";
import {
  AMOUNTS,
  AmountPicker,
  PlacePicker,
  TermsPreview,
} from "@/components/consumer/credits/PickCredits";
import { formatCurrency } from "@/lib/api/profile";
import {
  bonusFor,
  bonusPctFor,
  expiryDaysFor,
  placeById,
} from "@/lib/mock/credits-mock";
import type { Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Buy Credits at a place.
//
// The screen's job is to make the TRADE legible: pay a place up front and it
// gives you back more than you paid. Cabaret pays 25%, a place that has set
// nothing inherits the console default of 5%. Seeing them side by side is what
// shows the bonus is a rate a place chose, not a coupon Mesita printed.
//
// THE HOLD IS NOT ON THIS SCREEN (Pato, 2026-09-08). Both terms used to ride
// every line here — "+25% · held 3d" — because the model was a term deposit and
// the pairing was the point. Credits are active the moment they are bought now,
// so there is no window to disclose and no line that mentions one.
//
// THE EXPIRY IS STILL HERE, not only on the card afterwards. This is the screen
// where a guest agrees to the terms; a life the money has is a term, and a term
// first met on the balance you already paid for is a term you were not offered.
// It rides the same line as the bonus rather than a warning of its own — 90 days
// is generous, and shouting it would sell it as a catch.
//
// BOTH NUMBERS ARE RESOLVED THROUGH THE POLICY, never read off the place alone:
// `bonusPct`/`expiryDays` are null on every place that has set nothing, which is
// all of them today, and the console owns what null means.

export function BuyClient({ seed }: { seed: Seed }) {
  const credits = useCredits(seed);
  const router = useRouter();
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [paidCents, setPaidCents] = useState<number>(AMOUNTS[1]);

  const place = placeId ? (placeById(placeId) ?? null) : null;
  const bonus = place
    ? bonusFor(paidCents, bonusPctFor(place, credits.policy))
    : 0;
  const balances = credits.state?.balances ?? [];
  // Every peso the guest has here, expired included — quietly dropping dead
  // money would make this total disagree with the cards they just left.
  const held = balances.reduce((sum, b) => sum + b.balanceCents, 0);

  async function submit() {
    if (!place) return;
    const ok = await credits.buy(place.id, paidCents);
    // replace(), not push(): a finished purchase is not a page the back gesture
    // should return into, and the wallet behind it needs the fresh balance.
    if (ok) router.replace(CONSUMER_ROUTES.newVisit.wallet);
  }

  return (
    <WalletScreen
      title="Buy Credits"
      footer={
        <div className="flex flex-col gap-2">
          {credits.error && (
            <p role="alert" className="text-destructive text-center text-xs">
              {errorMessage(credits.error)}
            </p>
          )}
          <Button
            onClick={submit}
            disabled={!place || credits.busy}
            className="w-full"
          >
            {credits.busy
              ? "Working…"
              : place
                ? `Pay ${formatCurrency(paidCents)}`
                : "Pick a place"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* WHAT YOU ALREADY HOLD (2026-09-02 design review). This line used to
            lead the Wallet itself, where it was the first thing read on a
            screen whose subject was underneath it — and it describes money that
            can be spent nowhere but the place that issued it. Here it stands
            where a guest is deciding whether to add more, which is the one
            moment the number is actually load-bearing. Suppressed at zero: a
            first-time buyer does not need to be told they hold nothing. */}
        {held > 0 && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            <span className="text-foreground text-sm font-bold tabular-nums">
              {formatCurrency(held)}
            </span>{" "}
            already held · spendable only where you paid
          </p>
        )}

        <PlacePicker
          policy={credits.policy}
          placeId={placeId}
          onSelect={setPlaceId}
        />

        <AmountPicker value={paidCents} onChange={setPaidCents} />

        {place && (
          <TermsPreview
            eyebrow="You would get"
            totalCents={paidCents + bonus}
            detail={
              <>
                {formatCurrency(paidCents)} paid, +{formatCurrency(bonus)} from{" "}
                {place.name} · spendable straight away · expires{" "}
                {expiryDaysFor(place, credits.policy)} days after today
              </>
            }
          />
        )}

        <WalletParkedNote>
          Emulated. No money moves, nothing is charged, and the balance lives in
          this browser only.
        </WalletParkedNote>
      </div>
    </WalletScreen>
  );
}

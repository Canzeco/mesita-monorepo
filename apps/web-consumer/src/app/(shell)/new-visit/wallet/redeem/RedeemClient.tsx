"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PinField, PIN_LENGTH } from "@/components/consumer/PinField";
import {
  WalletParkedNote,
  WalletScreen,
} from "@/components/consumer/wallet/WalletScreen";
import { formatCurrency } from "@/lib/api/profile";
import type { CreditGift, Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Redeem a gift code.
//
// THE ERROR IS ON THE FIELD, not in a toast — `PinField` carries that rule and
// the `aria-describedby` that makes it real. A code that failed is exactly the
// thing a guest re-reads while checking their typing, and here it is money.
//
// TWO STATES ON ONE ROUTE, like Gift: the field, then what landed. The result
// names the PLACE before the amount, because Credits are spendable at exactly
// one place and a guest who just claimed some needs to know which one before
// they know how much.

function RedeemResult({ gift }: { gift: CreditGift }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-card rounded-2xl border p-5 text-center">
        <div className="type-eyebrow text-muted-foreground">
          Credits added at
        </div>
        <div className="font-display mt-1 text-2xl font-semibold tracking-tight">
          {gift.placeName}
        </div>
        <div className="mt-3 text-4xl font-bold tracking-tight tabular-nums">
          {formatCurrency(gift.creditedCents)}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          Spendable at {gift.placeName} only · {gift.expiryDays} days from today
        </div>
      </div>

      {gift.note ? (
        <div>
          <div className="type-eyebrow text-muted-foreground mb-2">
            They wrote
          </div>
          <p className="border-border bg-card rounded-2xl border p-4 text-sm">
            {gift.note}
          </p>
        </div>
      ) : null}

      <WalletParkedNote>
        Emulated. Nothing here is money — the balance lives in this browser
        only.
      </WalletParkedNote>
    </div>
  );
}

export function RedeemClient({
  seed,
  initialCode,
}: {
  seed: Seed;
  /** Digits only, already capped — see page.tsx. */
  initialCode: string;
}) {
  const credits = useCredits(seed);
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [claimed, setClaimed] = useState<CreditGift | null>(null);

  async function submit() {
    const gift = await credits.redeem(code);
    if (gift) setClaimed(gift);
  }

  if (claimed) {
    return (
      <WalletScreen
        title="Claimed"
        footer={
          <Button
            onClick={() => router.replace(CONSUMER_ROUTES.newVisit.wallet)}
            className="w-full"
          >
            See it in your wallet
          </Button>
        }
      >
        <RedeemResult gift={claimed} />
      </WalletScreen>
    );
  }

  return (
    <WalletScreen
      title="Redeem Credits"
      footer={
        <Button
          onClick={submit}
          disabled={code.length !== PIN_LENGTH || credits.busy}
          className="w-full"
        >
          {credits.busy ? "Checking…" : "Claim Credits"}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Someone bought Credits for you at a place. Enter the ten digits they
          sent and the balance lands in your wallet.
        </p>

        <div>
          <PinField
            id="redeem-code"
            label="Gift code"
            value={code}
            onChange={(digits) => {
              // Clear the last failure as soon as the guest edits: an error
              // that outlives the code it was about is an error about nothing.
              if (credits.error) credits.clearError();
              setCode(digits);
            }}
            error={credits.error ? errorMessage(credits.error) : null}
            disabled={credits.busy}
          />
        </div>

        <WalletParkedNote>
          Emulated. Codes work in this browser only — gift one from Wallet ›
          Gift and claim it here.
        </WalletParkedNote>
      </div>
    </WalletScreen>
  );
}

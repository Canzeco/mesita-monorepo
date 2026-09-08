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
import { apiRedeemGift, type RedeemGiftOutcome } from "@/lib/api/credits";
import { EFError } from "@/lib/api/_invoke";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Redeem a gift code — the real path (MESITA-1677). Was fully mock-backed
// until now; wired to consumer-web-redeem-credit-gift, whose whole
// concurrency story is ONE conditional UPDATE server-side (redeem_credit_gift)
// — this screen just shapes the code and shows the ONE generic error the RPC
// hands back, copying consumer-web-claim-invite-code's deliberate
// non-differentiation: lost the race, spent, expired, or cancelled all read
// identically here, on purpose.
//
// THE ERROR IS ON THE FIELD, not in a toast — `PinField` carries that rule and
// the `aria-describedby` that makes it real. A code that failed is exactly the
// thing a guest re-reads while checking their typing, and here it is money.
//
// TWO STATES ON ONE ROUTE, like Gift: the field, then what landed. The result
// names the ORGANIZATION before the amount (Credits are org-scoped, not
// place-scoped — the real backend's own model), because a guest who just
// claimed some needs to know where before they know how much.
//
// REACHED FROM THE PUBLIC LANDING PAGE (/gift/[code], outside the shell) via
// ?code=, forwarded through sign-in — see page.tsx, unchanged by this rewire.

function RedeemResult({ result }: { result: RedeemGiftOutcome }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-card rounded-2xl border p-5 text-center">
        <div className="type-eyebrow text-muted-foreground">
          Credits added at
        </div>
        <div className="font-display mt-1 text-2xl font-semibold tracking-tight">
          {result.organizationName}
        </div>
        <div className="mt-3 text-4xl font-bold tracking-tight tabular-nums">
          {formatCurrency(result.creditedCents)}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          Spendable at {result.organizationName} only
        </div>
      </div>

      {result.note ? (
        <div>
          <div className="type-eyebrow text-muted-foreground mb-2">
            They wrote
          </div>
          <p className="border-border bg-card rounded-2xl border p-4 text-sm">
            {result.note}
          </p>
        </div>
      ) : null}

      <WalletParkedNote>
        Runs in Stripe TEST mode — the balance above is real, on that
        organization&apos;s account.
      </WalletParkedNote>
    </div>
  );
}

export function RedeemClient({ initialCode }: { initialCode: string }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<RedeemGiftOutcome | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiRedeemGift(supabase, code);
      setClaimed(result);
    } catch (err) {
      setError(err instanceof EFError ? err.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
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
        <RedeemResult result={claimed} />
      </WalletScreen>
    );
  }

  return (
    <WalletScreen
      title="Redeem Credits"
      footer={
        <Button
          onClick={submit}
          disabled={code.length !== PIN_LENGTH || busy}
          className="w-full"
        >
          {busy ? "Checking…" : "Claim Credits"}
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
              if (error) setError(null);
              setCode(digits);
            }}
            error={error}
            disabled={busy}
          />
        </div>

        <WalletParkedNote>
          Runs in Stripe TEST mode. Gift one from Wallet › Gift and claim it
          here.
        </WalletParkedNote>
      </div>
    </WalletScreen>
  );
}

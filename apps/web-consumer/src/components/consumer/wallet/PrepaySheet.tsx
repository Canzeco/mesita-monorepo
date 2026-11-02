"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiStartPrepay, money, PREPAY_PRESETS_FALLBACK } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// MESITA PREPAY (MESITA-3098; Pato, 2026-11-01: "Wallet is for
// prepayments"): pick an amount, pay it on Stripe, and it sits in your
// Wallet as a balance at this place. Mesita collects it (Pato's gate). The
// three amounts or your own, whole units of the place's currency; the
// server checks the bounds and says why it refuses. Checkout comes back to
// the Wallet, which credits the payment and shows the balance.

export function PrepaySheet({
  place,
  open,
  onClose,
}: {
  place: PlaceDetail;
  open: boolean;
  onClose: () => void;
}) {
  return (
    // LocalSheet unmounts its children once closed: every opening starts fresh.
    <LocalSheet open={open} onClose={onClose} ariaLabel={`Prepay at ${place.name}`}>
      <PrepayForm place={place} />
    </LocalSheet>
  );
}

function PrepayForm({ place }: { place: PlaceDetail }) {
  const getSupabase = useLazyBrowserSupabase();
  const currency = (place.currency || "MXN").toLowerCase();
  const presets = PREPAY_PRESETS_FALLBACK[currency] ?? [];
  const [picked, setPicked] = useState<number | null>(presets[1] ?? presets[0] ?? null);
  const [own, setOwn] = useState("");
  const [starting, setStarting] = useState(false);

  const ownCents = /^\d{1,6}$/.test(own.trim()) ? Number(own.trim()) * 100 : null;
  const amount = own.trim() !== "" ? ownCents : picked;

  async function start() {
    if (amount == null || amount <= 0 || starting) return;
    setStarting(true);
    try {
      const { url } = await apiStartPrepay(getSupabase(), {
        placeId: place.id,
        amountCents: amount,
        returnUrl: `${window.location.origin}${CONSUMER_ROUTES.pay}`,
      });
      window.location.assign(url);
    } catch (err) {
      // A refusal (4xx) is this sheet's to explain; network, session and
      // server failures were already said by the app's error notifier.
      const status = err instanceof EFError ? err.status : null;
      if (status != null && status >= 400 && status < 500 && status !== 401) {
        toast.error(errMsg(err, "Couldn't start the prepayment. Try again."));
      }
      setStarting(false);
    }
  }

  return (
    <div className={SHEET_BODY_CLASS}>
      <div className="flex items-center gap-3">
        <span className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Wallet className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className={SHEET_TITLE_CLASS}>Mesita Prepay</h2>
          <p className="text-muted-foreground truncate text-xs">{place.name}</p>
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-sm">
        Pay ahead and keep it in your Wallet as a balance at {place.name}.
      </p>

      <p className="mt-5 text-sm font-semibold">How much?</p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Amount">
        {presets.map((cents) => {
          const on = own.trim() === "" && picked === cents;
          return (
            <button
              key={cents}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setPicked(cents);
                setOwn("");
              }}
              className={cn(
                "flex h-12 items-center justify-center rounded-lg border text-sm font-semibold transition",
                on ? "border-foreground bg-foreground text-paper" : "border-border bg-card hover:bg-muted",
              )}
            >
              {money(cents, currency)}
            </button>
          );
        })}
      </div>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={own}
        onChange={(e) => setOwn(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
        placeholder={`Other amount (${currency.toUpperCase()})`}
        aria-label={`Other amount in ${currency.toUpperCase()}`}
        className={cn(INPUT_CLASS, "mt-2")}
      />

      <button
        type="button"
        onClick={() => void start()}
        disabled={amount == null || amount <= 0 || starting}
        className={cn(PRIMARY_BUTTON_CLASS, "mt-5")}
      >
        {starting ? "Opening checkout…" : amount ? `Prepay ${money(amount, currency)}` : "Prepay"}
      </button>
      <p className="text-muted-foreground mt-3 text-center text-xs">
        You pay Mesita by card. The balance is for {place.name} only.
      </p>
    </div>
  );
}

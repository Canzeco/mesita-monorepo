"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  createTicketPaymentSession,
  markTicketPaidMock,
} from "@/lib/api/ticket-payment";
import { getStripePromise } from "@/lib/stripe/client";
import { errMsg } from "@/lib/utils";

type TicketEmbeddedPaymentProps = {
  ticketId: string;
  returnUrl: string;
  onComplete: () => void;
  onError?: (message: string) => void;
};

export function TicketEmbeddedPayment({
  ticketId,
  returnUrl,
  onComplete,
  onError,
}: TicketEmbeddedPaymentProps) {
  const supabase = useBrowserSupabase();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const stripePromise = getStripePromise();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await createTicketPaymentSession(supabase, {
          ticketId,
          returnUrl,
        });
        if (cancelled) return;
        if (res.mock) {
          setMock(true);
          setClientSecret(null);
        } else if (res.client_secret) {
          setMock(false);
          setClientSecret(res.client_secret);
        } else {
          setLoadError("Payment session could not be started.");
        }
      } catch (e) {
        if (!cancelled) {
          const msg = errMsg(e, "Couldn't load payment.");
          setLoadError(msg);
          onError?.(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, ticketId, returnUrl, onError]);

  const onMockPay = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      await markTicketPaidMock(supabase, ticketId);
      onComplete();
    } catch (e) {
      const msg = errMsg(e, "Demo payment failed.");
      setLoadError(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }, [supabase, ticketId, onComplete, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/30 px-4 py-10">
        <Loader2 className="text-primary h-5 w-5 animate-spin" />
        <span className="text-muted-foreground text-sm">Loading secure checkout…</span>
      </div>
    );
  }

  if (loadError && !mock && !clientSecret) {
    return (
      <p className="bg-destructive/10 text-destructive rounded-2xl px-4 py-3 text-sm">
        {loadError}
      </p>
    );
  }

  if (mock) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-secondary/40 bg-secondary/5 px-4 py-3">
          <ShieldCheck className="text-secondary mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-muted-foreground text-sm leading-snug">
            Demo mode — no card charge. Use this to walk through the visit flow
            before Stripe is fully wired.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onMockPay()}
          disabled={busy}
          className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base"
        >
          <CreditCard className="h-5 w-5" />
          {busy ? "Processing…" : "Pay securely (demo)"}
        </button>
        {loadError ? (
          <p className="text-destructive text-sm">{loadError}</p>
        ) : null}
      </div>
    );
  }

  if (!clientSecret || !stripePromise) {
    return (
      <p className="bg-destructive/10 text-destructive rounded-2xl px-4 py-3 text-sm">
        {stripePromise === null
          ? "Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card payments."
          : loadError ?? "Payment is unavailable."}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ clientSecret, onComplete }}
      >
        <div className="min-h-[360px] w-full [&_iframe]:min-h-[360px]">
          <EmbeddedCheckout />
        </div>
      </EmbeddedCheckoutProvider>
    </div>
  );
}

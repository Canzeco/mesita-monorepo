"use client";

// EXPRESS PAY ON THE OFFERS SHEET (MESITA-4384): the voucher side of the
// shared ExpressPayButton. One request_id per sheet opening and basket
// (this component mounts with the sheet and remounts on a new basket),
// reused by every open() and settle() including after a wallet decline (the
// same PaymentIntent takes another payment method); rotated after a
// definitive refusal, so the next tap starts a new purchase.

import { useRef } from "react";
import type { VoucherBasketItem } from "@mesita/place-profile";
import { EFError } from "@/lib/api/_invoke";
import { apiBuyVoucherExpress, apiExpressSetup, BUY_REFUSAL, type ExpressBasket, type ExpressStep, isDefinitiveRefusal } from "@/lib/api/wallet";
import { trackEvent } from "@/lib/analytics/track";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import {
  ExpressPayButton,
  type ExpressPayDone,
  type ExpressPayOpen,
  ExpressPayRefusal,
  type ExpressPaySettle,
  type ExpressWallet,
} from "@/components/consumer/pay/ExpressPayButton";

const walletOf = (w: string | undefined): ExpressWallet | null => (w === "apple_pay" || w === "google_pay" ? w : null);

export function ExpressVoucherPay({
  placeId,
  items,
  mentionId,
  disabled,
  onState,
  onLock,
  onDone,
  onError,
}: {
  placeId: string;
  items: VoucherBasketItem[];
  mentionId?: string;
  disabled: boolean;
  onState: (s: "loading" | "ready" | "none") => void;
  onLock: (locked: boolean) => void;
  onDone: (d: ExpressPayDone) => void;
  onError: (text: string | null) => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const requestId = useRef<string>(crypto.randomUUID());
  const purchaseId = useRef<string | null>(null);
  const one = items.length === 1 && items[0].qty === 1;
  const basket = {
    place_id: placeId,
    ...(one ? { voucher: items[0].voucher } : { items }),
    ...(mentionId ? { mention_id: mentionId } : {}),
  } as ExpressBasket;

  const refusal = (err: unknown): ExpressPayRefusal | null => {
    if (!(err instanceof EFError)) return null;
    if (!isDefinitiveRefusal(err.status, err.code)) return null;
    // A definitive answer: the next tap is a new purchase.
    requestId.current = crypto.randomUUID();
    const code = err.code ?? "failed";
    return new ExpressPayRefusal(BUY_REFUSAL[code] ?? BUY_REFUSAL.failed, code);
  };

  const call = async (): Promise<ExpressStep> => {
    const r = await apiBuyVoucherExpress(getSupabase(), { ...basket, request_id: requestId.current });
    purchaseId.current = r.purchase_id;
    return r.express;
  };

  const open = async (): Promise<ExpressPayOpen> => {
    let step: ExpressStep;
    try {
      step = await call();
    } catch (err) {
      throw refusal(err) ?? err;
    }
    if (step.status === "succeeded") return { kind: "done", outcome: "paid", payWith: walletOf(step.pay_with) };
    if (step.status === "processing") return { kind: "done", outcome: "processing", payWith: null };
    return { kind: "confirm", client_secret: step.client_secret, amount_cents: step.amount_cents };
  };

  const settle = async (): Promise<ExpressPaySettle> => {
    let step: ExpressStep;
    try {
      step = await call();
    } catch (err) {
      const r = refusal(err);
      if (r) return { kind: "refused", text: r.text };
      throw err; // unknown: "Payment received"
    }
    if (step.status === "succeeded") return { kind: "done", outcome: "paid", payWith: walletOf(step.pay_with) };
    if (step.status === "processing") return { kind: "done", outcome: "processing", payWith: null };
    if (step.decline_code) return { kind: "refused", text: step.error ?? "Your bank declined it. Try another way to pay." };
    // Confirmed in the browser but not yet on the PI: the receiver settles it.
    throw new Error("express_unsettled");
  };

  const done = (d: ExpressPayDone) => {
    const paidWith = d.payWith;
    trackEvent(getSupabase(), "voucher_paid", {
      place_id: placeId,
      items,
      method: paidWith ?? "express",
      status: d.outcome === "paid" ? "succeeded" : d.outcome,
    });
    requestId.current = crypto.randomUUID();
    onDone(d);
  };

  return (
    <ExpressPayButton
      setup={async () => {
        const s = await apiExpressSetup(getSupabase(), basket);
        return s.available
          ? { available: true, wallets: s.wallets, publishable_key: s.publishable_key, stripe_account: s.stripe_account, amount_cents: s.amount_cents, currency: s.currency, label: s.label }
          : { available: false, code: s.code };
      }}
      open={open}
      settle={settle}
      disabled={disabled}
      onState={onState}
      onLock={onLock}
      onDone={done}
      onError={onError}
      onEvent={(name, payload) => {
        if (name === "express_ready") trackEvent(getSupabase(), "express_ready", { place_id: placeId, ...payload });
        else {
          trackEvent(getSupabase(), "express_failed", {
            place_id: placeId,
            ...payload,
            request_id: requestId.current,
            ...(purchaseId.current ? { purchase_id: purchaseId.current } : {}),
          });
        }
      }}
    />
  );
}

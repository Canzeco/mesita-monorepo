"use client";

// APPLE PAY / GOOGLE PAY ON PAY BILL (MESITA-4386): the bill side of the
// shared ExpressPayButton, as a HOLD. Face ID / Google authorizes the card
// part (Stripe holds it, nothing is charged); the bill opens with its QR; the
// waiter's code captures it, exactly like a held saved card (MESITA-3856).
//
//   open()   — consumer-web-pay-guest with `express: true` (the Pay screen's
//              one request id, so a retry finds the same bill and hold);
//   settle() — consumer-web-get-tab: "held" once Stripe holds it.
//
// Any end after the bill opened goes to the bill page, which says where it
// stands (QR, Confirming, or Not paid with Start again).

import { useRef } from "react";
import { EFError } from "@/lib/api/_invoke";
import { apiGetTab, apiPayGuest, TAB_REFUSAL, type TabSplit } from "@/lib/api/tab";
import { apiExpressSetup } from "@/lib/api/wallet";
import { trackEvent } from "@/lib/analytics/track";
import {
  ExpressPayButton,
  type ExpressPayOpen,
  type ExpressWallet,
  ExpressPayRefusal,
  type ExpressPaySettle,
} from "@/components/consumer/pay/ExpressPayButton";

type Client = Parameters<typeof apiGetTab>[0];

export function ExpressBillPay({
  wallet,
  getSupabase,
  placeId,
  billCents,
  split,
  dueCents,
  requestId,
  disabled,
  onState,
  onLock,
  onOpened,
  onBill,
  onError,
}: {
  /** MESITA-4397: the one wallet the guest picked on Method. */
  wallet: ExpressWallet;
  getSupabase: () => Client;
  placeId: string;
  billCents: number;
  split: TabSplit;
  /** The card part plus its tip: what Face ID authorizes. */
  dueCents: number;
  /** The Pay screen's request id (minted once per tap, kept across retries). */
  requestId: () => string;
  disabled: boolean;
  onState: (s: "loading" | "ready" | "none") => void;
  onLock: (locked: boolean) => void;
  /** The bill opened on the server (remember it before anything else). */
  onOpened: (tabId: string, qrUrl: string) => void;
  /** Done one way or another: open the bill page. */
  onBill: (tabId: string) => void;
  /** Refused before any bill opened: the Pay screen's error line. */
  onError: (text: string | null, code: string | null) => void;
}) {
  // The bill this tap opened, across re-renders.
  const tab = useRef<string | null>(null);

  const open = async (): Promise<ExpressPayOpen> => {
    try {
      const r = await apiPayGuest(getSupabase(), { place_id: placeId, bill_cents: billCents, request_id: requestId(), express: true, ...split });
      tab.current = r.tab_id;
      onOpened(r.tab_id, r.qr_url);
      const step = r.express ?? (await apiGetTab(getSupabase(), r.tab_id)).express_action;
      if (step && step.status === "requires_payment_method") return { kind: "confirm", client_secret: step.client_secret, amount_cents: step.amount_cents };
      // Already held (a replay after Face ID): straight to the bill.
      return { kind: "done", outcome: "processing", payWith: null };
    } catch (err) {
      if (err instanceof EFError && err.code) {
        throw new ExpressPayRefusal(TAB_REFUSAL[err.code] ?? err.message ?? "Couldn't start the payment. Try again.", err.code);
      }
      throw err;
    }
  };

  const settle = async (): Promise<ExpressPaySettle> => {
    if (!tab.current) throw new Error("no_bill");
    const r = await apiGetTab(getSupabase(), tab.current);
    const held = r.tab.parts.some((p) => p.part === "card" && (p.held_at || p.paid_at));
    if (held) return { kind: "done", outcome: "paid", payWith: null };
    if (r.card_error) return { kind: "refused", text: TAB_REFUSAL[r.card_error.code] ?? r.card_error.error };
    // Still going through: the bill page keeps reading it.
    throw new Error("express_unsettled");
  };

  return (
    <ExpressPayButton
      hold
      setup={async () => {
        const s = await apiExpressSetup(getSupabase(), { place_id: placeId, bill: { amount_cents: dueCents } });
        return s.available
          ? { available: true, wallets: s.wallets.filter((w) => w === wallet), publishable_key: s.publishable_key, stripe_account: s.stripe_account, amount_cents: s.amount_cents, currency: s.currency, label: s.label }
          : { available: false, code: s.code };
      }}
      open={open}
      settle={settle}
      disabled={disabled}
      onState={onState}
      onLock={onLock}
      onDone={() => {
        if (tab.current) onBill(tab.current);
      }}
      onError={(text) => {
        // After the bill opened, its page says what happened (Not paid,
        // Start again); before, the Pay screen keeps the guest here.
        if (tab.current && text) onBill(tab.current);
        else onError(text, null);
      }}
      onEvent={(name, payload) => {
        if (name === "express_ready") trackEvent(getSupabase(), "express_ready", { place_id: placeId, flow: "bill", ...payload });
        else trackEvent(getSupabase(), "express_failed", { place_id: placeId, flow: "bill", ...payload, request_id: requestId(), ...(tab.current ? { tab_id: tab.current } : {}) });
      }}
    />
  );
}

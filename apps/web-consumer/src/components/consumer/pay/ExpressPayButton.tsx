"use client";

// EXPRESS PAY (MESITA-4384): Apple Pay / Google Pay through Stripe's Express
// Checkout Element in deferred mode. Shared, not voucher-named: the caller
// gives three calls, so Pay Bill can reuse it unchanged later.
//
//   setup()  — what to draw (amount, account, wallets) or why not;
//   open()   — the server opens ONE PaymentIntent with no payment method and
//              answers its client secret (or, on a replay, that it is done);
//   settle() — the same purchase again after the browser confirmed it.
//
// On the element's confirm: elements.submit() → open() → confirmPayment
// (redirect only if required) → settle(). From confirm until it ends the
// caller is told to lock (onLock), with a hard unlock at 20 s. "Payment
// received" is said ONLY when Stripe confirmed (succeeded/processing) and
// settle() then timed out, failed on the network or answered 5xx: the
// receiver and the cron settle it. The Apple / Google button keeps Stripe's
// look (their brand rules forbid restyling): black, "Buy", 48 px.

import { useEffect, useRef } from "react";

export type ExpressWallet = "apple_pay" | "google_pay";

export type ExpressPaySetup =
  | {
    available: true;
    wallets: ExpressWallet[];
    publishable_key: string;
    stripe_account: string;
    amount_cents: number;
    currency: string;
    label: string;
  }
  | { available: false; code: string };

/** open(): the client secret to confirm, or a purchase already settled. */
export type ExpressPayOpen =
  | { kind: "confirm"; client_secret: string; amount_cents: number }
  | { kind: "done"; outcome: "paid" | "processing"; payWith: ExpressWallet | null };

/** settle(): how it ended. A thrown error is an unknown outcome. */
export type ExpressPaySettle =
  | { kind: "done"; outcome: "paid" | "processing"; payWith: ExpressWallet | null }
  | { kind: "refused"; text: string };

export type ExpressPayDone = { outcome: "paid" | "processing" | "received"; payWith: ExpressWallet | null };

/** A refusal open() or settle() carries to the guest. */
export class ExpressPayRefusal extends Error {
  constructor(readonly text: string, readonly code: string) {
    super(text);
  }
}

const BUDGET_MS = 20_000;
/** MESITA-4406: no `ready` from Stripe by then (a web view with neither
 *  wallet, a blocked frame) and the slot collapses: never a grey box. */
const READY_MS = 6_000;
const DECLINED = "Your bank declined it. Try another way to pay.";
const COULD_NOT_START = "Couldn't start the payment. Try again.";

export function ExpressPayButton({
  setup,
  open,
  settle,
  disabled = false,
  hold = false,
  onState,
  onLock,
  onDone,
  onError,
  onEvent,
}: {
  setup: () => Promise<ExpressPaySetup>;
  open: () => Promise<ExpressPayOpen>;
  settle: () => Promise<ExpressPaySettle>;
  /** The card path is paying: the button does nothing. */
  disabled?: boolean;
  /** MESITA-4386: a manual-capture hold (Pay Bill): Face ID authorizes, the
   *  waiter's code captures; requires_capture counts as confirmed. */
  hold?: boolean;
  /** loading (the 48 px skeleton), ready, or none (collapse the slot). */
  onState: (state: "loading" | "ready" | "none") => void;
  onLock: (locked: boolean) => void;
  onDone: (done: ExpressPayDone) => void;
  /** The pay box's error line; null clears it. */
  onError: (text: string | null) => void;
  onEvent?: (name: "express_ready" | "express_failed", payload: Record<string, unknown>) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  // The latest callbacks, read inside Stripe's handlers.
  const live = useRef({ open, settle, disabled, onState, onLock, onDone, onError, onEvent });
  useEffect(() => {
    live.current = { open, settle, disabled, onState, onLock, onDone, onError, onEvent };
  });
  const setupOnce = useRef(setup);
  const holdOnce = useRef(hold);

  useEffect(() => {
    let gone = false;
    let destroy: (() => void) | null = null;
    const say = (s: "loading" | "ready" | "none") => {
      if (!gone) live.current.onState(s);
    };
    void (async () => {
      let cfg: ExpressPaySetup;
      try {
        cfg = await setupOnce.current();
      } catch {
        say("none");
        live.current.onEvent?.("express_failed", { method: "unknown", code: "setup_failed" });
        return;
      }
      if (gone) return;
      if (!cfg.available) {
        say("none");
        live.current.onEvent?.("express_failed", { method: "unknown", code: cfg.code });
        return;
      }
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripe = await loadStripe(cfg.publishable_key, { stripeAccount: cfg.stripe_account }).catch(() => null);
      if (gone) return;
      if (!stripe || !mount.current) {
        say("none");
        live.current.onEvent?.("express_failed", { method: "unknown", code: "stripe_unavailable" });
        return;
      }
      let amount = cfg.amount_cents;
      const elements = stripe.elements({ mode: "payment", amount, currency: cfg.currency, allowedPaymentMethodTypes: ["card"], locale: "en", ...(holdOnce.current ? { captureMethod: "manual" as const } : {}) });
      const wants = (w: ExpressWallet) => (cfg.wallets.includes(w) ? "auto" : "never") as "auto" | "never";
      const element = elements.create("expressCheckout", {
        paymentMethods: { applePay: wants("apple_pay"), googlePay: wants("google_pay"), link: "never", amazonPay: "never", paypal: "never", klarna: "never" },
        buttonType: { applePay: "buy", googlePay: "buy" },
        buttonTheme: { applePay: "black", googlePay: "black" },
        buttonHeight: 48,
        layout: { maxColumns: 1, maxRows: 1, overflow: "never" },
      });
      let settledSlot = false;
      const quiet = window.setTimeout(() => {
        if (settledSlot) return;
        settledSlot = true;
        say("none");
        live.current.onEvent?.("express_failed", { method: "unknown", code: "ready_timeout" });
      }, READY_MS);
      destroy = () => {
        window.clearTimeout(quiet);
        element.destroy();
      };

      element.on("loaderror", () => {
        if (settledSlot) return;
        settledSlot = true;
        window.clearTimeout(quiet);
        say("none");
        live.current.onEvent?.("express_failed", { method: "unknown", code: "load_error" });
      });
      element.on("ready", (e) => {
        if (settledSlot) return;
        settledSlot = true;
        window.clearTimeout(quiet);
        const avail = e.availablePaymentMethods;
        const list: ExpressWallet[] = [];
        if (avail?.applePay && cfg.wallets.includes("apple_pay")) list.push("apple_pay");
        if (avail?.googlePay && cfg.wallets.includes("google_pay")) list.push("google_pay");
        live.current.onEvent?.("express_ready", { available: list });
        say(list.length > 0 ? "ready" : "none");
      });
      element.on("click", (e) => {
        if (live.current.disabled) {
          e.reject();
          return;
        }
        live.current.onError(null);
        e.resolve({ lineItems: [{ name: cfg.label, amount }] });
      });
      element.on("cancel", () => {
        live.current.onLock(false);
      });
      element.on("confirm", async (ev) => {
        const method: ExpressWallet | "unknown" = ev.expressPaymentType === "apple_pay" || ev.expressPaymentType === "google_pay"
          ? ev.expressPaymentType
          : "unknown";
        const fail = (code: string, text: string | null, extra: Record<string, unknown> = {}) => {
          live.current.onEvent?.("express_failed", { method, code, ...extra });
          if (text) live.current.onError(text);
        };
        const started = Date.now();
        live.current.onLock(true);
        // A hard unlock: whatever hangs, the sheet is the guest's again.
        const hard = window.setTimeout(() => live.current.onLock(false), BUDGET_MS);
        try {
          const submitted = await elements.submit();
          if (submitted.error) {
            ev.paymentFailed({ reason: "fail" });
            fail("submit_failed", submitted.error.message ?? COULD_NOT_START);
            return;
          }
          let opened: ExpressPayOpen;
          try {
            opened = await live.current.open();
          } catch (err) {
            ev.paymentFailed({ reason: "fail" });
            const refusal = err instanceof ExpressPayRefusal ? err : null;
            fail(refusal?.code ?? "open_failed", refusal?.text ?? COULD_NOT_START);
            return;
          }
          if (opened.kind === "done") {
            live.current.onDone({ outcome: opened.outcome, payWith: opened.payWith ?? (method === "unknown" ? null : method) });
            return;
          }
          if (opened.amount_cents !== amount) {
            // The price moved between setup and the tap: the element follows
            // the server's amount once.
            amount = opened.amount_cents;
            elements.update({ amount });
          }
          const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            clientSecret: opened.client_secret,
            redirect: "if_required",
            confirmParams: { return_url: window.location.href },
          });
          if (error) {
            ev.paymentFailed({ reason: "fail" });
            fail(error.code ?? error.type ?? "confirm_failed", error.type === "card_error" ? DECLINED : (error.message ?? COULD_NOT_START));
            return;
          }
          const status = paymentIntent?.status;
          if (status !== "succeeded" && status !== "processing" && !(holdOnce.current && status === "requires_capture")) {
            fail(`pi_${status ?? "unknown"}`, DECLINED);
            return;
          }
          // Stripe took the money: settle within what is left of the budget.
          const left = Math.max(1_000, BUDGET_MS - (Date.now() - started) - 500);
          let settled: ExpressPaySettle | "unknown";
          try {
            settled = await Promise.race([
              live.current.settle(),
              new Promise<"unknown">((resolve) => window.setTimeout(() => resolve("unknown"), left)),
            ]);
          } catch (err) {
            settled = err instanceof ExpressPayRefusal ? { kind: "refused", text: err.text } : "unknown";
          }
          if (settled === "unknown") {
            live.current.onDone({ outcome: "received", payWith: method === "unknown" ? null : method });
          } else if (settled.kind === "refused") {
            fail("settle_refused", settled.text);
          } else {
            live.current.onDone({ outcome: settled.outcome, payWith: settled.payWith ?? (method === "unknown" ? null : method) });
          }
        } finally {
          window.clearTimeout(hard);
          live.current.onLock(false);
        }
      });
      element.mount(mount.current);
    })();
    return () => {
      gone = true;
      destroy?.();
    };
  }, []);

  return <div ref={mount} className="min-h-12 w-full" data-express-pay="" aria-disabled={disabled || undefined} />;
}

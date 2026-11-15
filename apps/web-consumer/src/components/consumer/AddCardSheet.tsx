"use client";

import { useEffect, useRef, useState } from "react";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiListCards, apiStartCardSetup, CARD_REFUSAL } from "@/lib/api/cards";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";

// ADD A CARD INSIDE THE APP (MESITA-4065, Pato: "there should not really be
// stripe checkout … yes but only as api … you need to first add the card").
// One sheet, used by the Offers page, the Wallet and the Pay flow: the server
// opens a SetupIntent on the guest's platform customer, Stripe's Payment
// Element (cards only, in Stripe's iframe: Mesita never sees the number)
// takes the card, and confirmSetup runs the bank check inline. Nothing is
// charged. On success the caller gets the new card's id and selects it.
//
// States: loading (skeleton, Save off) · setup failed (the server's line +
// Retry) · typing · saving (locked, cannot be swiped away) · Stripe's own
// inline error (declined, invalid, bank check cancelled: the sheet stays).
// An unknown outcome (the connection dropped while saving) lists the cards
// again before offering Retry: a card that landed is treated as saved.

/** Stripe's purple, the one pay accent (MESITA-4065). */
export const PAY_ACCENT = "#635BFF";

type Phase =
  | { kind: "loading" }
  | { kind: "failed"; line: string }
  | { kind: "ready" }
  | { kind: "saving" };

function refusalLine(err: unknown): string {
  const code = err instanceof EFError ? err.code : null;
  return (code && CARD_REFUSAL[code]) || CARD_REFUSAL.setup_failed;
}

export function AddCardSheet({
  open,
  onClose,
  onSaved,
  knownCardIds,
}: {
  open: boolean;
  onClose: () => void;
  /** The new card's payment method id. */
  onSaved: (paymentMethodId: string) => void;
  /** The cards on screen before the sheet opened: an unknown outcome is
   *  resolved by listing them again and looking for a new one. */
  knownCardIds: readonly string[];
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<{ stripe: Stripe; elements: StripeElements } | null>(null);
  const known = useRef(knownCardIds);
  useEffect(() => {
    known.current = knownCardIds;
  });

  // Open: one SetupIntent, Stripe.js, the Payment Element. State is set in
  // the promise callbacks only (Next 16 lint).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let unmount: (() => void) | null = null;
    void (async () => {
      try {
        const setup = await apiStartCardSetup(getSupabase());
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(setup.publishable_key);
        if (!stripe) throw new Error("stripe_js");
        if (cancelled) return;
        const elements = stripe.elements({
          clientSecret: setup.client_secret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#111111",
              colorText: "#111111",
              borderRadius: "12px",
              fontFamily: "Inter, system-ui, sans-serif",
            },
          },
        });
        const element = elements.create("payment", { layout: "tabs" });
        if (!mountRef.current) return;
        element.mount(mountRef.current);
        element.on("change", () => setInlineError(null));
        unmount = () => element.destroy();
        stripeRef.current = { stripe, elements };
        setPhase({ kind: "ready" });
      } catch (err) {
        if (!cancelled) setPhase({ kind: "failed", line: err instanceof EFError ? refusalLine(err) : "Couldn't load the card form. Try again." });
      }
    })();
    return () => {
      cancelled = true;
      unmount?.();
      stripeRef.current = null;
    };
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt]);

  const retry = () => {
    setPhase({ kind: "loading" });
    setInlineError(null);
    setAttempt((n) => n + 1);
  };

  const close = () => {
    setPhase({ kind: "loading" });
    setInlineError(null);
    onClose();
  };

  const save = async () => {
    const s = stripeRef.current;
    if (!s || phase.kind !== "ready") return;
    setPhase({ kind: "saving" });
    setInlineError(null);
    try {
      const res = await s.stripe.confirmSetup({ elements: s.elements, redirect: "if_required" });
      if (res.error) {
        // Stripe's own words: declined, invalid, the bank check cancelled.
        setInlineError(
          res.error.type === "card_error" || res.error.type === "validation_error"
            ? res.error.message ?? "Check the card details."
            : "Your bank didn't confirm this card.",
        );
        setPhase({ kind: "ready" });
        return;
      }
      const pm = res.setupIntent?.payment_method;
      const id = typeof pm === "string" ? pm : pm?.id ?? null;
      if (!id) throw new Error("no_payment_method");
      setPhase({ kind: "loading" });
      onSaved(id);
    } catch {
      // Unknown outcome: the card may have landed. Look before asking again.
      try {
        const { cards } = await apiListCards(getSupabase());
        const fresh = cards.find((c) => !known.current.includes(c.id));
        if (fresh) {
          setPhase({ kind: "loading" });
          onSaved(fresh.id);
          return;
        }
      } catch {
        // fall through to the retry line
      }
      setInlineError("Couldn't save the card. Try again.");
      setPhase({ kind: "ready" });
    }
  };

  const saving = phase.kind === "saving";
  return (
    <LocalSheet open={open} onClose={saving ? () => {} : close} ariaLabel="Add a card">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-5 pb-6">
        <h2 className="text-foreground text-lg font-semibold">Add a card</h2>
        <p className="text-muted-foreground mt-1 text-sm">Your card is kept by Stripe. Mesita never sees the number.</p>
        <div className="mt-5 min-h-[180px]" aria-busy={phase.kind === "loading"}>
          {phase.kind === "loading" ? (
            <div className="flex flex-col gap-3" aria-hidden>
              <div className="bg-muted h-12 w-full animate-pulse rounded-xl" />
              <div className="flex gap-3">
                <div className="bg-muted h-12 flex-1 animate-pulse rounded-xl" />
                <div className="bg-muted h-12 flex-1 animate-pulse rounded-xl" />
              </div>
            </div>
          ) : null}
          {phase.kind === "failed" ? (
            <div className="flex flex-col items-start gap-3" role="alert">
              <p className="text-foreground text-sm">{phase.line}</p>
              <button type="button" onClick={retry} className="border-border hover:bg-muted h-11 rounded-xl border px-4 text-sm font-semibold">
                Retry
              </button>
            </div>
          ) : null}
          <div ref={mountRef} className={phase.kind === "ready" || phase.kind === "saving" ? "" : "hidden"} />
        </div>
        {inlineError ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {inlineError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void save()}
          disabled={phase.kind !== "ready"}
          className="bg-[var(--pay-accent)] disabled:bg-muted disabled:text-muted-foreground mt-6 flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition hover:opacity-90"
          style={{ ["--pay-accent" as string]: PAY_ACCENT }}
        >
          {saving ? "Saving…" : "Save card"}
        </button>
        <p className="text-muted-foreground mt-3 text-center text-xs">
          Mesita saves this card for your future purchases. Remove it any time in Wallet.
        </p>
      </div>
    </LocalSheet>
  );
}

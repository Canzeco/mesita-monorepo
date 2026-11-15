"use client";

import { useEffect, useRef, useState } from "react";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiListCards, apiStartCardSetup, CARD_REFUSAL } from "@/lib/api/cards";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

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
//
// TWO FRAMES, ONE FORM (MESITA-4092, Pato: "ADD CARD MUST HAVE ITS OWN
// SUBPAGE ... OWN SUBPAGES IS CLEANER"): useAddCard is the form's whole
// behaviour, AddCardFields and SaveCardButton its parts. Wallet's Add a card
// pushes /wallet/cards/new (AddCardPage); this sheet stays only for the
// callers in the middle of a purchase (the Offers page's Buy, Pay's Method
// step, the member tab view), whose unsaved state a push would drop.

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

type AddCard = {
  phase: Phase;
  inlineError: string | null;
  mountRef: React.RefObject<HTMLDivElement | null>;
  retry: () => void;
  reset: () => void;
  save: () => Promise<void>;
};

/** The form's behaviour while `active`: one SetupIntent, Stripe.js, the
 *  Payment Element mounted in `mountRef`, and Save. `knownCardIds` absent
 *  (the page): the cards are listed first, so an unknown outcome can still
 *  find the new one. */
export function useAddCard({
  active,
  onSaved,
  knownCardIds,
}: {
  active: boolean;
  onSaved: (paymentMethodId: string) => void;
  knownCardIds?: readonly string[];
}): AddCard {
  const getSupabase = useLazyBrowserSupabase();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<{ stripe: Stripe; elements: StripeElements } | null>(null);
  const known = useRef<readonly string[]>(knownCardIds ?? []);
  const listFirst = knownCardIds === undefined;
  useEffect(() => {
    if (knownCardIds) known.current = knownCardIds;
  });

  // Open: one SetupIntent, Stripe.js, the Payment Element. State is set in
  // the promise callbacks only (Next 16 lint).
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let unmount: (() => void) | null = null;
    void (async () => {
      try {
        if (listFirst) {
          known.current = await apiListCards(getSupabase())
            .then((r) => r.cards.map((c) => c.id))
            .catch(() => []);
        }
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
  }, [active, attempt]);

  const retry = () => {
    setPhase({ kind: "loading" });
    setInlineError(null);
    setAttempt((n) => n + 1);
  };

  const reset = () => {
    setPhase({ kind: "loading" });
    setInlineError(null);
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

  return { phase, inlineError, mountRef, retry, reset, save };
}

/** The form's body: the bones while it loads, the server's line and Retry,
 *  Stripe's iframe, Stripe's inline error. */
export function AddCardFields({ form }: { form: AddCard }) {
  const { phase, inlineError, mountRef, retry } = form;
  return (
    <>
      <div className="min-h-[180px]" aria-busy={phase.kind === "loading"}>
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
    </>
  );
}

/** Save card, in Stripe's purple. */
export function SaveCardButton({ form, className }: { form: AddCard; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => void form.save()}
      disabled={form.phase.kind !== "ready"}
      className={cn(
        "bg-[var(--pay-accent)] disabled:bg-muted disabled:text-muted-foreground flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition hover:opacity-90",
        className,
      )}
      style={{ ["--pay-accent" as string]: PAY_ACCENT }}
    >
      {form.phase.kind === "saving" ? "Saving…" : "Save card"}
    </button>
  );
}

export const CARD_KEPT_LINE = "Your card is kept by Stripe. Mesita never sees the number.";
export const CARD_SAVED_LINE = "Mesita saves this card for your future purchases. Remove it any time in Wallet.";

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
  const form = useAddCard({ active: open, onSaved, knownCardIds });
  const close = () => {
    form.reset();
    onClose();
  };
  const saving = form.phase.kind === "saving";
  return (
    <LocalSheet open={open} onClose={saving ? () => {} : close} ariaLabel="Add a card">
      <div className="scrollbar-thin-dark flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-5 pb-6">
        <h2 className="text-foreground text-lg font-semibold">Add a card</h2>
        <p className="text-muted-foreground mt-1 text-sm">{CARD_KEPT_LINE}</p>
        <div className="mt-5">
          <AddCardFields form={form} />
        </div>
        <SaveCardButton form={form} className="mt-6" />
        <p className="text-muted-foreground mt-3 text-center text-xs">{CARD_SAVED_LINE}</p>
      </div>
    </LocalSheet>
  );
}

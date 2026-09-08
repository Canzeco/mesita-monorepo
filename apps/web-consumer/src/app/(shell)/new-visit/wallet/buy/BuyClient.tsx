"use client";

import { useEffect, useState } from "react";
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
import { CONTROLS_FALLBACK, type ControlsPolicy } from "@/lib/credits";
import { apiGetControlsPolicy } from "@/lib/api/controls-config";
import {
  apiBuyCredits,
  apiListCreditPlaces,
  type CreditPurchasePlace,
} from "@/lib/api/credits";
import { confirmCardAction } from "@/lib/stripe/confirm-card-action";
import { EFError } from "@/lib/api/_invoke";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Buy Credits — the real path (MESITA-1676). Was a browser emulator
// (src/lib/mock/use-credits.ts) until now; this screen is the first one
// wired to consumer-web-buy-credits, which charges the guest's saved card
// direct on the target place's organization.
//
// EVERY MONEY TERM IS THE SERVER'S. bonusCents/activatesAt/expiresAt below
// are DISPLAY ONLY — the server resolves them from controls_config and pins
// them the moment the charge confirms; nothing computed here is sent back.
//
// CREDITS ACTIVATE IMMEDIATELY (Pato, 2026-09-08) — a decision made AFTER
// this issue was written, evidenced independently in credits-mock.ts and
// use-credits.ts ("Both [the hold and its demo clock] are gone... Credits
// are active the moment they are bought"). This screen never disclosed a
// hold before today and still does not: `defaultHoldHours` keeps riding
// controls_config for when the term returns, but neither this UI nor
// consumer-web-buy-credits' activates_at applies it right now.
//
// FOR GIFT ROUTES OUT, IT DOES NOT CHARGE. Gifting (MESITA-1677) is a
// separate purchase with its own picker (GiftClient, already real UI, still
// mock-backed) — this toggle is the entry point the issue asks for, not a
// second code path into this screen's own charge call.
export function BuyClient() {
  const supabase = useBrowserSupabase();
  const router = useRouter();

  const [policy, setPolicy] = useState<ControlsPolicy>(CONTROLS_FALLBACK);
  const [places, setPlaces] = useState<CreditPurchasePlace[] | null>(null);
  const [placesError, setPlacesError] = useState(false);

  const [target, setTarget] = useState<"me" | "gift">("me");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [paidCents, setPaidCents] = useState<number>(AMOUNTS[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const resolved = await apiGetControlsPolicy(supabase);
        if (alive) setPolicy(resolved);
      } catch {
        if (alive) setPolicy(CONTROLS_FALLBACK);
      }
      try {
        const list = await apiListCreditPlaces(supabase);
        if (alive) setPlaces(list);
      } catch {
        if (alive) {
          setPlaces([]);
          setPlacesError(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  // Every real place inherits the console default — no per-place override
  // exists in the schema yet — so PlacePicker reads policy.defaultBonusPct/
  // defaultExpiryDays uniformly rather than a rate the place itself set.
  const pickerPlaces = places ?? [];
  const place = placeId ? pickerPlaces.find((p) => p.id === placeId) ?? null : null;
  const bonus = Math.round((paidCents * policy.defaultBonusPct) / 100);

  // Stable across a retry of the SAME pick (a dropped connection, a
  // double-tap), fresh the moment the guest picks a different place or
  // amount — that is a new purchase attempt, not a retry of the old one.
  // This is half of the server's Stripe idempotency key
  // (consumer-web-buy-credits), so it must not be re-minted on every render.
  // "Adjusting state during render" (React's own pattern for resetting state
  // when an input changes) rather than an effect: setting state synchronously
  // inside an effect body causes an extra cascading render for no reason.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const pickKey = `${placeId ?? ""}:${paidCents}`;
  const [lastPickKey, setLastPickKey] = useState(pickKey);
  if (pickKey !== lastPickKey) {
    setLastPickKey(pickKey);
    setRequestId(crypto.randomUUID());
  }

  async function submit() {
    if (target === "gift") {
      router.push(CONSUMER_ROUTES.newVisit.walletGift);
      return;
    }
    if (!place) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await apiBuyCredits(supabase, {
        placeId: place.id,
        paidCents,
        requestId,
      });
      if (outcome.state === "requires_action") {
        await confirmCardAction(outcome.requiresAction);
      }
      // replace(), not push(): a finished (or submitted) purchase is not a
      // page the back gesture should return into.
      router.replace(CONSUMER_ROUTES.newVisit.wallet);
    } catch (err) {
      setError(err instanceof EFError ? err.message : "Couldn't complete that purchase.");
    } finally {
      setBusy(false);
    }
  }

  const noPlacesYet = places !== null && places.length === 0;

  return (
    <WalletScreen
      title="Buy Credits"
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-destructive text-center text-xs">
              {error}
            </p>
          )}
          <Button
            onClick={submit}
            disabled={target === "me" && (!place || busy || noPlacesYet)}
            className="w-full"
          >
            {busy
              ? "Working…"
              : target === "gift"
                ? "Continue to Gift"
                : place
                  ? `Pay ${formatCurrency(paidCents)}`
                  : "Pick a place"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* For Me | For Gift (MESITA-1676: the toggle/entry point only — the
            full Gift flow is MESITA-1677 and already has its own screen). */}
        <div className="bg-muted/40 flex rounded-2xl p-1">
          {(["me", "gift"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTarget(t)}
              aria-pressed={target === t}
              className={
                "flex-1 rounded-xl py-2 text-sm font-bold transition " +
                (target === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground")
              }
            >
              {t === "me" ? "For Me" : "For Gift"}
            </button>
          ))}
        </div>

        {target === "gift" ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Gifting buys a balance for someone else — they get a code to
            claim it, and nothing leaves a balance you already hold.
            Continue to pick where and how much.
          </p>
        ) : (
          <>
            <PlacePicker
              policy={policy}
              placeId={placeId}
              onSelect={setPlaceId}
              places={pickerPlaces}
            />
            {noPlacesYet && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {placesError
                  ? "Couldn't load places right now — try again shortly."
                  : "No places accept Mesita Credits yet."}
              </p>
            )}

            <AmountPicker value={paidCents} onChange={setPaidCents} />

            {place && (
              <TermsPreview
                eyebrow="You would get"
                totalCents={paidCents + bonus}
                detail={
                  <>
                    {formatCurrency(paidCents)} paid, +{formatCurrency(bonus)}{" "}
                    from {place.name} · spendable straight away · expires{" "}
                    {policy.defaultExpiryDays} days after today
                  </>
                }
              />
            )}
          </>
        )}

        <WalletParkedNote>
          Runs in Stripe TEST mode — no real money moves.
        </WalletParkedNote>
      </div>
    </WalletScreen>
  );
}

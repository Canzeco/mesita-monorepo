"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
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
import {
  CONTROLS_FALLBACK,
  type ControlsPolicy,
  type CreditPlace,
} from "@/lib/mock/credits-mock";
import { apiGetControlsPolicy } from "@/lib/api/controls-config";
import {
  apiCancelGift,
  apiGiftCredits,
  apiListCreditPlaces,
  apiListSentGifts,
  type CreditPurchasePlace,
  type SentGift,
} from "@/lib/api/credits";
import { confirmCardAction } from "@/lib/stripe/confirm-card-action";
import { EFError } from "@/lib/api/_invoke";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Gift Credits — the real path (MESITA-1677). Was fully mock-backed
// (src/lib/mock/use-credits.ts) until now; this screen is wired to
// consumer-web-gift-credits (the charge) and consumer-web-list-credit-gifts
// + consumer-web-cancel-credit-gift (the "Gifts you sent" list below).
//
// ISSUANCE, NOT TRANSFER (MESITA-1677, restating MESITA-1380). Buying a gift
// charges the SENDER's own card, exactly like Buy — nothing leaves a balance
// the sender already holds. The server never lets the client send a bonus,
// an expiry, or the code's own hash; every term below is DISPLAY, echoed
// back from what consumer-web-gift-credits already decided and wrote.
//
// TWO STATES ON ONE ROUTE: the form, then the code. The code is not a
// separate page because it has no id in the URL to be addressed by — the
// gift IS the code, and putting a live gift code in a path would print it
// into history, referrers and any screenshot of the address bar.
//
// THE CODE IS SHOWN EXACTLY ONCE — this screen is the only place it is ever
// in plaintext. It is never re-fetchable: the server only ever stores its
// hash (consumer-web-gift-credits' own header). "Gifts you sent" below shows
// every gift's STATUS, never its code.
//
// "GIFTS YOU SENT" LIVES HERE, NOT ON A SEPARATE "ORG SHEET." The issue text
// describes an org-specific sheet with its own Gift button and its own sent-
// gifts list; no such component exists anywhere in this codebase yet for
// Credits (checked directly — PlaceActionBar's Credits slot is locked
// pending the spend engine, MESITA-1678, a different capability; the
// balance detail page is still emulator-only, MESITA-1674). Building a new
// org-scoped surface was out of scope next to the money-path work the issue
// itself calls "the hard part" (schema, landing page, redeem, cancel-
// refund), so the sent-gifts list ships on the ONE screen that already is
// the Gift flow's home — same component, same state machine the issue asks
// for, just not a second surface. Flagged as a judgment call in the PR.
//
// NO SHARE SHEET, NO SEND. Copy is the whole handoff: sending would mean a
// public landing route for a stranger with no account, which now exists
// (/gift/[code]) but is reached by the RECIPIENT pasting/opening the code,
// not by this screen composing a message on the sender's behalf.

function GiftResult({
  code,
  placeName,
  paidCents,
  bonusCents,
  expiryDays,
  note,
  onDone,
}: {
  code: string;
  placeName: string;
  paidCents: number;
  bonusCents: number;
  expiryDays: number;
  note: string | null;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-card rounded-2xl border p-5 text-center">
        <div className="type-eyebrow text-muted-foreground">Credits at</div>
        <div className="font-display mt-1 text-2xl font-semibold tracking-tight">
          {placeName}
        </div>
        <div className="mt-3 text-4xl font-bold tracking-tight tabular-nums">
          {formatCurrency(paidCents + bonusCents)}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          {formatCurrency(paidCents)} paid, +{formatCurrency(bonusCents)} from{" "}
          {placeName} · {expiryDays} days to spend, counted from the day it is
          claimed
        </div>
      </div>

      <div>
        <div className="type-eyebrow text-muted-foreground mb-2">
          Their code
        </div>
        <div className="border-border bg-muted/30 rounded-2xl border px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.2em] tabular-nums">
          {code}
        </div>
        <button
          type="button"
          onClick={copy}
          className="bg-muted hover:bg-muted/70 mt-2 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition active:scale-[0.98]"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copied" : "Copy code"}
        </button>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Whoever has these ten digits can claim the Credits, once. Send it
          the way you would send a gift card number — this is the only time
          it will be shown.
        </p>
      </div>

      {note ? (
        <div>
          <div className="type-eyebrow text-muted-foreground mb-2">
            Your note
          </div>
          <p className="border-border bg-card rounded-2xl border p-4 text-sm">
            {note}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onDone}
        className="bg-muted hover:bg-muted/70 min-h-12 w-full rounded-2xl text-sm font-bold transition active:scale-[0.98]"
      >
        Gift another
      </button>

      <WalletParkedNote>
        Runs in Stripe TEST mode — no real money moves.
      </WalletParkedNote>
    </div>
  );
}

const STATE_LABEL: Record<SentGift["state"], string> = {
  unclaimed: "Not claimed yet",
  claimed: "Claimed",
  cancelled: "Cancelled",
};

function SentGiftRow({
  gift,
  nowMs,
  onCancel,
  cancelling,
}: {
  gift: SentGift;
  /** Read once, in the parent — not `Date.now()` here, which would be an
   *  impure call during render (react-hooks/purity). */
  nowMs: number;
  onCancel: (id: string) => void;
  cancelling: boolean;
}) {
  const expired =
    gift.state === "unclaimed" && new Date(gift.expiresAt).getTime() < nowMs;
  return (
    <li className="border-border bg-card flex items-center justify-between gap-3 rounded-2xl border p-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold tracking-tight">
          {gift.organizationName}
        </span>
        <span className="text-muted-foreground block text-xs">
          {expired ? "Expired, unclaimed" : STATE_LABEL[gift.state]}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(gift.paidCents + gift.bonusCents)}
        </span>
        {gift.state === "unclaimed" && !expired ? (
          <button
            type="button"
            onClick={() => onCancel(gift.id)}
            disabled={cancelling}
            className="text-destructive hover:bg-destructive/10 rounded-full px-2 py-1 text-xs font-bold transition disabled:opacity-50"
          >
            {cancelling ? "…" : "Cancel"}
          </button>
        ) : null}
      </span>
    </li>
  );
}

export function GiftClient() {
  const supabase = useBrowserSupabase();
  // Read once on mount — this list re-renders often enough (every fetch,
  // every cancel) that a fresh Date.now() per render would be both impure
  // during render and pointless precision for an "expired" label.
  const [nowMs] = useState(() => Date.now());

  const [policy, setPolicy] = useState<ControlsPolicy>(CONTROLS_FALLBACK);
  const [places, setPlaces] = useState<CreditPurchasePlace[] | null>(null);
  const [placesError, setPlacesError] = useState(false);
  const [sentGifts, setSentGifts] = useState<SentGift[] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [placeId, setPlaceId] = useState<string | null>(null);
  const [paidCents, setPaidCents] = useState<number>(AMOUNTS[1]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{
    code: string;
    placeName: string;
    paidCents: number;
    bonusCents: number;
    expiryDays: number;
    note: string | null;
  } | null>(null);

  async function refreshSentGifts() {
    try {
      setSentGifts(await apiListSentGifts(supabase));
    } catch {
      // Non-fatal — the form itself still works without the list.
      setSentGifts((prev) => prev ?? []);
    }
  }

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
      try {
        const gifts = await apiListSentGifts(supabase);
        if (alive) setSentGifts(gifts);
      } catch {
        // Non-fatal — the form itself still works without the list.
        if (alive) setSentGifts((prev) => prev ?? []);
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const pickerPlaces: CreditPlace[] = useMemo(
    () =>
      (places ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        bonusPct: null,
        expiryDays: null,
        photoUrl: null,
      })),
    [places],
  );
  const place = placeId ? pickerPlaces.find((p) => p.id === placeId) ?? null : null;
  const bonus = Math.round((paidCents * policy.defaultBonusPct) / 100);

  // Same "adjust state during render" idempotency-key pattern as BuyClient —
  // stable across a retry of the SAME pick, fresh the moment the pick
  // itself changes.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const pickKey = `${placeId ?? ""}:${paidCents}:${note}`;
  const [lastPickKey, setLastPickKey] = useState(pickKey);
  if (pickKey !== lastPickKey) {
    setLastPickKey(pickKey);
    setRequestId(crypto.randomUUID());
  }

  const outstanding = (sentGifts ?? []).filter((g) => g.state === "unclaimed");

  async function submit() {
    if (!place) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await apiGiftCredits(supabase, {
        placeId: place.id,
        paidCents,
        note: note.trim() || null,
        requestId,
      });
      if (outcome.state === "requires_action") {
        await confirmCardAction(outcome.requiresAction);
        // The confirm above finishes the SAME charge; the code itself only
        // exists once this request's own response carries it, and a 3DS
        // challenge means this attempt cannot show one — the gift still
        // lands (webhook backstop), but the sender must open it from "Gifts
        // you sent" rather than reading a code here. Refresh the list and
        // stop, rather than pretending a code exists.
        await refreshSentGifts();
        setError(
          "Your bank verified the card — the gift is on its way. Find it in \"Not claimed yet\" below shortly.",
        );
        return;
      }
      setIssued({
        code: outcome.code,
        placeName: place.name,
        paidCents,
        bonusCents: outcome.bonusCents,
        expiryDays: outcome.expiryDays,
        note: note.trim() || null,
      });
      void refreshSentGifts();
    } catch (err) {
      setError(err instanceof EFError ? err.message : "Couldn't send that gift.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(giftId: string) {
    setCancellingId(giftId);
    try {
      await apiCancelGift(supabase, giftId);
      await refreshSentGifts();
    } catch (err) {
      setError(err instanceof EFError ? err.message : "Couldn't cancel that gift.");
    } finally {
      setCancellingId(null);
    }
  }

  function reset() {
    setIssued(null);
    setPlaceId(null);
    setNote("");
    setError(null);
  }

  const noPlacesYet = places !== null && places.length === 0;

  if (issued) {
    return (
      <WalletScreen title="Gift sent">
        <GiftResult {...issued} onDone={reset} />
      </WalletScreen>
    );
  }

  return (
    <WalletScreen
      title="Gift Credits"
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-destructive text-center text-xs">
              {error}
            </p>
          )}
          <Button
            onClick={submit}
            disabled={!place || busy || noPlacesYet}
            className="w-full"
          >
            {busy
              ? "Working…"
              : place
                ? `Pay ${formatCurrency(paidCents)}`
                : "Pick a place"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-muted-foreground text-xs leading-relaxed">
          You buy the Credits; they get a ten-digit code to claim them.
          Nothing leaves the balances you already hold.
        </p>

        <PlacePicker
          policy={policy}
          placeId={placeId}
          onSelect={setPlaceId}
          places={pickerPlaces}
          label="Where they can spend it"
        />
        {noPlacesYet && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {placesError
              ? "Couldn't load places right now — try again shortly."
              : "No places accept Mesita Credits yet."}
          </p>
        )}

        <AmountPicker value={paidCents} onChange={setPaidCents} />

        <div>
          <label
            htmlFor="gift-note"
            className="type-eyebrow text-muted-foreground mb-2 block"
          >
            Note (optional)
          </label>
          <textarea
            id="gift-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={140}
            placeholder="Happy birthday"
            className="border-border bg-muted/30 placeholder:text-muted-foreground/70 w-full resize-none rounded-2xl border px-4 py-3 outline-none"
          />
        </div>

        {place && (
          <TermsPreview
            eyebrow="They would get"
            totalCents={paidCents + bonus}
            detail={
              <>
                {formatCurrency(paidCents)} paid, +{formatCurrency(bonus)}{" "}
                from {place.name} · spendable at {place.name} only · expires{" "}
                {policy.defaultExpiryDays} days after they claim it
              </>
            }
          />
        )}

        {outstanding.length > 0 && (
          <div>
            <div className="type-eyebrow text-muted-foreground mb-2">
              Gifts you sent — not claimed yet
            </div>
            <ul className="flex flex-col gap-2">
              {outstanding.map((g) => (
                <SentGiftRow
                  key={g.id}
                  gift={g}
                  nowMs={nowMs}
                  onCancel={cancel}
                  cancelling={cancellingId === g.id}
                />
              ))}
            </ul>
          </div>
        )}

        <WalletParkedNote>
          Runs in Stripe TEST mode — no real money moves. Codes work with{" "}
          <Link
            href={CONSUMER_ROUTES.newVisit.walletRedeem}
            className="underline"
          >
            Redeem
          </Link>{" "}
          or the link the recipient opens.
        </WalletParkedNote>
      </div>
    </WalletScreen>
  );
}

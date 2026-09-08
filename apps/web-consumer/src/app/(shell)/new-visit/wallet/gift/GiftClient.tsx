"use client";

import { useState } from "react";
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
  bonusFor,
  bonusPctFor,
  expiryDaysFor,
  placeById,
} from "@/lib/mock/credits-mock";
import type { CreditGift, Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Gift Credits.
//
// TWO STATES ON ONE ROUTE: the form, then the code. The code is not a separate
// page because it has no id in the URL to be addressed by — the gift IS the
// code, and putting a live gift code in a path would print it into history,
// referrers and any screenshot of the address bar. The outstanding list at the
// bottom of the form is how a guest gets back to a code they closed.
//
// THE PLACE IS SAID LOUDLY, twice (Pato, voice, 2026-09-08: "en Visualize Gift
// que salga clarísimo de qué organización son los créditos"). Credits are
// spendable at exactly one place and nowhere else, so a gift whose place is
// small print is a gift that gets handed to the wrong person. It leads the
// result card and it is repeated in the line the guest copies.
//
// NO SHARE SHEET, NO SEND. Copy is the whole handoff today: sending would mean
// a public landing route for a stranger with no account, which does not exist
// yet (see newVisit.walletRedeem). A Send button that only copies would be
// lying about where the code went.

function GiftResult({
  gift,
  onDone,
}: {
  gift: CreditGift;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // A local flag rather than a toast: the Toaster sits above everything and
  // vanishes, and the guest's eyes are on the code, not the top of the screen.
  async function copy() {
    try {
      await navigator.clipboard.writeText(gift.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Insecure context, denied permission, or no clipboard API. The code is
      // on screen in a selectable font — nothing is lost but the shortcut.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-card rounded-2xl border p-5 text-center">
        <div className="type-eyebrow text-muted-foreground">
          Credits at
        </div>
        {/* The place, at hero size. See the header note. */}
        <div className="font-display mt-1 text-2xl font-semibold tracking-tight">
          {gift.placeName}
        </div>
        <div className="mt-3 text-4xl font-bold tracking-tight tabular-nums">
          {formatCurrency(gift.creditedCents)}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          {formatCurrency(gift.paidCents)} paid, +{gift.bonusPct}% from{" "}
          {gift.placeName} · {gift.expiryDays} days to spend, counted from the
          day it is claimed
        </div>
      </div>

      <div>
        <div className="type-eyebrow text-muted-foreground mb-2">
          Their code
        </div>
        {/* Selectable on purpose — globals.css scopes `user-select: none` to
            controls precisely so a code like this can still be dragged over. */}
        <div className="border-border bg-muted/30 rounded-2xl border px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.2em] tabular-nums">
          {gift.code}
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
          Whoever has these ten digits can claim the Credits, once. Send it the
          way you would send a gift card number.
        </p>
      </div>

      {gift.note ? (
        <div>
          <div className="type-eyebrow text-muted-foreground mb-2">
            Your note
          </div>
          <p className="border-border bg-card rounded-2xl border p-4 text-sm">
            {gift.note}
          </p>
        </div>
      ) : null}

      {/* Not a <Button>: that primitive is the brand-gradient PRIMARY CTA and
          has exactly one variant on purpose. "Gift another" is a secondary
          action on a screen whose primary act is already done. */}
      <button
        type="button"
        onClick={onDone}
        className="bg-muted hover:bg-muted/70 min-h-12 w-full rounded-2xl text-sm font-bold transition active:scale-[0.98]"
      >
        Gift another
      </button>

      <WalletParkedNote>
        Emulated. No money moved and nothing was charged — the code works in
        this browser only, on Wallet › Redeem.
      </WalletParkedNote>
    </div>
  );
}

export function GiftClient({ seed }: { seed: Seed }) {
  const credits = useCredits(seed);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [paidCents, setPaidCents] = useState<number>(AMOUNTS[1]);
  const [note, setNote] = useState("");
  const [issued, setIssued] = useState<CreditGift | null>(null);

  const place = placeId ? (placeById(placeId) ?? null) : null;
  const bonus = place
    ? bonusFor(paidCents, bonusPctFor(place, credits.policy))
    : 0;
  // Unclaimed codes the guest has issued. The one thing standing between a
  // gift and a lost gift: the result view is the only other place a code
  // appears, and it closes.
  const outstanding = (credits.state?.gifts ?? []).filter(
    (g) => g.redeemedAtMs === null,
  );

  async function submit() {
    if (!place) return;
    const gift = await credits.gift(place.id, paidCents, note || null);
    if (gift) setIssued(gift);
  }

  function reset() {
    setIssued(null);
    setPlaceId(null);
    setNote("");
  }

  if (issued) {
    return (
      <WalletScreen title="Gift sent">
        <GiftResult gift={issued} onDone={reset} />
      </WalletScreen>
    );
  }

  return (
    <WalletScreen
      title="Gift Credits"
      footer={
        <div className="flex flex-col gap-2">
          {credits.error && (
            <p role="alert" className="text-destructive text-center text-xs">
              {errorMessage(credits.error)}
            </p>
          )}
          <Button
            onClick={submit}
            disabled={!place || credits.busy}
            className="w-full"
          >
            {credits.busy
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
          You buy the Credits; they get a ten-digit code to claim them. Nothing
          leaves the balances you already hold.
        </p>

        <PlacePicker
          policy={credits.policy}
          placeId={placeId}
          onSelect={setPlaceId}
          label="Where they can spend it"
        />

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
                {formatCurrency(paidCents)} paid, +{formatCurrency(bonus)} from{" "}
                {place.name} · spendable at {place.name} only · expires{" "}
                {expiryDaysFor(place, credits.policy)} days after they claim it
              </>
            }
          />
        )}

        {outstanding.length > 0 && (
          <div>
            <div className="type-eyebrow text-muted-foreground mb-2">
              Not claimed yet
            </div>
            <ul className="flex flex-col gap-2">
              {outstanding.map((g) => (
                <li
                  key={g.code}
                  className="border-border bg-card flex items-center justify-between gap-3 rounded-2xl border p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold tracking-tight">
                      {g.placeName}
                    </span>
                    <span className="text-muted-foreground block font-mono text-xs tracking-[0.15em] tabular-nums">
                      {g.code}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCurrency(g.creditedCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <WalletParkedNote>
          Emulated. No money moves and nothing is charged; the code works in
          this browser only, on{" "}
          <Link
            href={CONSUMER_ROUTES.newVisit.walletRedeem}
            className="underline"
          >
            Redeem
          </Link>
          .
        </WalletParkedNote>
      </div>
    </WalletScreen>
  );
}

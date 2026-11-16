"use client";

import { useState } from "react";
import { Banknote, ChevronLeft, CreditCard, QrCode } from "lucide-react";
import { CASH_GREEN } from "./WalletLists";
import { PANEL_CLASS, PanelHeading } from "@/components/shared/Panel";
import { QRCodeSVG } from "qrcode.react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { brandLabel, expiryLabel, type SavedCard } from "@/lib/api/cards";
import { money, type WaitingStory } from "@/lib/api/wallet";
import { cardFace } from "@/components/shared/card-brand-marks";
import { cn } from "@/lib/utils";
import { SECONDARY } from "./wallet-buttons";

// A PAYMENT METHOD, FULL SCREEN (Pato, MESITA-3533): a saved card or a
// Story waiting for staff, opened from a Wallet rail. A place's credit is a
// page of its own, /wallet/place/<placeId> (PlaceCredit.tsx, MESITA-3614).

export type Method =
  | { kind: "card"; card: SavedCard }
  | { kind: "story"; story: WaitingStory }
  | { kind: "cash" };

export function MethodSheet({
  method,
  onClose,
  onRemoveCard,
}: {
  method: Method | null;
  onClose: () => void;
  /** Remove a saved card (MESITA-3523); resolves once the server answered. */
  onRemoveCard?: (card: SavedCard) => Promise<void>;
}) {
  const title = method?.kind === "cash"
      ? "Cash"
      : method?.kind === "story"
      ? "Story voucher"
      : method?.kind === "card"
        ? `${brandLabel(method.card.brand)} •••• ${method.card.last4}`
        : "Card · Apple Pay · Google Pay";
  return (
    <LocalSheet open={method !== null} onClose={onClose} ariaLabel={title} fullScreen>
      <div className="border-border flex items-center gap-2 border-b px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-xl transition"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <h2 className="min-w-0 truncate text-base font-semibold">{title}</h2>
      </div>
      <div className="scrollbar-thin-dark flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-5 pb-8">
        {method?.kind === "card" ? <CardBody card={method.card} onRemove={onRemoveCard} /> : null}
        {method?.kind === "story" ? <StoryBody story={method.story} /> : null}
        {method?.kind === "cash" ? <CashBody /> : null}
      </div>
    </LocalSheet>
  );
}

/** A saved card (MESITA-3523): what Stripe told us about it, and Remove.
 *  A card a Premier plan renews with says so and offers no Remove. */
function CardBody({ card, onRemove }: { card: SavedCard; onRemove?: (card: SavedCard) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const face = cardFace(card.brand, brandLabel(card.brand));
  return (
    <>
      <div className={cn("flex aspect-[1.586/1] w-full flex-col justify-between rounded-2xl p-5", face.className)} style={face.style}>
        {face.mark}
        <div>
          <p className="text-xl font-semibold tabular-nums">•••• {card.last4}</p>
          <p className="mt-0.5 text-sm tabular-nums opacity-70">Expires {expiryLabel(card)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>Saved on your Mesita account. Stripe keeps the card number; Mesita only sees the last four digits.</p>
        {card.in_use ? <p data-card-in-use>This card pays your Premier plan. To remove it, change the plan&apos;s card first.</p> : null}
      </div>
      {card.in_use || !onRemove ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onRemove(card).finally(() => setBusy(false));
          }}
          className={`${SECONDARY} mt-5 disabled:opacity-60`}
          data-card-remove
        >
          {busy ? "Removing…" : "Remove card"}
        </button>
      )}
    </>
  );
}

function StoryBody({ story }: { story: WaitingStory }) {
  const name = story.place?.name ?? "this place";
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm leading-relaxed">
        {money(story.credit_cents, story.currency)} of credit at {name} waits for step 2: post an Instagram story at
        the place, tag it, and show the story and this QR to the staff.
      </p>
      <QRCodeSVG value={story.url} size={224} marginSize={0} aria-label="Story voucher activation code" />
    </div>
  );
}

/** Cash (MESITA-4116; redesigned MESITA-4125, Pato: "don't make cash look as
 *  a card ... just mention like pay with cash, or pay in their terminal ...
 *  redesign this page from scratch"). No card face: two panels and a line.
 *  How you pay: cash, or the place's terminal, both outside the app. Credits
 *  back: Mesita Pay 5% (Mesita's green) against cash 3% (cash's own green).
 *  The rates are the most a place gives; each place turns either on or off. */
function CashBody() {
  return (
    <div className="flex flex-col gap-4">
      <section className={cn(PANEL_CLASS, "divide-border flex flex-col divide-y")} aria-label="How you pay">
        <div className="px-4 pt-4 pb-3">
          <PanelHeading>How you pay</PanelHeading>
        </div>
        <CashbackLine
          icon={<Banknote className="h-5 w-5" />}
          tone={CASH_GREEN}
          title="Pay with cash"
          line="Hand it to the waiter"
        />
        <CashbackLine
          icon={<CreditCard className="h-5 w-5" />}
          tone={CASH_GREEN}
          title="Pay at their terminal"
          line="The place's card machine"
        />
      </section>
      <section className={cn(PANEL_CLASS, "divide-border flex flex-col divide-y")} aria-label="Credits back">
        <div className="px-4 pt-4 pb-3">
          <PanelHeading>Credits back</PanelHeading>
        </div>
        <CashbackLine
          icon={<QrCode className="h-5 w-5" />}
          tone="bg-foreground text-white"
          title="Mesita Pay"
          line="In the app"
          rate={{ text: "5% back", className: "bg-green-400 text-neutral-950" }}
        />
        <CashbackLine
          icon={<Banknote className="h-5 w-5" />}
          tone={CASH_GREEN}
          title="Cash or terminal"
          line="Outside the app"
          rate={{ text: "3% back", className: "bg-muted text-foreground" }}
        />
      </section>
      <p className="text-muted-foreground px-1 text-sm leading-relaxed">
        Each place sets its own: Mesita Pay 5% or off, cash 3% or off.
      </p>
    </div>
  );
}

function CashbackLine({
  icon,
  tone,
  title,
  line,
  rate,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  line: string;
  rate?: { text: string; className: string };
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="text-muted-foreground block text-sm">{line}</span>
      </span>
      {rate ? (
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-base font-bold tabular-nums", rate.className)}>
          {rate.text}
        </span>
      ) : null}
    </div>
  );
}

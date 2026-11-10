"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { PlaceMarks, SizedImg } from "@mesita/place-profile";
import { firstInitial } from "@mesita/place-profile/lib/format";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { Skeleton } from "@/components/shared/Skeleton";
import { money } from "@/lib/api/wallet";
import { cardAmount } from "@/lib/wallet-card";
import { cn } from "@/lib/utils";

// THE HOUSE CARD (Pato, MESITA-3511: "a list of all your cards, using card
// dimensions and mentioning how much you have on each … one house card for
// all the places"). One Mesita design for every place, shaped like a
// payment card (ISO ID-1, 85.60 × 53.98 mm = 1.586:1), the same black as
// the Offers wallet pill so "your credit" is one mark everywhere. The amount
// is the server's, chosen by `cardAmount`, never added up here. The name
// wears both place marks (MESITA-3321); a Wallet card is not an ad.

export type WalletCardModel = {
  key: string;
  name: string;
  photo: string | null;
  /** From the place's catalog row; absent = no mark (the server decides). */
  tier: number | null;
  currency: string;
  available_cents: number;
  pending_cents: number;
  /** A balance row exists for this card (a $0 catalog card has none). */
  hasBalance: boolean;
  /** Tap: expand the history, open the place, or nothing. */
  tap: { kind: "expand" } | { kind: "link"; href: string } | { kind: "open" } | { kind: "plain" };
};

const CARD_BASE =
  "relative z-10 flex w-full flex-col justify-between bg-neutral-950 text-left text-white focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 focus-visible:outline-none";
/** Full size on the method sheet; compact on a Wallet rail, 2.5 across (MESITA-3534). */
// A rail card is 2:1 since MESITA-3637 (shorter rails on Pay), the sheet's
// full card stays a payment card.
const cardClass = (compact: boolean) =>
  cn(CARD_BASE, compact ? "aspect-[2/1] rounded-xl p-2.5" : "aspect-[1.586/1] rounded-2xl p-5");

export function WalletCard({
  card,
  open = false,
  onToggle,
  eager = false,
  compact = false,
}: {
  card: WalletCardModel;
  open?: boolean;
  onToggle?: () => void;
  eager?: boolean;
  /** A rail card, 2.5 across the screen (MESITA-3534): smaller face. */
  compact?: boolean;
}) {
  const label = ariaLabel(card);
  const face = compact ? <CompactFace card={card} eager={eager} /> : <CardFace card={card} open={open} eager={eager} />;
  const CARD_CLASS = cardClass(compact);
  if (card.tap.kind === "expand") {
    return (
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={label} className={CARD_CLASS}>
        {face}
      </button>
    );
  }
  // "open" (MESITA-3533): the card opens its method sheet, full screen.
  if (card.tap.kind === "open") {
    return (
      <button type="button" onClick={onToggle} aria-label={label} className={CARD_CLASS}>
        {face}
      </button>
    );
  }
  if (card.tap.kind === "link") {
    return (
      <Link href={card.tap.href} aria-label={label} className={CARD_CLASS}>
        {face}
      </Link>
    );
  }
  return (
    <div role="group" aria-label={label} className={CARD_CLASS}>
      {face}
    </div>
  );
}

/** The rail's small card: photo and name on top, the amount at the foot. */
function CompactFace({ card, eager }: { card: WalletCardModel; eager: boolean }) {
  const amount = cardAmount(card);
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white" aria-hidden>
          {card.photo ? (
            <SizedImg src={card.photo} size="thumb" alt="" loading={eager ? "eager" : "lazy"} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center type-meta font-semibold">
              {firstInitial(card.name)}
            </span>
          )}
        </span>
        <span className="min-w-0 truncate text-xs font-semibold">{card.name}</span>
      </div>
      <div className="flex min-w-0 items-baseline gap-1.5" aria-hidden>
        <span className="text-base leading-tight font-semibold tabular-nums">{money(amount.cents, card.currency)}</span>
        <span className="truncate type-label text-white/60">{amount.pending ? "Pending" : card.available_cents > 0 ? "Credits" : "No credits yet"}</span>
      </div>
    </>
  );
}

function CardFace({ card, open, eager }: { card: WalletCardModel; open: boolean; eager: boolean }) {
  const amount = cardAmount(card);
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-white" aria-hidden>
          {card.photo ? (
            <SizedImg
              src={card.photo}
              size="thumb"
              alt=""
              loading={eager ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold">
              {firstInitial(card.name)}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-0 truncate text-base font-semibold">{card.name}</span>
          <PlaceMarks tier={card.tier} ad={false} />
        </span>
        <MesitaMark className="h-6 w-6 shrink-0 text-white/60" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0" aria-hidden>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">{money(amount.cents, card.currency)}</span>
            {amount.pending ? (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">Pending</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-white/60">{smallLine(card)}</p>
        </div>
        {card.tap.kind === "expand" ? (
          <ChevronDown className={cn("h-5 w-5 shrink-0 text-white/60 transition", open && "rotate-180")} aria-hidden />
        ) : card.tap.kind === "link" || card.tap.kind === "open" ? (
          <ArrowUpRight className="h-5 w-5 shrink-0 text-white/60" aria-hidden />
        ) : null}
      </div>
    </>
  );
}

function smallLine(card: WalletCardModel): string {
  if (card.available_cents > 0 && card.pending_cents > 0) {
    return `${money(card.pending_cents, card.currency)} pending · available within the hour`;
  }
  if (card.pending_cents > 0) return "Available within the hour";
  if (card.available_cents > 0) return "Credits";
  return "No credits yet";
}

function ariaLabel(card: WalletCardModel): string {
  if (!card.hasBalance) return `${card.name}: no credits, open place`;
  const pending = card.pending_cents > 0 ? `, ${money(card.pending_cents, card.currency)} pending` : "";
  return `${card.name}: ${money(card.available_cents, card.currency)} in credits${pending}`;
}

/** The card as it will land, same shape, for the loading frame. */
export function WalletCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="aspect-[1.586/1] w-full rounded-2xl" />
      ))}
    </div>
  );
}

/** The light panel tucked under an open card. */
export function WalletCardPanel({ children }: { children: ReactNode }) {
  return (
    <div className="border-border bg-card -mt-4 rounded-b-2xl border border-t-0 px-4 pt-6 pb-3">{children}</div>
  );
}

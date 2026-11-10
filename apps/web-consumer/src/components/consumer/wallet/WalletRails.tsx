"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { Skeleton } from "@/components/shared/Skeleton";
import { brandLabel, expiryLabel, type SavedCard } from "@/lib/api/cards";
import { money, type WaitingStory } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";

// TWO RAILS OF CARDS (Pato, MESITA-3530, 2026-11-09: "TWO HORIZONTAL
// CAROUSELS with cards. only that in that page. Top is Money Payment
// Methods: Add, Card One, Card Two … Bottom is Credits Payment Methods:
// Add, Card One, Card Two …"). Each rail scrolls sideways with snap; every
// tile is payment-card shaped (ISO ID-1, 1.586:1) and the same width, so
// the next card always peeks. MESITA-3637 made the rails shorter by
// dropping the cashback bar and squashing tiles to 2:1; the squash was
// undone by MESITA-3643 (Pato: "payment methods must have card
// dimensions"), the bar stays gone. Add leads each rail. Tapping a method opens
// its full-screen modal in a later issue; today a tile goes where it went.

/** One tile's width: TWO AND A HALF across the screen (Pato, MESITA-3534:
 *  "2.5 cards width the screen ... make it less wide the cards"). The rail's
 *  content box is the screen minus its 16px insets; from the left inset to
 *  the right edge that is 100% + 16px, holding 2.5 tiles and two 12px gaps,
 *  so a tile is (100% + 16px - 24px) / 2.5. */
export const RAIL_TILE = "w-[calc((100%-8px)/2.5)] shrink-0 snap-start";
const TILE_SHAPE = "aspect-[1.586/1] rounded-xl";

export function WalletRail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5" aria-label={title}>
      <h2 className="font-display mb-2 text-base font-semibold tracking-tight">{title}</h2>
      {/* Full bleed: the rail runs to the screen edges, its first card on the page's inset. */}
      <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-3 overflow-x-auto px-4 pb-1">
        {children}
      </div>
    </section>
  );
}

/** The dashed Add tile that leads a rail. */
export function AddTile({
  label,
  line,
  href,
  onClick,
}: {
  label: string;
  line: string;
  href?: string;
  onClick?: () => void;
}) {
  const face = (
    <>
      <span className="bg-muted flex h-7 w-7 items-center justify-center rounded-full" aria-hidden>
        <Plus className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <span className="mt-1.5 text-sm font-semibold">{label}</span>
      <span className="sr-only">{line}</span>
    </>
  );
  const cls = cn(
    RAIL_TILE,
    TILE_SHAPE,
    "border-border bg-card hover:bg-muted/40 flex flex-col items-center justify-center border-2 border-dashed transition",
  );
  return href ? (
    <Link href={href} className={cls} data-wallet-add>
      {face}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} data-wallet-add>
      {face}
    </button>
  );
}

// NO CASHBACK UNDER A MONEY METHOD (Pato, MESITA-3637: "better don't show
// the Cashback amount there. keep it clean"). The "2% / 5% Back as Credits"
// bar of MESITA-3542/3566 is gone; the rates live on the place screen.

/** Cash, right after Add: a green bill with the $ in its middle. Nothing to
 *  open. */
export function CashTile() {
  return (
    <div className={RAIL_TILE}>
      <div
        role="img"
        aria-label="Cash"
        className={cn(TILE_SHAPE, "relative flex w-full items-center justify-center overflow-hidden bg-green-400 text-neutral-950")}
        data-wallet-method="cash"
      >
        {/* MESITA-3584 (Pato: "go for 1"): the place screen's green with a
            black $ coin, one colour for money that pays you back. */}
        <span className="absolute inset-1.5 rounded-lg border border-neutral-950/20" aria-hidden />
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-lg font-bold text-green-400" aria-hidden>
          $
        </span>
        <span className="absolute bottom-2 left-2.5 text-xs font-semibold" aria-hidden>
          Cash
        </span>
      </div>
    </div>
  );
}

/** A card the guest saved (MESITA-3523): Stripe's brand, the last four and
 *  the expiry, never more. A tap opens its sheet (Remove). */
export function SavedCardTile({ card, onOpen }: { card: SavedCard; onOpen: () => void }) {
  const brand = brandLabel(card.brand);
  return (
    <div className={RAIL_TILE}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${brand} ending in ${card.last4}, expires ${expiryLabel(card)}`}
        className={cn(TILE_SHAPE, "flex w-full flex-col justify-between bg-neutral-900 p-2.5 text-left text-white")}
        data-wallet-method="saved-card"
      >
        <span className="truncate text-xs font-semibold">{brand}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-sm leading-tight font-semibold tabular-nums">•••• {card.last4}</span>
          <span className="type-label text-white/70 tabular-nums">{expiryLabel(card)}</span>
        </span>
      </button>
    </div>
  );
}

/** A Story voucher waiting for staff (MESITA-3507): a card in Credits whose
 *  tap shows the QR staff scan. */
export function StoryTile({ story, onOpen }: { story: WaitingStory; onOpen: () => void }) {
  const name = story.place?.name ?? "A Mesita place";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Story voucher at ${name}: ${money(story.credit_cents, story.currency)} waiting for activation. Show the QR`}
      className={cn(RAIL_TILE, TILE_SHAPE, "flex flex-col justify-between bg-pink-200 p-2.5 text-left text-neutral-950")}
      data-wallet-story
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold">
        <Instagram className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{name}</span>
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="text-base leading-tight font-semibold tabular-nums">{money(story.credit_cents, story.currency)}</span>
        <span className="truncate type-label text-neutral-700">Show the QR</span>
      </span>
    </button>
  );
}

/** Loading cards inside a rail: same width and shape as the cards. */
export function RailSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn(RAIL_TILE, TILE_SHAPE)} aria-hidden />
      ))}
    </>
  );
}

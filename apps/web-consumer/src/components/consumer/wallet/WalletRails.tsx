"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { Skeleton } from "@/components/shared/Skeleton";
import { money, type WaitingStory } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";

// TWO RAILS OF CARDS (Pato, MESITA-3530, 2026-11-09: "TWO HORIZONTAL
// CAROUSELS with cards. only that in that page. Top is Money Payment
// Methods: Add, Card One, Card Two … Bottom is Credits Payment Methods:
// Add, Card One, Card Two …"). Each rail scrolls sideways with snap; every
// tile is payment-card shaped (ISO ID-1, 1.586:1) and the same width, so
// the next card always peeks. Add leads each rail. Tapping a method opens
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
      {/* Top-aligned: a money tile carries its cashback line under it, and a
          stretched row would pull the other tiles out of their card shape. */}
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

// EACH MONEY METHOD SAYS ITS CASHBACK UNDER IT (Pato, MESITA-3542: "below
// add the cashbacks in the money payment methods ... the money payment
// method of the right must be Cash, a green bill with $ sign ... 2% back as
// credits ... then list the cards and below all the cards mention 5% back").
// The two standard rates of Payments Flow v2 (MESITA-3541): Mesita Pay 5%,
// cash 2%, both as credit at that place. Cash earns through the waiter's
// Received on the charge page (MESITA-3541 step 3).
const CARD_BACK = "5% back as credits";
const CASH_BACK = "2% back as credits";

/** The pill's short face; the full sentence stays for screen readers. */
const shortBack = (back: string) => `+${back.split(" ")[0]} in credits`;

/** A money tile and its cashback, one rail slot. THE CASHBACK IS A BLACK
 *  PILL FLOATING OVER THE CARD'S BOTTOM EDGE (Pato, MESITA-3551: "a nice
 *  black box floating below"): the ink chip, centred, half over the card,
 *  half below it; the slot keeps room under it so the rail never clips it. */
function MoneySlot({ back, children }: { back: string; children: ReactNode }) {
  return (
    <div className={cn(RAIL_TILE, "pb-3.5")}>
      <div className="relative">
        {children}
        <p
          className="bg-foreground text-background pointer-events-none absolute bottom-0 left-1/2 z-[1] -translate-x-1/2 translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-md"
          data-wallet-back
        >
          <span aria-hidden>{shortBack(back)}</span>
          <span className="sr-only">{back}</span>
        </p>
      </div>
    </div>
  );
}

/** Cash, right after Add: a green bill with the $ in its middle. Nothing to
 *  open; the line under it says what paying cash earns. */
export function CashTile() {
  return (
    <MoneySlot back={CASH_BACK}>
      <div
        role="img"
        aria-label={`Cash: ${CASH_BACK}`}
        className={cn(TILE_SHAPE, "relative flex w-full items-center justify-center overflow-hidden bg-emerald-600 text-white")}
        data-wallet-method="cash"
      >
        <span className="absolute inset-1.5 rounded-lg border border-white/40" aria-hidden />
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/80 text-lg font-bold" aria-hidden>
          $
        </span>
        <span className="absolute bottom-2.5 left-3 text-xs font-semibold" aria-hidden>
          Cash
        </span>
      </div>
    </MoneySlot>
  );
}

/** Money's card method today: Mesita Pay charges by card, Apple Pay or
 *  Google Pay at Stripe's checkout. No card is saved on Mesita yet, so this
 *  rail never invents one; a saved card will sit beside it with the same line. */
export function CheckoutMethodTile({ onOpen }: { onOpen: () => void }) {
  return (
    <MoneySlot back={CARD_BACK}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Card, Apple Pay or Google Pay, chosen at checkout: ${CARD_BACK}`}
        className={cn(TILE_SHAPE, "flex w-full flex-col justify-between bg-white p-3 text-left ring-1 ring-black/10")}
        data-wallet-method="checkout"
      >
        <CreditCard className="h-5 w-5" aria-hidden />
        <span>
          <span className="block text-xs leading-tight font-semibold">Card · Apple Pay · Google Pay</span>
          <span className="text-muted-foreground block type-label">At checkout</span>
        </span>
      </button>
    </MoneySlot>
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
      className={cn(RAIL_TILE, TILE_SHAPE, "flex flex-col justify-between bg-pink-200 p-3 text-left text-neutral-950")}
      data-wallet-story
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold">
        <Instagram className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{name}</span>
      </span>
      <span>
        <span className="block text-base leading-tight font-semibold tabular-nums">{money(story.credit_cents, story.currency)}</span>
        <span className="block truncate type-label text-neutral-700">Show the QR</span>
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

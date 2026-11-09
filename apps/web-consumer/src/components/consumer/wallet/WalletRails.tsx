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

/** One tile's width: the next card peeks past the right edge. */
export const RAIL_TILE = "w-[78%] max-w-[340px] shrink-0 snap-start";
const TILE_SHAPE = "aspect-[1.586/1] rounded-2xl";

export function WalletRail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="font-display mb-3 text-lg font-semibold tracking-tight">{title}</h2>
      {/* Full bleed: the rail runs to the screen edges, its first card on the page's inset. */}
      <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
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
      <span className="bg-muted flex h-11 w-11 items-center justify-center rounded-full" aria-hidden>
        <Plus className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="mt-3 text-base font-semibold">{label}</span>
      <span className="text-muted-foreground mt-0.5 px-6 text-center text-sm">{line}</span>
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

/** Money's one real method today: Mesita Pay charges by card, Apple Pay or
 *  Google Pay at Stripe's checkout. No card is saved on Mesita yet, so this
 *  rail never invents one. */
export function CheckoutMethodTile({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Card, Apple Pay or Google Pay, chosen at checkout"
      className={cn(RAIL_TILE, TILE_SHAPE, "flex flex-col justify-between bg-white p-5 text-left ring-1 ring-black/10")}
      data-wallet-method="checkout"
    >
      <span className="bg-muted flex h-10 w-10 items-center justify-center rounded-full" aria-hidden>
        <CreditCard className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-base font-semibold">Card · Apple Pay · Google Pay</span>
        <span className="text-muted-foreground mt-0.5 block text-sm">Chosen at checkout, every time you pay</span>
      </span>
    </button>
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
      className={cn(RAIL_TILE, TILE_SHAPE, "flex flex-col justify-between bg-pink-200 p-5 text-left text-neutral-950")}
      data-wallet-story
    >
      <span className="flex items-center gap-2 text-base font-semibold">
        <Instagram className="h-5 w-5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{name}</span>
      </span>
      <span>
        <span className="block text-2xl font-semibold tabular-nums">{money(story.credit_cents, story.currency)}</span>
        <span className="block text-sm text-neutral-700">Waiting for your story · show the QR</span>
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

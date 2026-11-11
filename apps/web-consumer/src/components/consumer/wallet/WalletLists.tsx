"use client";

import { Children, Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SizedImg } from "@mesita/place-profile";
import { firstInitial } from "@mesita/place-profile/lib/format";
import { Instagram } from "@/components/shared/instagram-icon";
import { Skeleton } from "@/components/shared/Skeleton";
import { brandLabel, expiryLabel, type SavedCard } from "@/lib/api/cards";
import { money, type WaitingStory } from "@/lib/api/wallet";
import { cardAmount } from "@/lib/wallet-card";
import { cn } from "@/lib/utils";
import { type WalletCardModel, walletCardLabel, walletCardLine } from "./WalletCard";

// THE WALLET REDESIGN (Pato, 2026-11-11, MESITA-3727, /autoplan approved
// with "rec"): Credits first, then Ways to pay (WalletSection). Each list's
// Add is a quiet button on its heading (HeadingButton), never a dashed first
// row. A Credits Card is just its row (Pato, MESITA-3731: "keep just the card
// without the buttons to fund nor gift. those must go inside"): Fund and Gift
// are on its House Card page. A shown amount of 0 is muted. A guest with no Credits Card
// sees one quiet prompt (EmptyCreditsRow). CreditRowSkeleton is the loading
// shape for a card, shared with Pay's loading frame.
//
// TWO LISTS, NOT TWO RAILS (Pato, 2026-11-11, MESITA-3701: "try making the
// payment methods as lists instead of horizontal scrolls"). Money Payment
// Methods and Credits Payment Methods are each one white card of rows, Add
// first. A row is a small payment-card-shaped chip in the method's own
// colour (MESITA-3643's card shape: green $ Cash, a black saved card, a
// black House Card wearing the place's photo, a pink Story), its name, a
// quiet second line, and the amount or a chevron. The rails they replace
// (MESITA-3530: "TWO HORIZONTAL CAROUSELS with cards") scrolled sideways,
// 2.5 tiles across (MESITA-3534).

/** The chip: a payment card in miniature, 1.586:1. */
const CHIP = "flex h-8 w-[3.2rem] shrink-0 items-center justify-center overflow-hidden rounded-md";
const ROW =
  "hover:bg-muted/60 flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left transition";
const DIVIDER = "bg-border ml-[4.75rem] h-px";

/** A heading (with an optional button on its right) over one white card of
 *  rows, a hairline between rows. `fallback` replaces the card when there
 *  are no rows (the Wallet's error state sits right under its heading). */
export function WalletList({
  title,
  action,
  fallback,
  children,
}: {
  title: string;
  action?: ReactNode;
  fallback?: ReactNode;
  children?: ReactNode;
}) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <section className="mt-5" aria-label={title}>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {rows.length === 0 && fallback ? (
        fallback
      ) : (
        <ul role="list" className="border-border bg-card overflow-hidden rounded-2xl border">
          {rows.map((row, i) => (
            <Fragment key={i}>
              {i > 0 ? <li aria-hidden className={DIVIDER} /> : null}
              <li>{row}</li>
            </Fragment>
          ))}
        </ul>
      )}
    </section>
  );
}

const HEADING_BUTTON =
  "hover:bg-muted -my-3 -mr-2 inline-flex h-11 items-center justify-center rounded-full px-3 text-sm font-semibold transition disabled:opacity-60";

/** A list heading's quiet button: a 44px target pulled in by negative margin
 *  so the heading keeps its height. A link with `href`, else a button. */
export function HeadingButton({
  label,
  ariaLabel,
  href,
  onClick,
  disabled = false,
  className,
}: {
  label: string;
  ariaLabel: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return href ? (
    <Link href={href} aria-label={ariaLabel} className={cn(HEADING_BUTTON, className)} data-wallet-add>
      {label}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={cn(HEADING_BUTTON, className)} data-wallet-add>
      {label}
    </button>
  );
}

function RowText({ title, line }: { title: ReactNode; line?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-base font-semibold">{title}</span>
      {line ? <span className="text-muted-foreground mt-0.5 block truncate text-sm">{line}</span> : null}
    </span>
  );
}

const Chevron = () => <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />;

/** No Credits Card yet (MESITA-3727): one quiet prompt, no chip. Most
 *  guests see this first, so it explains what a Credits Card is. */
export function EmptyCreditsRow({ href }: { href: string }) {
  return (
    <Link href={href} className={ROW} data-wallet-empty-credits>
      <RowText title="Find a place and add its card" line="A Credits Card holds credit you buy at one place" />
      <Chevron />
    </Link>
  );
}

/** Cash: nothing to open (MESITA-3584's green with the black $ coin). */
export function CashRow() {
  return (
    <div className={cn(ROW, "hover:bg-transparent")} data-wallet-method="cash">
      <span className={cn(CHIP, "bg-green-400")} aria-hidden>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-green-400">$</span>
      </span>
      <RowText title="Cash" line="Pay at the place" />
    </div>
  );
}

/** A saved card (MESITA-3523): brand, last four, expiry. Opens its sheet. */
export function SavedCardRow({ card, onOpen }: { card: SavedCard; onOpen: () => void }) {
  const brand = brandLabel(card.brand);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${brand} ending in ${card.last4}, expires ${expiryLabel(card)}`}
      className={ROW}
      data-wallet-method="saved-card"
    >
      <span className={cn(CHIP, "bg-neutral-900 text-[0.625rem] font-semibold text-white tabular-nums")} aria-hidden>
        {card.last4}
      </span>
      <RowText title={`${brand} •••• ${card.last4}`} line={`Expires ${expiryLabel(card)}`} />
      <Chevron />
    </button>
  );
}

/** A Story voucher waiting for staff (MESITA-3507): its tap shows the QR. */
export function StoryRow({ story, onOpen }: { story: WaitingStory; onOpen: () => void }) {
  const name = story.place?.name ?? "A Mesita place";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Story voucher at ${name}: ${money(story.credit_cents, story.currency)} waiting for activation. Show the QR`}
      className={ROW}
      data-wallet-story
    >
      <span className={cn(CHIP, "bg-pink-200 text-neutral-950")} aria-hidden>
        <Instagram className="h-4 w-4" />
      </span>
      <RowText title={name} line="Story voucher · show the QR" />
      <span className="shrink-0 text-lg font-semibold tabular-nums">{money(story.credit_cents, story.currency)}</span>
    </button>
  );
}

/** A place's House Card: the black chip with the place's photo, the name,
 *  the server's amount. Its tap is the model's (the House Card page), where
 *  Fund and Gift live (MESITA-3731). */
export function CreditRow({ card, eager = false }: { card: WalletCardModel; eager?: boolean }) {
  const amount = cardAmount(card);
  const face = (
    <>
      <span className={cn(CHIP, "bg-neutral-950")} aria-hidden>
        <span className="h-5 w-5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white">
          {card.photo ? (
            <SizedImg src={card.photo} size="thumb" alt="" loading={eager ? "eager" : "lazy"} className="h-full w-full object-cover" />
          ) : (
            <span className="type-meta flex h-full w-full items-center justify-center font-semibold text-white">
              {firstInitial(card.name)}
            </span>
          )}
        </span>
      </span>
      <RowText title={card.name} line={walletCardLine(card)} />
      <span className={cn("shrink-0 text-lg font-semibold tabular-nums", amount.cents === 0 && "text-muted-foreground")}>
        {money(amount.cents, card.currency)}
      </span>
      {card.tap.kind === "link" ? <Chevron /> : null}
    </>
  );
  const label = walletCardLabel(card);
  const row =
    card.tap.kind === "link" ? (
      <Link href={card.tap.href} aria-label={label} className={ROW}>
        {face}
      </Link>
    ) : (
      <div role="group" aria-label={label} className={cn(ROW, "hover:bg-transparent")}>
        {face}
      </div>
    );
  return row;
}

/** Loading rows inside a list: the chip and two lines. */
export function RowsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={ROW} aria-hidden>
          <Skeleton className={CHIP} />
          <span className="flex-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-1.5 h-3 w-24" />
          </span>
        </div>
      ))}
    </>
  );
}

/** A Credits Card loading: its row. Pay's loading frame draws the same. */
export function CreditRowSkeleton() {
  return (
    <div className={ROW} aria-hidden>
      <Skeleton className={CHIP} />
      <span className="flex-1">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-1.5 h-3 w-24" />
      </span>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

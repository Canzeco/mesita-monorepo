"use client";

import { Children, Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PlaceMarks, SizedImg } from "@mesita/place-profile";
import { firstInitial } from "@mesita/place-profile/lib/format";
import { Instagram } from "@/components/shared/instagram-icon";
import { Skeleton } from "@/components/shared/Skeleton";
import { brandLabel, expiryLabel, type SavedCard } from "@/lib/api/cards";
import { money, type WaitingStory } from "@/lib/api/wallet";
import { cardAmount } from "@/lib/wallet-card";
import { cn } from "@/lib/utils";
import { type WalletCardModel, walletCardLabel } from "./WalletCard";

// The lists' parts: every row of both lists.
//
// ONE ROW FOR EVERY METHOD (Pato, 2026-11-11, MESITA-3741: "make the same
// list of cards as with the money payment methods. keep the symmetry"): a
// Credits Card is a row like a saved card (CreditsRow: the place's photo in
// the card-shaped chip, the name, one quiet line, the amount, a chevron to
// its House Card), in one white card of rows; MESITA-3736's black band with
// transactions and Fund | Gift is gone from the Wallet. Buy and Gift live on
// the House Card page (PlaceCredit). No card yet: EmptyCreditsRow.
//
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
// last: a row at the bottom of the card, never on the heading (Pato,
// MESITA-3744: "the add button must be below, not there"). A row is a small payment-card-shaped chip in the method's own
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

/** The last row of a list: a dashed chip with a +, "Add" and what it adds
 *  (MESITA-3744). A link with `href`, else a button. */
export function AddRow({
  line,
  ariaLabel,
  href,
  onClick,
  disabled = false,
  busy = false,
}: {
  line: string;
  ariaLabel: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Opening the next page: the row reads "Opening…". */
  busy?: boolean;
}) {
  const inner = (
    <>
      <AddChip />
      <RowText title={busy ? "Opening…" : "Add"} line={line} />
    </>
  );
  return href ? (
    <Link href={href} aria-label={ariaLabel} className={ROW} data-wallet-add>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={cn(ROW, "disabled:opacity-60")} data-wallet-add>
      {inner}
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

/** The method chips, also the rows of Pay's "How do you pay?" (MESITA-3748). */
export function CashChip() {
  return (
    <span className={cn(CHIP, "bg-green-400")} aria-hidden>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-green-400">$</span>
    </span>
  );
}

export function SavedCardChip({ last4 }: { last4: string }) {
  return (
    <span className={cn(CHIP, "bg-neutral-900 text-[0.625rem] font-semibold text-white tabular-nums")} aria-hidden>
      {last4}
    </span>
  );
}

export function AddChip() {
  return (
    <span className={cn(CHIP, "border-muted-foreground/40 text-muted-foreground border-2 border-dashed")} aria-hidden>
      <Plus className="h-4 w-4" />
    </span>
  );
}

/** A chip for a method with no colour of its own: grey, one ink icon. */
export function PlainChip({ children }: { children: ReactNode }) {
  return (
    <span className={cn(CHIP, "bg-muted text-foreground [&>svg]:h-4 [&>svg]:w-4")} aria-hidden>
      {children}
    </span>
  );
}

const Chevron = () => <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />;

/** Cash: nothing to open (MESITA-3584's green with the black $ coin). */
export function CashRow() {
  return (
    <div className={cn(ROW, "hover:bg-transparent")} data-wallet-method="cash">
      <CashChip />
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
      <SavedCardChip last4={card.last4} />
      <RowText title={`${brand} •••• ${card.last4}`} line={`Expires ${expiryLabel(card)}`} />
      <Chevron />
    </button>
  );
}

/** The quiet line under a Credits Card's name. */
function creditsLine(card: WalletCardModel, gone: boolean): string {
  if (gone) return "Ask Mesita support to use it";
  if (card.available_cents > 0 && card.pending_cents > 0) return `${money(card.pending_cents, card.currency)} pending`;
  // No time here (MESITA-3750, Pato: "don't display time there"): each
  // purchase lands on its own clock; the House Card shows each one's time.
  if (card.pending_cents > 0) return "Pending";
  if (card.available_cents > 0) return "Available";
  return "No credits yet";
}

/** A place's Credits Card (MESITA-3741): a row like a saved card's. The
 *  amount is the server's, chosen by cardAmount; 0 is muted. */
export function CreditsRow({
  card,
  href,
  gone = false,
  eager = false,
}: {
  card: WalletCardModel;
  /** Its House Card page. */
  href: string;
  /** The place left Mesita; the money stays. */
  gone?: boolean;
  eager?: boolean;
}) {
  const amount = cardAmount(card);
  return (
    <Link href={href} aria-label={walletCardLabel(card)} className={ROW} data-wallet-method="credits">
      <span className={cn(CHIP, "bg-neutral-950 text-sm font-semibold text-white")} aria-hidden>
        {card.photo ? (
          <SizedImg src={card.photo} size="thumb" alt="" loading={eager ? "eager" : "lazy"} className="h-full w-full object-cover" />
        ) : (
          firstInitial(card.name)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-base font-semibold">{card.name}</span>
          <PlaceMarks tier={card.tier} ad={false} />
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-sm">{creditsLine(card, gone)}</span>
      </span>
      {/* Nothing on it: the line says so; no grey $0 beside it (MESITA-3744). */}
      {amount.cents > 0 || gone ? (
        <span className={cn("shrink-0 text-lg font-semibold tabular-nums", amount.cents === 0 && "text-muted-foreground")}>
          {money(amount.cents, card.currency)}
        </span>
      ) : null}
      <Chevron />
    </Link>
  );
}

/** No Credits Card yet: one row, the way to get one (Search). */
export function EmptyCreditsRow({ href }: { href: string }) {
  return (
    <Link href={href} className={ROW} data-wallet-empty-credits>
      <span className={cn(CHIP, "border-muted-foreground/40 border-2 border-dashed")} aria-hidden />
      <RowText title="Find a place" line="Credits Cards hold money you prepay at one place" />
      <Chevron />
    </Link>
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

/** The whole Wallet while its one read runs (MESITA-3814): both lists in
 *  the rows' own shape, so the page lands without a jump. /wallet's
 *  loading frame draws the same. */
export function WalletBodySkeleton() {
  return (
    <div aria-busy>
      <WalletList title="Money Payment Methods">
        <RowsSkeleton count={2} />
      </WalletList>
      <WalletList title="Credits Payment Methods">
        <RowsSkeleton count={2} />
      </WalletList>
    </div>
  );
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

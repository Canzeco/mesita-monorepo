"use client";

import { Children, Fragment, type ReactNode } from "react";
import Link from "next/link";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { ChevronRight, Plus } from "lucide-react";
import { PlaceMarks, SizedImg } from "@mesita/place-profile";
import { firstInitial } from "@mesita/place-profile/lib/format";
import { CardBrandChip } from "@/components/shared/card-brand-marks";
import { Skeleton } from "@/components/shared/Skeleton";
import { brandLabel, expiryLabel, isExpired, type SavedCard } from "@/lib/api/cards";
import { money, type WaitingStory } from "@/lib/api/wallet";
import { cardAmount } from "@/lib/wallet-card";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/shared/Panel";
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
// ONE LINE, 48px (MESITA-4087, Pato 2026-11-15: "optimize vertical space";
// "maybe don't mention the number nor pay at the place nor that kind of
// stuff, and the expires you can maybe put at the right or even don't put
// it"): a row is its chip and its name, no expiry. Two rows keep a quiet
// second line (MESITA-4091): a saved card's "Ends in 4242", and Cash's "Pay
// at the place, outside the app" (Pato: "just for them to understand").
// TALLER ROWS, FULL HAIRLINES (MESITA-4129, Pato: "make the cards a bit
// taller ... the lines separating the cards must be bigger and full ... why
// between [the heading and] the cards there is no separation"): 64px rows,
// every hairline edge to edge, one under the heading too.
const ROW =
  "hover:bg-muted/60 flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left transition";
const DIVIDER = "bg-border h-px";

/** A section of rows in a panel (the app's one Panel, components/shared;
 *  MESITA-4063 drew it here first, MESITA-4071 shared it with Me): its heading, the rows split by hairlines
 *  inside it. `fallback` replaces the rows when there are none (the Wallet's
 *  error state sits right under its heading). */
export function WalletPanelList({
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
    <Panel className="mt-4" title={title} action={action}>
      {rows.length === 0 && fallback ? (
        <div className="p-4 pt-2">{fallback}</div>
      ) : (
        <ul role="list" className="mt-3">
          {rows.map((row, i) => (
            <Fragment key={i}>
              <li aria-hidden className={DIVIDER} />
              <li>{row}</li>
            </Fragment>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** The last row of a list: a dashed chip with a +, then one line, "Add a
 *  card" (MESITA-3744; one line since MESITA-4087). A link with `href`,
 *  else a button. */
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
      <RowText title={busy ? "Opening…" : line} />
    </>
  );
  return href ? (
    <PushLink href={href} aria-label={ariaLabel} className={ROW} data-wallet-add>
      {inner}
    </PushLink>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={cn(ROW, "disabled:opacity-60")} data-wallet-add>
      {inner}
    </button>
  );
}

function RowText({ title, line }: { title: ReactNode; line?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-base leading-tight font-semibold">{title}</span>
      {line ? <span className="text-muted-foreground mt-0.5 block truncate text-sm leading-tight">{line}</span> : null}
    </span>
  );
}

/** The method chips, also the rows of Pay's "How do you pay?" (MESITA-3748). */
/** CASH'S OWN GREEN (MESITA-4125, Pato: "Mesita app green and cash same
 *  green is super confusing ... use the cash green that is usually of the
 *  money bills"): dollar-bill green, never Mesita's bright green-400. */
export const CASH_GREEN = "bg-[#85bb65] text-neutral-950";

export function CashChip() {
  return (
    <span className={cn(CHIP, CASH_GREEN)} aria-hidden>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">$</span>
    </span>
  );
}

/** A saved card's chip: its brand's mark on the brand's colour, or black
 *  with the last four (MESITA-4057, CardBrandChip). */
export function SavedCardChip({ brand, last4 }: { brand: string; last4: string }) {
  return <CardBrandChip brand={brand} last4={last4} />;
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

/** Cash (MESITA-3584's green with the black $ coin). Opens its page
 *  (MESITA-4116, Pato: "in the cash option also include >"): what paying
 *  outside the app means and the credits back it gives. */
export function CashRow({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={ROW} data-wallet-method="cash">
      <CashChip />
      <RowText title="Cash" line="Pay at the place, outside the app" />
      <Chevron />
    </button>
  );
}

/** A saved card (MESITA-3523): its brand over "Ends in 4242" (MESITA-4091,
 *  Pato: "just don't mention with it expired, you can just mention it ends
 *  in abcd"), "Expired" on the right only when it is. Opens its sheet. */
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
      <SavedCardChip brand={card.brand} last4={card.last4} />
      <RowText title={brand} line={`Ends in ${card.last4}`} />
      {isExpired(card) ? (
        <span className="text-muted-foreground shrink-0 text-sm">Expired</span>
      ) : null}
      <Chevron />
    </button>
  );
}

/** The quiet line under a Credits Card's name: only a gone place's. The
 *  row never says Pending or Available (MESITA-4059, Pato: "don't mention
 *  the pending state in credits card"); the pill says the amount and the
 *  House Card says when pending credit lands. */
function creditsLine(gone: boolean): string | null {
  return gone ? "Ask Mesita support to use it" : null;
}

/** A place's Credits Card (MESITA-3741): a row like a saved card's. The
 *  amount is the server's, chosen by cardAmount, in a black pill on the
 *  right, $0 included (Pato, MESITA-4050: "THE AMOUNT ... MUST BE IN A BLACK
 *  BOX ... AT THE RIGHT ... WITHOUT MAKING IT SUPER BIGGER"): text-sm, one
 *  step under the name. */
export function CreditsRow({
  card,
  href,
  gone = false,
  eager = false,
}: {
  card: WalletCardModel;
  /** Its House Card page. Absent on a page that IS this place's (the
   *  Offers page's balance, MESITA-4060): a plain row, no chevron. */
  href?: string;
  /** The place left Mesita; the money stays. */
  gone?: boolean;
  eager?: boolean;
}) {
  const amount = cardAmount(card);
  const line = creditsLine(gone);
  const inner = (
    <>
      <CreditsCardChip photo={card.photo} name={card.name} eager={eager} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-base leading-tight font-semibold">{card.name}</span>
          <PlaceMarks tier={card.tier} ad={false} />
        </span>
        {line ? <span className="text-muted-foreground mt-0.5 block truncate text-sm leading-tight">{line}</span> : null}
      </span>
      <CreditsPill>{money(amount.cents, card.currency)}</CreditsPill>
    </>
  );
  return href ? (
    <Link href={href} aria-label={walletCardLabel(card)} className={ROW} data-wallet-method="credits">
      {inner}
      <Chevron />
    </Link>
  ) : (
    <div role="group" aria-label={walletCardLabel(card)} className={cn(ROW, "hover:bg-transparent")} data-wallet-method="credits">
      {inner}
    </div>
  );
}

/** A Credits Card's image (MESITA-3741): the place's photo as a small
 *  landscape card, or its initial on black. Also Pay › Method's Credits row
 *  (MESITA-4085, Pato: "show the wallet icon in the credits here too"). */
export function CreditsCardChip({ photo, name, eager = false }: { photo: string | null; name: string | null; eager?: boolean }) {
  return (
    <span className={cn(CHIP, "bg-neutral-950 text-sm font-semibold text-white")} aria-hidden>
      {photo ? (
        <SizedImg src={photo} size="thumb" alt="" loading={eager ? "eager" : "lazy"} className="h-full w-full object-cover" />
      ) : (
        firstInitial(name ?? "M")
      )}
    </span>
  );
}

/** A credits balance in its black pill (MESITA-4050), here and on Pay. */
export function CreditsPill({ children }: { children: ReactNode }) {
  return (
    <span className="bg-foreground text-paper shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums">{children}</span>
  );
}

/** No Credits Card yet: one row, the way to get one (Search). */
export function EmptyCreditsRow({ href }: { href: string }) {
  return (
    <Link href={href} className={ROW} data-wallet-empty-credits>
      <span className={cn(CHIP, "border-muted-foreground/40 border-2 border-dashed")} aria-hidden />
      <RowText title="Find a place" />
      <Chevron />
    </Link>
  );
}

/** A Story voucher waiting for staff (MESITA-3507): its tap shows the QR.
 *  The House Card's plain row (MESITA-3869): title, grey line, muted amount,
 *  chevron; no chip of its own. */
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
      <RowText title={`Story voucher · ${name}`} />
      <span className="text-muted-foreground shrink-0 text-base font-semibold tabular-nums">
        +{money(story.credit_cents, story.currency)}
      </span>
      <Chevron />
    </button>
  );
}

/** The whole Wallet while its one read runs (MESITA-3814): both lists in
 *  the rows' own shape, so the page lands without a jump. /wallet's
 *  loading frame draws the same. */
export function WalletBodySkeleton() {
  return (
    <div aria-busy>
      <WalletPanelList title="Money Payment Methods">
        <RowsSkeleton count={2} />
      </WalletPanelList>
      <WalletPanelList title="Credits Payment Methods">
        <RowsSkeleton count={2} />
      </WalletPanelList>
    </div>
  );
}

/** Loading rows inside a list: the chip and one line. */
export function RowsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={ROW} aria-hidden>
          <Skeleton className={CHIP} />
          <span className="flex-1">
            <Skeleton className="h-4 w-36" />
          </span>
        </div>
      ))}
    </>
  );
}

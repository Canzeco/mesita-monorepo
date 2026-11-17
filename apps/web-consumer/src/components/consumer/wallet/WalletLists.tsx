"use client";

import { Children, Fragment, type ReactNode } from "react";
import Link from "next/link";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { ChevronRight, Clock3, Plus, QrCode } from "lucide-react";
import { PlaceMarks, SizedImg } from "@mesita/place-profile";
import { firstInitial } from "@mesita/place-profile/lib/format";
import { CardBrandChip } from "@/components/shared/card-brand-marks";
import { Skeleton } from "@/components/shared/Skeleton";
import { brandLabel, expiryLabel, isExpired, type SavedCard } from "@/lib/api/cards";
import { money, type WaitingStory } from "@/lib/api/wallet";
import { storyBonusOpen, storyLine } from "@/lib/story-lines";
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
    <Panel className="mt-2" title={title} action={action}>
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

/** The quiet line under a Credits Card's name: only a gone place's. Pay's
 *  Loyalty Cards say pending in their own amber line since MESITA-4232
 *  (Pato: "must display current balance. and also if pending"), which
 *  reverses MESITA-4059 there; other lists still never say it. */
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
  ready = false,
  pendingLine = null,
}: {
  card: WalletCardModel;
  /** Wallet's Loyalty Cards (MESITA-4232, D9): the pill shows only what is
   *  ready to spend, $0 included; pending says itself in `pendingLine`.
   *  ONLY THOSE TWO (MESITA-4269, Pato: "don't mention the promos there.
   *  its just current balance, pending balance if it applies"): no offer
   *  pill (MESITA-4262), no "Ready to spend" (MESITA-4260); the photo is a
   *  credit-card-sized chip with the name small at its right. */
  ready?: boolean;
  /** "$200.00 pending · ready in 3 h": a blue box under the row (MESITA-4260). */
  pendingLine?: string | null;
  /** Its House Card page. Absent on a page that IS this place's (the
   *  Offers page's balance, MESITA-4060): a plain row, no chevron. */
  href?: string;
  /** The place left Mesita; the money stays. */
  gone?: boolean;
  eager?: boolean;
}) {
  const amount = ready ? { cents: Math.max(0, card.available_cents), pending: false } : cardAmount(card);
  const line = creditsLine(gone);
  const body = (
    <>
      <CreditsCardChip photo={card.photo} name={card.name} eager={eager} card={ready} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("truncate leading-tight font-semibold", ready ? "text-sm" : "text-base")}>{card.name}</span>
          <PlaceMarks tier={card.tier} ad={false} />
        </span>
        {line ? <span className="text-muted-foreground mt-0.5 block truncate text-sm leading-tight">{line}</span> : null}
      </span>
      <CreditsPill>{money(amount.cents, card.currency)}</CreditsPill>
      {href ? <Chevron /> : null}
    </>
  );
  // PENDING GETS A BOX (MESITA-4260, Pato: "really important to mention if
  // money is coming … even if loyalty card space gets bigger"; option A):
  // under the row, inside the card's tap target, a blue box (blue = on its
  // way, green = ready) names the pending amount and when it lands. No
  // pending, no box: the row stays one line.
  const box = pendingLine ? <PendingBox icon={Clock3}>{pendingLine}</PendingBox> : null;
  const cls = box ? cn(ROW, "flex-col items-stretch gap-2.5") : ROW;
  const inner = box ? (
    <>
      <span className="flex min-w-0 items-center gap-3.5">{body}</span>
      {box}
    </>
  ) : (
    body
  );
  return href ? (
    <Link href={href} aria-label={walletCardLabel(card)} className={cls} data-wallet-method="credits">
      {inner}
    </Link>
  ) : (
    <div role="group" aria-label={walletCardLabel(card)} className={cn(cls, "hover:bg-transparent")} data-wallet-method="credits">
      {inner}
    </div>
  );
}

/** A Credits Card's image (MESITA-3741): the place's photo as a small
 *  landscape card, or its initial on black. Also Pay › Method's Credits row
 *  (MESITA-4085, Pato: "show the wallet icon in the credits here too"). */
export function CreditsCardChip({
  photo,
  name,
  eager = false,
  card = false,
}: {
  photo: string | null;
  name: string | null;
  eager?: boolean;
  /** Wallet's Loyalty Cards (MESITA-4269, Pato: "with dimensions of credit
   *  card"): a bigger 1.586:1 card, 48 × 76px. */
  card?: boolean;
}) {
  return (
    <span className={cn(CHIP, card && "h-12 w-[4.75rem] rounded-lg", "bg-neutral-950 text-sm font-semibold text-white")} aria-hidden>
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

/** PAYMENT METHODS, ONE LINE (Pato, 2026-11-17, MESITA-4232: "(Cash) (Card)
 *  Only one card. make it horizontal, cash at the left, card at the right";
 *  D8, D11): two tiles side by side, no panel around them, each saying where
 *  the money moves. */
const TILE =
  "hover:bg-muted/60 flex min-h-[4.5rem] min-w-0 items-center gap-3 px-4 py-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-400";

function TileText({ title, line }: { title: string; line: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-base leading-tight font-semibold">{title}</span>
      <span className="text-muted-foreground mt-0.5 block truncate text-sm leading-tight">{line}</span>
    </span>
  );
}

export function CashTile({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={TILE} aria-label="Cash, paid outside the app" data-wallet-method="cash">
      <CashChip />
      <TileText title="Cash" line="Outside the app" />
    </button>
  );
}

export function CardTile({ card, onOpen }: { card: SavedCard; onOpen: () => void }) {
  const brand = brandLabel(card.brand);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${brand} ending in ${card.last4}, expires ${expiryLabel(card)}, charged in the app`}
      className={TILE}
      data-wallet-method="saved-card"
    >
      <SavedCardChip brand={card.brand} last4={card.last4} />
      <TileText title={`${brand} •• ${card.last4}`} line={isExpired(card) ? "Expired" : "In the app"} />
    </button>
  );
}

export function AddCardTile({ href }: { href: string }) {
  return (
    <PushLink
      href={href}
      aria-label="Add a payment card"
      className={TILE}
      data-wallet-add
    >
      <AddChip />
      <TileText title="Add a card" line="In the app" />
    </PushLink>
  );
}

/** The two halves in ONE box (Pato, 2026-11-17, MESITA-4236: "PAYMENT
 *  METHODS IN A BOX", undoing MESITA-4232's D11): the panel and its heading
 *  like Loyalty Cards, Cash left and the card right, a hairline between. */
export function PaymentMethods({ children }: { children: ReactNode }) {
  return (
    <Panel className="mt-2" title="Payment Methods" data-payment-methods>
      <div className="border-border divide-border mt-3 grid grid-cols-2 divide-x border-t">{children}</div>
    </Panel>
  );
}

/** No Loyalty Card yet (D10): one grey line above Add a Loyalty Card. */
export function EmptyLoyaltyLine() {
  return (
    <p className="text-muted-foreground px-4 py-3 text-sm" data-wallet-empty-loyalty>
      Buy credit at a place and its card shows here.
    </p>
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

/** A Story voucher (MESITA-3507): its tap opens the sheet with the QR.
 *  The House Card's plain row (MESITA-3869): title, grey line, muted amount,
 *  chevron; no chip of its own. MESITA-4264: what was paid is already
 *  credit, so the row is the bonus and where the story stands. */
export function StoryRow({ story, onOpen, now }: { story: WaitingStory; onOpen: () => void; now: number }) {
  const name = story.place?.name ?? "A Mesita place";
  const bonus = `+${money(story.bonus_cents, story.currency)}`;
  const line = storyLine(story, now);
  const open = storyBonusOpen(story);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Story bonus at ${name}: ${bonus}. ${line}`}
      className={cn(ROW, "flex-col items-stretch gap-2.5")}
      data-wallet-story={story.state}
    >
      <span className="flex min-w-0 items-center gap-3.5">
        <CreditsCardChip photo={story.place?.photo ?? null} name={name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base leading-tight font-semibold">{name}</span>
          <span className="text-muted-foreground mt-0.5 block truncate text-sm leading-tight tabular-nums">Story bonus {bonus}</span>
        </span>
        <Chevron />
      </span>
      {/* A waiting Story is its place's pending (MESITA-4232, D13), in the
          same blue box as a card's pending (MESITA-4260); a decided one
          keeps its outcome for 24 hours in a grey box. */}
      <PendingBox icon={open ? QrCode : Clock3} quiet={!open}>
        {line}
      </PendingBox>
    </button>
  );
}

/** Money on its way (MESITA-4260): a soft blue box under a Loyalty Card. */
function PendingBox({ icon: Icon, children, quiet = false }: { icon: typeof Clock3; children: ReactNode; quiet?: boolean }) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-sm leading-tight font-medium ring-1 ring-inset",
        quiet ? "bg-muted text-muted-foreground ring-border" : "bg-blue-50 text-blue-700 ring-blue-200",
      )}
      data-wallet-pending
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** The whole Wallet while its one read runs (MESITA-3814): both lists in
 *  the rows' own shape, so the page lands without a jump. /wallet's
 *  loading frame draws the same. */
export function WalletBodySkeleton() {
  return (
    <div aria-busy>
      <PaymentMethods>
        <div className="p-3"><Skeleton className="h-12 rounded-xl" /></div>
        <div className="p-3"><Skeleton className="h-12 rounded-xl" /></div>
      </PaymentMethods>
      <WalletPanelList title="Loyalty Cards">
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

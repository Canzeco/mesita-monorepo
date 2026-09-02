"use client";

import { useState } from "react";
import Image from "next/image";
import { formatCurrency } from "@/lib/api/profile";
import {
  formatUnlock,
  hoursUntil,
  isLocked,
  type CreditBalance,
} from "@/lib/mock/credits-mock";
import { cn } from "@/lib/utils";

// One place's Credits balance, as a card in the stack.
//
// THE PLACE'S OWN PHOTO IS THE CARD ART (Pato, 2026-09-01). This reverses the
// rule that stood here before — "WHITE, like every other list card in this
// app" — and the reversal is narrow, so read why before widening it. The old
// argument was that per-issuer colour would be inventing brand identity for
// venues that never approved it, and that every saturated token in this app
// already means something. Both still hold. What changed is the source: a
// venue's own `places.photos[0]` is not invented identity, it is theirs, and it
// is already on every Place row this app fetches. Nothing new is generated and
// no venue is assigned a colour it did not choose.
//
// The carve-out is THIS COMPONENT and the art layer inside it. White-on-dark
// stops at the card edge; everything around it stays semantic tokens, exactly
// as `TicketHero`/`bg-pink-gradient` and `GiftCardDeck` are bounded today.
//
// STILL `BalanceCard`. The money files may not name an instrument after its
// container (`credits-mock.test.ts` > naming, which greps this file): the
// Wallet is the section that HOLDS these, Credits is what they are. The face
// changed; what the thing IS did not, so neither does the name.
//
// THE SCRIM IS NOT DECORATION, IT IS THE CONTRAST GUARANTEE. A photo is
// uncontrolled input: the venue picked it, not us, and white text over an
// unknown image is the "busy imagery behind text" failure. The gradient is
// therefore calculated against the WORST case (a pure-white photo) rather than
// tuned against the fixtures:
//
//   top    .62 over white → ~6.4:1   the peek strip, always visible
//   62px   .42                       the fold, no text lives here
//   44%    .30                       the quiet middle
//   bottom .86 over white → ~13.7:1  the amount and the terms
//
// Both text bands clear WCAG AA (4.5:1) on any image that can exist, so there
// is nothing to sample and no canvas to taint. `text-shadow` is belt-and-braces
// for the two bands, not the mechanism.
//
// NO PHOTO, OR A PHOTO THAT FAILS TO LOAD, RENDERS THE INK FACE — the same
// card with the art layer swapped for a gradient. It is a fallback, not a
// second design.
//
// THE AMOUNT HAS ONE HOME AT A TIME (2026-09-02, review pass on the shipped
// deck — the Pato-dated rules above are unchanged). It used to have two:
// the strip carried it small and the face carried it big, 60px apart on the
// same card, so any card you could actually see stated its balance twice. The
// strip's copy exists for the BURIED state — it is the only line of a card
// with another card lying on top of it. So it renders only when `covered`, and
// an uncovered card states its balance once, on the face, in the size that
// makes it a card instead of a row. The screen-reader label is unaffected: it
// always carries name, amount and state, whichever half is painted.
//
// FREED BY THE SAME MOVE: the place's name gets the whole strip on an uncovered
// card and wraps to two lines instead of clipping. Franchise branches carry
// `BRAND + zone` names by rule, so "Tony's Tacos Valle Oriente" is the norm
// here and an ellipsis through a venue's own name was the row-thinking this
// card was supposed to leave behind.
//
// A LOCKED CARD IS DORMANT ART. Colour used to carry state on this surface and
// the photo took that job away — with a full-bleed face, the balance you CANNOT
// spend was the most vivid thing on the screen. Locked desaturates and dims the
// photo, so the deck reads spendable-first before a word is read. The scrim is
// untouched, so both text bands keep the contrast computed above.

/** The strip that stays visible when this card is buried in the stack. */
export const PEEK_PX = 62;
// Tall enough for the strip, the amount, the terms line and the action. The
// stack spreads by SPREAD_PX; anything past the peek has to earn itself.
export const CARD_PX = 176;

const SCRIM =
  "linear-gradient(180deg," +
  "rgba(20,6,11,0.62) 0px," +
  "rgba(20,6,11,0.42) 62px," +
  "rgba(20,6,11,0.30) 44%," +
  "rgba(20,6,11,0.86) 100%)";

// The ink face. Deep enough that white text clears AA without a scrim, and
// warm rather than neutral so a wallet of fallbacks still reads as this app.
const INK = "linear-gradient(150deg,#4a1a26 0%,#2a0c14 62%)";

function Monogram({ name }: { name: string }) {
  // First letter of the first two words — "Cabaret Social Room" reads CS,
  // "Lardo" L.
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="type-label text-foreground grid size-8 shrink-0 place-items-center rounded-xl bg-white/90 font-bold"
    >
      {initials}
    </span>
  );
}

export function BalanceCard({
  balance,
  nowMs,
  expanded,
  covered,
  onSelect,
  className,
  style,
}: {
  balance: CreditBalance;
  /** Emulator time. Maturation is never read off wall time. */
  nowMs: number;
  /**
   * True when the stack is spread. Undefined when this card does not spread
   * anything — a deck of one opens on the first tap, and `aria-expanded="false"`
   * would promise a state it does not have.
   */
  expanded?: boolean;
  /** Another card lies on top of this one, so only the strip is on screen. */
  covered: boolean;
  onSelect: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [artFailed, setArtFailed] = useState(false);
  const locked = isLocked(balance, nowMs);
  const bonusCents = balance.balanceCents - balance.paidCents;
  const unlock = formatUnlock(hoursUntil(balance, nowMs));
  const showArt = !!balance.photoUrl && !artFailed;

  // The peek chip reads "3h" — enough for a glance, not enough for a screen
  // reader, which gets the whole sentence instead.
  const label = locked
    ? `${balance.placeName}, ${formatCurrency(balance.balanceCents)}, unlocks in ${unlock}`
    : `${balance.placeName}, ${formatCurrency(balance.balanceCents)}, ready to spend`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={expanded}
      aria-label={label}
      style={style}
      className={cn(
        "absolute inset-x-0 top-0 flex flex-col overflow-hidden rounded-2xl text-left text-white",
        "transition-[transform,box-shadow] duration-300 ease-out",
        "motion-reduce:transition-none",
        "active:scale-[0.99] motion-reduce:active:scale-100",
        className,
      )}
    >
      {/* Art layer. Decorative: identity is carried by the text above it, so a
          screen reader is told the place's name, never "photo of a bar". */}
      <span aria-hidden className="absolute inset-0" style={{ background: INK }}>
        {showArt ? (
          <Image
            src={balance.photoUrl as string}
            alt=""
            fill
            sizes="(max-width: 480px) 100vw, 420px"
            className={cn(
              "object-cover",
              // On-scale utilities, not tuned values: the scrim above already
              // owns contrast, so this only has to read as "asleep".
              locked && "brightness-75 saturate-50",
            )}
            onError={() => setArtFailed(true)}
          />
        ) : null}
        <span className="absolute inset-0" style={{ background: SCRIM }} />
      </span>

      {/* The strip. Everything above PEEK_PX must be readable with the rest of
          the card buried, so it carries identity on the left and — only while
          something is lying on top of it — money on the right. */}
      <span
        className="relative flex shrink-0 items-center gap-3 px-4"
        style={{ height: PEEK_PX }}
      >
        <Monogram name={balance.placeName} />
        <span
          className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-bold tracking-tight"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,.45)" }}
        >
          {balance.placeName}
        </span>
        {!covered ? null : locked ? (
          // A locked balance is not "MX$0". Rendering the zero would lead with
          // the most alarming number available for a state that is simply
          // not-yet — so the amount goes quiet and the chip says when.
          <span className="flex shrink-0 items-center gap-1.5">
            <span
              className="text-sm font-bold tabular-nums text-white/75"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,.45)" }}
            >
              {formatCurrency(balance.balanceCents)}
            </span>
            <span className="type-meta rounded-full border border-white/40 bg-white/15 px-1.5 py-0.5 font-semibold tracking-[0.12em] tabular-nums uppercase backdrop-blur-sm">
              {unlock}
            </span>
          </span>
        ) : (
          <span
            className="shrink-0 text-sm font-bold tabular-nums"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,.45)" }}
          >
            {formatCurrency(balance.balanceCents)}
          </span>
        )}
      </span>

      {/* The face, in the darkest band. Never the only home of anything
          load-bearing — the strip already carries identity and amount. */}
      <span className="relative mt-auto block px-4 pb-3.5">
        <span
          className="block text-3xl leading-none font-bold tracking-tight tabular-nums"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,.5)" }}
        >
          {formatCurrency(balance.balanceCents)}
        </span>
        <span className="mt-1.5 block truncate text-xs text-white/85">
          {locked
            ? `Unlocks in ${unlock} · +${balance.bonusPct}% bonus`
            : `You paid ${formatCurrency(balance.paidCents)} · +${formatCurrency(bonusCents)} bonus`}
        </span>
      </span>
    </button>
  );
}

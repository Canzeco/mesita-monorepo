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

// One place's Credits balance, as a card in the deck.
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
// section HOLDS these, Credits is what they are. The face changed; what the
// thing IS did not, so neither does the name.
//
// THE SCRIM IS NOT DECORATION, IT IS THE CONTRAST GUARANTEE. A photo is
// uncontrolled input: the venue picked it, not us, and white text over an
// unknown image is the "busy imagery behind text" failure. Both gradients below
// are calculated against the WORST case (a pure-white photo) rather than tuned
// against the fixtures, so both text bands clear WCAG AA (4.5:1) on any image
// that can exist. There is nothing to sample and no canvas to taint.
//
//   FULL (the open card)            COVERED (a card with one on top of it)
//   top    .62 → ~6.4:1  the strip  top    .62 → ~6.4:1  the strip
//   62px   .42                      bottom .30           no text lives here
//   44%    .30
//   bottom .86 → ~13.7:1 the face
//
// A COVERED CARD IS A STRIP, NOT A CROPPED CARD (2026-09-02 design review). It
// used to be a full-height card with most of itself hidden under the next one,
// which is why its geometry had to be known in advance and why a wrong constant
// could slice a balance in half. Now it renders only what is on screen and
// sizes to its own content, so nothing can be cut off and nothing has to be
// measured: at 200% text the name takes two taller lines and the strip simply
// grows. `PEEK_PX` and `CARD_PX` are MINIMUMS, not heights.
//
// THE AMOUNT HAS ONE HOME AT A TIME. The strip's copy exists for the COVERED
// state — it is the only line of a card lying under another. The open card
// states its balance once, on the face, in the size that makes it a card
// instead of a row, which also hands the whole strip to the place's name.
//
// FRAUNCES ON THE BALANCE, and only there. `brand.json` assigns the display
// face to "numerals in hero positions" and a card balance is the definitive one
// in this product; Inter here was also the "gave up on typography" signal.
// `tabular-nums` stays, or the digits jitter every time the clock advances.
//
// NO PHOTO, OR A PHOTO THAT FAILS TO LOAD, RENDERS THE INK FACE — the same
// card with the art layer swapped for a gradient. It is a fallback, not a
// second design.
//
// A LOCKED CARD IS DORMANT ART. Colour used to carry state on this surface and
// the photo took that job away — with a full-bleed face, the balance you CANNOT
// spend was the most vivid thing on the screen. Locked desaturates and dims the
// photo, so the deck reads spendable-first before a word is read. The dimming
// sits UNDER the scrim, so it only ever improves contrast.

/** Minimum height of a covered card: the strip, and nothing else. */
export const PEEK_PX = 96;
/** Minimum height of the open card: the strip, the balance and its terms. */
export const CARD_PX = 200;

const SCRIM_FULL =
  "linear-gradient(180deg," +
  "rgba(20,6,11,0.62) 0px," +
  "rgba(20,6,11,0.42) 62px," +
  "rgba(20,6,11,0.30) 44%," +
  "rgba(20,6,11,0.86) 100%)";

// No text lives below the strip on a covered card, so the dark bottom band the
// face needs would be shading nothing. It stops at the same .62 the strip's
// contrast is computed from.
const SCRIM_PEEK =
  "linear-gradient(180deg," +
  "rgba(20,6,11,0.62) 0px," +
  "rgba(20,6,11,0.42) 62px," +
  "rgba(20,6,11,0.30) 100%)";

// The ink face. Deep enough that white text clears AA without a scrim, and
// warm rather than neutral so a deck of fallbacks still reads as this app.
const INK = "linear-gradient(150deg,#4a1a26 0%,#2a0c14 62%)";

export function BalanceCard({
  balance,
  nowMs,
  covered,
  onSelect,
  className,
  style,
}: {
  balance: CreditBalance;
  /** Emulator time. Maturation is never read off wall time. */
  nowMs: number;
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
  // reader, which gets the whole sentence instead. It says the same thing
  // whether the amount is painted small, big, or not at all.
  const label = locked
    ? `${balance.placeName}, ${formatCurrency(balance.balanceCents)}, unlocks in ${unlock}`
    : `${balance.placeName}, ${formatCurrency(balance.balanceCents)}, ready to spend`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      style={{ minHeight: covered ? PEEK_PX : CARD_PX, ...style }}
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-2xl text-left text-white",
        "transition-transform duration-300 ease-out",
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
        <span
          className="absolute inset-0"
          style={{ background: covered ? SCRIM_PEEK : SCRIM_FULL }}
        />
      </span>

      {/* The strip. On a covered card this is the whole card, so it carries
          identity on the left and money on the right. On the open one the money
          moves to the face and the name gets the full width. */}
      <span
        // NOT `grow`. If the strip absorbed the card's free space, the name
        // would centre at a different height on the open card than on the
        // covered ones and the deck would lose its rhythm. It stays PEEK_PX
        // tall on every card; `mt-auto` on the face takes the slack.
        className="relative flex shrink-0 items-center gap-3 px-4 py-4"
        style={{ minHeight: PEEK_PX }}
      >
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
              className="text-sm font-bold text-white/75 tabular-nums"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,.45)" }}
            >
              {formatCurrency(balance.balanceCents)}
            </span>
            <span className="type-meta rounded-full border border-white/40 bg-white/15 px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase tabular-nums backdrop-blur-sm">
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

      {/* The face, in the darkest band. Only the open card has one. */}
      {covered ? null : (
        <span className="relative mt-auto block px-4 pb-3.5">
          <span
            className="font-display block text-4xl leading-none font-bold tracking-tight tabular-nums"
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
      )}
    </button>
  );
}

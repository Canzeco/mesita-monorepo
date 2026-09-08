"use client";

import { useState } from "react";
import Image from "next/image";
import { formatCurrency } from "@/lib/api/profile";
import type { CreditOrgBalance } from "@/lib/api/credits";
import {
  daysUntilExpiry,
  formatActivation,
  formatExpiry,
  headlineCents,
  hoursUntilActivation,
  orgBalanceState,
} from "@/lib/credits";
import { cn } from "@/lib/utils";

// One organization's Credits balance, as a card (MESITA-1674: reads
// consumer-web-list-credit-balances now, not a per-place browser emulator).
//
// ORG-SCOPED, NOT PLACE-SCOPED (MESITA-1671/1674). This card used to render
// one PLACE's balance with that place's own `photos[0]` as its art — the
// carve-out survived review specifically because the photo was the place's
// own, not invented identity. An organization has no photo of its own yet
// (`photoUrl` is always null today, on every card), so every balance renders
// the ink fallback face. The field stays typed rather than removed: an org
// picking up a logo later is a data change, not a component rewrite.
//
// THREE STATES, NOT TWO. Credits used to open Available or Expired only,
// because the buy path never applied the hold it still carries in the schema.
// This read surfaces PENDING lots — any other writer of credit_lots can
// still produce one — so a card can now also open "on its way", with the
// soonest activation time it holds.
//
// THE SCRIM IS NOT DECORATION, IT IS THE CONTRAST GUARANTEE — unchanged from
// the per-place card. Both gradients are computed against a pure-white worst
// case so white text clears AA on any photo that can exist, which matters
// again the day an organization's own art lands here.
//
// A COVERED CARD IS A STRIP, NOT A CROPPED CARD — also unchanged; `covered`
// stays part of the contract even though nothing passes `true` today (the
// deck it served is gone), because the strip-only render is still correct
// shrink-to-content behaviour a future compact list could reuse.

/** How close expiry/activation has to be before the card says so. */
const EXPIRY_NOTICE_DAYS = 14;

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
  balance: CreditOrgBalance;
  nowMs: number;
  /** Another card lies on top of this one, so only the strip is on screen. */
  covered: boolean;
  onSelect: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [artFailed, setArtFailed] = useState(false);
  const photoUrl: string | null = null; // No organization art source exists yet — see header note.
  const state = orgBalanceState(balance);
  const headline = headlineCents(balance);
  const daysLeft = balance.nearestExpiryAt
    ? daysUntilExpiry(Date.parse(balance.nearestExpiryAt), nowMs)
    : null;
  const hoursLeft = balance.nearestActivationAt
    ? hoursUntilActivation(Date.parse(balance.nearestActivationAt), nowMs)
    : null;
  const expiringSoon = state === "spendable" && daysLeft !== null &&
    daysLeft <= EXPIRY_NOTICE_DAYS;
  const showArt = !!photoUrl && !artFailed;

  const stateWord = state === "expired"
    ? "expired"
    : state === "pending"
    ? "on its way"
    : "ready to spend";
  const label =
    `${balance.organizationName}, ${formatCurrency(headline)}, ${stateWord}` +
    (expiringSoon && daysLeft !== null
      ? `, expires in ${formatExpiry(daysLeft)}`
      : state === "pending" && hoursLeft !== null
      ? `, activates in ${formatActivation(hoursLeft)}`
      : "");

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
      {/* Art layer. Decorative: identity is carried by the text above it. */}
      <span aria-hidden className="absolute inset-0" style={{ background: INK }}>
        {showArt ? (
          <Image
            src={photoUrl as string}
            alt=""
            fill
            sizes="(max-width: 480px) 100vw, 420px"
            className={cn("object-cover", state === "expired" && "brightness-50 grayscale")}
            onError={() => setArtFailed(true)}
          />
        ) : null}
        <span
          className="absolute inset-0"
          style={{ background: covered ? SCRIM_PEEK : SCRIM_FULL }}
        />
      </span>

      {/* The strip. */}
      <span
        className="relative flex shrink-0 items-center gap-3 px-4 py-4"
        style={{ minHeight: PEEK_PX }}
      >
        <span
          className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-bold tracking-tight"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,.45)" }}
        >
          {balance.organizationName}
        </span>
        {!covered ? null : (
          <span className="flex shrink-0 items-center gap-1.5">
            <span
              className="text-sm font-bold text-white/75 tabular-nums"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,.45)" }}
            >
              {formatCurrency(headline)}
            </span>
            {state !== "spendable" || expiringSoon ? (
              <span className="type-meta rounded-full border border-white/40 bg-white/15 px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase tabular-nums backdrop-blur-sm">
                {state === "expired"
                  ? "Expired"
                  : state === "pending" && hoursLeft !== null
                  ? formatActivation(hoursLeft)
                  : daysLeft !== null
                  ? formatExpiry(daysLeft)
                  : null}
              </span>
            ) : null}
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
            {formatCurrency(headline)}
          </span>
          <span className="mt-1.5 block truncate text-xs text-white/85">
            {state === "expired"
              ? "Expired · these Credits can no longer be spent"
              : state === "pending"
              ? hoursLeft !== null
                ? `Activates in ${formatActivation(hoursLeft)}`
                : "On its way"
              : expiringSoon && daysLeft !== null
              ? `Expires in ${formatExpiry(daysLeft)}`
              : `You paid ${formatCurrency(balance.paidCents)}`}
            {balance.pendingCents > 0 && state === "spendable"
              ? ` · +${formatCurrency(balance.pendingCents)} on its way`
              : ""}
          </span>
        </span>
      )}
    </button>
  );
}

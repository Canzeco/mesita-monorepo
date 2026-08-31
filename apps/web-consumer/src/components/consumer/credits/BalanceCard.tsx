"use client";

import { formatCurrency } from "@/lib/api/profile";
import {
  formatUnlock,
  isLocked,
  type CreditBalance,
} from "@/lib/mock/credits-mock";
import { cn } from "@/lib/utils";

// One place's Credits balance, as a card in the stack.
//
// WHITE, like every other list card in this app. The Apple Wallet look leans on
// per-issuer colour, but every saturated token here already means something
// (pink = brand, the four metals = class rungs, black = Premium, the IG
// gradient = Instagram) and new ones are generated from brand.json, not
// hand-written. Inventing four gradients would also be inventing brand identity
// for four venues that never approved it. Colour on this surface carries STATE
// and nothing else: foreground spendable, muted locked. Identity is the
// monogram and the name — the same reasoning that put colour on the passport
// alone and left the list underneath a list (MESITA-1132).

/** The strip that stays visible when this card is buried in the stack. */
export const PEEK_PX = 44;
// Tall enough for the strip plus one line of terms and no more. The stack
// spreads by 76px, so the 32px past the peek has to be the terms line — a
// taller card would spend the reveal on empty space and make spreading
// pointless.
export const CARD_PX = 116;

function Monogram({ name }: { name: string }) {
  // First letter of the first two words — "Café Nueve" reads CN, "Lardo" L.
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="bg-muted text-foreground/70 grid size-8 shrink-0 place-items-center rounded-xl text-xs font-bold"
    >
      {initials}
    </span>
  );
}

export function BalanceCard({
  balance,
  expanded,
  onSelect,
  className,
  style,
}: {
  balance: CreditBalance;
  /** True when the stack is spread — controls the card's own aria state. */
  expanded: boolean;
  onSelect: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const locked = isLocked(balance);
  const bonusCents = balance.balanceCents - balance.paidCents;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={expanded}
      style={style}
      className={cn(
        "border-border bg-card absolute inset-x-0 top-0 flex flex-col rounded-2xl border text-left",
        "transition-[transform,box-shadow] duration-300 ease-out",
        "motion-reduce:transition-none",
        "active:scale-[0.99] motion-reduce:active:scale-100",
        className,
      )}
    >
      {/* The strip. Everything above PEEK_PX must be readable with the rest of
          the card buried, so it carries identity on the left and money on the
          right, and nothing else. */}
      <span
        className="flex shrink-0 items-center gap-3 px-4"
        style={{ height: PEEK_PX }}
      >
        <Monogram name={balance.placeName} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight">
          {balance.placeName}
        </span>
        {locked ? (
          // A locked balance is not "MX$0". Rendering the zero would lead with
          // the most alarming number available for a state that is simply
          // not-yet — so the amount goes muted and the chip says when.
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="text-muted-foreground text-sm font-bold tabular-nums">
              {formatCurrency(balance.balanceCents)}
            </span>
            <span className="border-border text-muted-foreground type-meta rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase tabular-nums">
              {formatUnlock(balance.maturesInHours!)}
            </span>
          </span>
        ) : (
          <span className="shrink-0 text-sm font-bold tabular-nums">
            {formatCurrency(balance.balanceCents)}
          </span>
        )}
      </span>

      {/* The terms, directly under the strip so spreading the stack actually
          reveals them. Never the only home of anything load-bearing — the
          strip already carries identity and amount. */}
      <span className="min-h-0 flex-1 px-4">
        <span className="text-muted-foreground block text-xs">
          {locked
            ? `Unlocks in ${formatUnlock(balance.maturesInHours!)} · +${balance.bonusPct}% bonus`
            : `You paid ${formatCurrency(balance.paidCents)} · +${formatCurrency(bonusCents)} bonus`}
        </span>
      </span>
    </button>
  );
}

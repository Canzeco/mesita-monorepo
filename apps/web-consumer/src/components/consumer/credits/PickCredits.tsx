"use client";

import { formatCurrency } from "@/lib/api/profile";
import {
  bonusPctFor,
  CREDIT_PLACES,
  expiryDaysFor,
  type ControlsPolicy,
  type CreditPlace,
} from "@/lib/mock/credits-mock";
import { cn } from "@/lib/utils";

// The two choices Buy and Gift both start with: where, and how much.
//
// SHARED BECAUSE GIFTING IS ISSUANCE (MESITA-1677). A gift is a purchase whose
// balance lands in someone else's wallet — same place, same amounts, same terms
// resolved the same way — so the two screens genuinely ask the same two
// questions. If gifting had been a TRANSFER out of a balance you already hold,
// its first question would have been "from which balance", and none of this
// would be shareable. The shape of this file is the schema decision showing
// through.
//
// Preset amounts rather than a free field: this is a demo of a shape, and a
// numeric keypad on a phone would be three taps of friction for no insight.
export const AMOUNTS = [50_000, 100_000, 200_000];

function PlaceRow({
  place,
  policy,
  selected,
  onSelect,
}: {
  place: CreditPlace;
  policy: ControlsPolicy;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold tracking-tight">
          {place.name}
        </span>
        <span className="text-muted-foreground block text-xs">
          +{bonusPctFor(place, policy)}% · {expiryDaysFor(place, policy)}d to
          spend
        </span>
      </span>
    </button>
  );
}

/** Where the money goes. Seeing the rates side by side is what shows the bonus
 *  is a rate a place CHOSE, not a coupon Mesita printed. */
export function PlacePicker({
  policy,
  placeId,
  onSelect,
  label = "Where",
}: {
  policy: ControlsPolicy;
  placeId: string | null;
  onSelect: (placeId: string) => void;
  label?: string;
}) {
  return (
    <div>
      <div className="type-eyebrow text-muted-foreground mb-2">{label}</div>
      <div className="flex flex-col gap-2">
        {CREDIT_PLACES.map((p) => (
          <PlaceRow
            key={p.id}
            place={p}
            policy={policy}
            selected={p.id === placeId}
            onSelect={() => onSelect(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function AmountPicker({
  value,
  onChange,
  label = "How much",
  amounts = AMOUNTS,
}: {
  value: number;
  onChange: (cents: number) => void;
  label?: string;
  amounts?: number[];
}) {
  return (
    <div>
      <div className="type-eyebrow text-muted-foreground mb-2">{label}</div>
      <div className="flex gap-2">
        {amounts.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onChange(amount)}
            aria-pressed={amount === value}
            className={cn(
              "flex-1 rounded-2xl border py-3 text-sm font-bold tabular-nums transition",
              amount === value
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:bg-muted/50",
            )}
          >
            {formatCurrency(amount)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** What the money becomes. The bonus is the whole trade, so it is stated as a
 *  total the guest can read in one glance, with the arithmetic under it. */
export function TermsPreview({
  eyebrow,
  totalCents,
  detail,
}: {
  eyebrow: string;
  totalCents: number;
  detail: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card rounded-2xl border p-4">
      <div className="type-eyebrow text-muted-foreground">{eyebrow}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
        {formatCurrency(totalCents)}
      </div>
      <div className="text-muted-foreground mt-1 text-xs">{detail}</div>
    </div>
  );
}

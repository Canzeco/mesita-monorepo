"use client";

import { formatCurrency } from "@/lib/api/profile";
import type { ControlsPolicy } from "@/lib/credits";
import { cn } from "@/lib/utils";

// The two choices Buy starts with: where, and how much. Gift asked the same
// two questions while it ran on the browser emulator (gifting is issuance,
// MESITA-1677 — a purchase whose balance lands in someone else's wallet); it
// is parked until its own real backend exists (GiftClient.tsx), so this file
// only serves Buy today. The shape stays reusable for the same reason it was
// shared before: nothing here is Buy-specific.
//
// Preset amounts rather than a free field: a numeric keypad on a phone would
// be three taps of friction for a ladder this short. Mirrors
// supabase/functions/_shared/credits-packages.ts's CREDIT_PACKAGE_CENTS
// exactly — the server validates against that list, not this one, so a drift
// here would only ever show an amount Buy then can't actually charge.
export const AMOUNTS = [50_000, 100_000, 200_000];

export type PickablePlace = { id: string; name: string };

function PlaceRow({
  place,
  policy,
  selected,
  onSelect,
}: {
  place: PickablePlace;
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
          +{policy.defaultBonusPct}% · {policy.defaultExpiryDays}d to spend
        </span>
      </span>
    </button>
  );
}

/**
 * Where the money goes. `places` is always the real list a caller already
 * fetched (consumer-web-list-credit-places) — no per-place bonus/expiry
 * override exists in the schema yet, so every row reads the same console
 * policy rather than a rate the place itself set.
 */
export function PlacePicker({
  policy,
  placeId,
  onSelect,
  places,
  label = "Where",
}: {
  policy: ControlsPolicy;
  placeId: string | null;
  onSelect: (placeId: string) => void;
  places: PickablePlace[];
  label?: string;
}) {
  return (
    <div>
      <div className="type-eyebrow text-muted-foreground mb-2">{label}</div>
      <div className="flex flex-col gap-2">
        {places.map((p) => (
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

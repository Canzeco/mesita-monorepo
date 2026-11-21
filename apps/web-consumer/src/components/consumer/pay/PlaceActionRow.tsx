"use client";

import { cn } from "@/lib/utils";

// A Wallet place (MESITA-4504): one line. The name, and the amount when
// the guest holds credit. Tap selects it for the page's Pay. Tap the
// selected row again to open the place. A gone card does not select.

export function PlaceActionRow({
  name,
  amount,
  subtitle,
  selected = false,
  disabled = false,
  onSelect,
  onOpen,
}: {
  name: string;
  /** Plain amount. Absent when they hold nothing here. */
  amount?: string | null;
  subtitle?: string | null;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  /** The place page. Fires on a second tap, once the row is selected. */
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={disabled ? undefined : selected}
      aria-label={
        disabled
          ? `${name}. ${subtitle ?? "Ask Mesita support to use it."}`
          : selected
            ? `Pay at ${name}. Tap again to open.`
            : `Select ${name}`
      }
      onClick={() => {
        if (disabled) return;
        if (selected) onOpen?.();
        else onSelect?.();
      }}
      className={cn(
        "bg-card flex h-14 w-full items-center gap-3 rounded-xl border px-3 text-left",
        selected ? "border-foreground border-2" : "border-border",
        disabled && "cursor-default",
      )}
      data-wallet-row
      data-selected={selected ? "true" : undefined}
    >
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-base font-semibold">{name}</span>
        {subtitle ? <span className="text-muted-foreground block truncate text-sm">{subtitle}</span> : null}
      </span>
      {amount ? <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">{amount}</span> : null}
    </button>
  );
}

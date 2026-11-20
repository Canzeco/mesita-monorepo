"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// A Wallet row (MESITA-4485): Add Funds, the place, Pay Here or Send Gift.
// The actions are buttons. A disabled one does not navigate.

export function PlaceActionRow({
  name,
  photo,
  subtitle,
  extra,
  left,
  right,
}: {
  name: string;
  photo: ReactNode;
  subtitle?: string | null;
  extra?: ReactNode;
  left: Action;
  right: Action;
}) {
  return (
    <div className="border-border bg-card flex items-center gap-2 rounded-xl border p-3">
      <ActionButton action={left} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {photo}
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-base">{name}</span>
          {subtitle ? <span className="text-muted-foreground block truncate text-sm">{subtitle}</span> : null}
          {extra}
        </span>
      </div>
      <ActionButton action={right} />
    </div>
  );
}

type Action = {
  label: string;
  filled?: boolean;
  disabled?: boolean;
  description?: string;
  onClick: () => void;
};

function ActionButton({ action }: { action: Action }) {
  return (
    <button
      type="button"
      disabled={action.disabled}
      aria-label={action.description ? `${action.label}. ${action.description}` : action.label}
      title={action.description}
      onClick={() => {
        if (!action.disabled) action.onClick();
      }}
      className={cn(
        "h-11 shrink-0 rounded-xl px-3 text-sm whitespace-nowrap",
        action.filled ? "bg-foreground text-background" : "border-border bg-card border",
        action.disabled && "opacity-40",
      )}
    >
      {action.label}
    </button>
  );
}

"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/shared/Skeleton";
import { cn } from "@/lib/utils";

// A Wallet row (MESITA-4497, Pato 2026-11-20): the photo and the place open
// its page, a small "+" adds funds, and one button pays or sends. Pay is the
// only black thing in the row. A control that cannot work is not drawn.
// It was three equal blocks, Add Funds | place | Pay Here (MESITA-4485).

export function PlaceActionRow({
  name,
  photo,
  subtitle,
  extra,
  onOpen,
  add,
  primary,
}: {
  name: string;
  photo: ReactNode;
  subtitle?: string | null;
  extra?: ReactNode;
  /** The photo and the name open the place's page. */
  onOpen?: () => void;
  /** Add Funds. Left out where the place sells no credit. */
  add?: () => void;
  /** Pay or Send. Left out when neither can be done. `wait` draws a bone. */
  primary?: { label: string; spoken: string; filled?: boolean; wait?: boolean; onClick: () => void };
}) {
  const body = (
    <>
      {photo}
      <span className="min-w-0 flex-1">
        {/* Two lines, then cut (MESITA-4498): at 390px "Taquería Orinoco (TEC)" did not fit on one. */}
        <span className="text-foreground line-clamp-2 text-base leading-tight break-words">{name}</span>
        {subtitle ? <span className="text-muted-foreground mt-0.5 block truncate text-sm leading-tight">{subtitle}</span> : null}
        {extra}
      </span>
    </>
  );
  return (
    <div className="flex min-h-[4.25rem] items-center gap-2 py-2 pr-3 pl-4" data-wallet-row>
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-label={`Open ${name}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-3.5 text-left">
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3.5">{body}</div>
      )}
      {add ? (
        <button
          type="button"
          onClick={add}
          aria-label={`Add funds at ${name}`}
          className="border-border bg-card hover:bg-muted/60 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
        >
          <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      {primary?.wait ? (
        <Skeleton className="h-11 w-16 shrink-0 rounded-xl" aria-hidden />
      ) : primary ? (
        <button
          type="button"
          onClick={primary.onClick}
          aria-label={primary.spoken}
          className={cn(
            "flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold whitespace-nowrap",
            primary.filled ? "bg-foreground text-background" : "border-border bg-card hover:bg-muted/60 border",
          )}
        >
          {primary.label}
        </button>
      ) : null}
    </div>
  );
}

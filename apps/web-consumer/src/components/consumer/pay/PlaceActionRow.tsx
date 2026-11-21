"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/shared/Skeleton";
import { cn } from "@/lib/utils";

// A Wallet card (MESITA-4500): two equal lines on one grid.
// Line 1: profile, name, money. Line 2: Offers, Gift, Pay.
// Pay is the only filled control. A disabled control stays in its cell.

export function PlaceActionRow({
  name,
  photo,
  subtitle,
  money,
  onOpen,
  offers,
  gift,
  pay,
}: {
  name: string;
  photo: ReactNode;
  subtitle?: string | null;
  money?: ReactNode;
  /** The profile and the name open the place's page. */
  onOpen?: () => void;
  offers?: Cell;
  gift?: Cell;
  pay?: Cell;
}) {
  return (
    <div
      className="border-border bg-card grid grid-cols-[3.5rem_minmax(0,1fr)_5.25rem_5.25rem] grid-rows-[3.5rem_3.5rem] gap-2 rounded-xl border p-2"
      data-wallet-row
    >
      <span className="row-start-1 flex h-14 w-14 overflow-hidden rounded-xl [&>*]:h-full [&>*]:w-full [&>*]:rounded-xl">{photo}</span>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${name}`}
          className="col-span-2 row-start-1 flex min-w-0 flex-col justify-center text-left"
        >
          <Name name={name} subtitle={subtitle} />
        </button>
      ) : (
        <div className="col-span-2 row-start-1 flex min-w-0 flex-col justify-center">
          <Name name={name} subtitle={subtitle} />
        </div>
      )}
      <div className="col-start-4 row-start-1 flex min-w-0 items-center justify-end overflow-hidden text-right">{money}</div>
      <GridButton label="Offers" cell={offers} className="col-span-2 row-start-2" />
      <GridButton label="Gift" cell={gift} className="col-start-3 row-start-2" />
      <GridButton label="Pay" cell={pay} filled className="col-start-4 row-start-2" />
    </div>
  );
}

function Name({ name, subtitle }: { name: string; subtitle?: string | null }) {
  return (
    <>
      <span className="text-foreground truncate text-base leading-tight font-semibold">{name}</span>
      {subtitle ? <span className="text-muted-foreground truncate text-sm leading-tight">{subtitle}</span> : null}
    </>
  );
}

type Cell = {
  spoken: string;
  disabled?: boolean;
  wait?: boolean;
  onClick: () => void;
};

function GridButton({ label, cell, filled, className }: { label: string; cell?: Cell; filled?: boolean; className?: string }) {
  if (cell?.wait) return <Skeleton className={cn("h-full rounded-xl", className)} aria-hidden />;
  return (
    <button
      type="button"
      disabled={!cell || cell.disabled}
      aria-label={cell?.spoken ?? label}
      onClick={() => {
        if (cell && !cell.disabled) cell.onClick();
      }}
      className={cn(
        "flex h-full items-center justify-center rounded-xl px-2 text-sm font-semibold",
        filled ? "bg-foreground text-background" : "border-border border",
        (!cell || cell.disabled) && "opacity-40",
        className,
      )}
    >
      {label}
    </button>
  );
}

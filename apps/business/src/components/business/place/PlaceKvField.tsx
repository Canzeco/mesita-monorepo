"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const PLACE_KV_BLOCKED_CLASS =
  "rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 text-[13px] leading-snug text-foreground";

export const PLACE_GOOGLE_FIELD_INFO =
  "This field comes from Google and can't be edited here.";

export const PLACE_GOOGLE_LOCATION_INFO =
  "Address and map are synced from Google and can't be edited here.";

function PlaceKvInfo({ message }: { message: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label="Field info"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "text-muted-foreground/70 hover:text-muted-foreground inline-flex h-4 w-4 items-center justify-center rounded-full transition",
          open && "text-foreground bg-muted",
        )}
      >
        <Info className="h-3 w-3" strokeWidth={2.25} />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="border-border/60 bg-background absolute top-full left-0 z-20 mt-1.5 w-52 rounded-lg border px-2.5 py-2 text-[10px] leading-snug font-normal text-foreground shadow-md"
        >
          {message}
        </span>
      ) : null}
    </span>
  );
}

export function PlaceKvField({
  label,
  hint,
  infoMessage,
  value,
  blocked = false,
  children,
  valueClassName,
  className,
}: {
  label: string;
  hint?: string;
  infoMessage?: string;
  value?: string;
  blocked?: boolean;
  children?: React.ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  const empty = !value || value === "—";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground text-[11px] font-medium">
            {label}
          </span>
          {infoMessage ? <PlaceKvInfo message={infoMessage} /> : null}
        </div>
        {hint ? (
          <span className="text-muted-foreground/70 shrink-0 text-[10px] font-normal">
            {hint}
          </span>
        ) : null}
      </div>
      {children ?? (
        <div
          className={cn(
            PLACE_KV_BLOCKED_CLASS,
            blocked && "cursor-default select-none",
            empty && "text-muted-foreground",
            valueClassName,
          )}
        >
          {value || "—"}
        </div>
      )}
    </div>
  );
}

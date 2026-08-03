"use client";

import type React from "react";

import type { PlaceDetail } from "@/lib/mock/place";
import { firstInitial } from "@/lib/utils";

export function ProfilePhoto({ place }: { place: PlaceDetail }) {
  return (
    <div className="border-border h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border">
      {place.photos.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={place.photos[0]}
          alt={place.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="bg-pink-gradient flex h-full w-full items-center justify-center">
          <span className="font-display text-3xl font-bold text-white/80">
            {firstInitial(place.name)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Instagram-style stat cell: big number, small label underneath. */
export function ProfileStat({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center px-0.5 text-center">
      <span className="text-foreground flex items-center gap-0.5 text-[17px] leading-tight font-bold tabular-nums">
        {icon}
        {value}
      </span>
      <span className="text-muted-foreground mt-0.5 max-w-full truncate text-[10px] leading-tight font-medium">
        {label}
      </span>
    </div>
  );
}

/** Light-surface tag chip — same shape language as swipe MetaChip.
 *  Soft pink fill (`bg-background`) so chips read against the white summary. */
export function ProfileMetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-background text-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] whitespace-nowrap tabular-nums">
      {children}
    </span>
  );
}

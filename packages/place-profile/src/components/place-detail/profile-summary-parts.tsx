"use client";

import type React from "react";

import type { PlaceDetail } from "../../place-detail";
import { firstInitial } from "../../lib/format";

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

/** Instagram-style stat: a filled number line, then the channel name.
 *  Zero is a number. "Not connected" and "No count" sit in the number line
 *  so the column is never a blank gap beside the photo. */
export function ProfileStat({
  value,
  detail,
  label,
  icon,
  mention = false,
  name,
}: {
  value: string;
  detail?: string;
  label: string;
  icon?: React.ReactNode;
  mention?: boolean;
  name?: string;
}) {
  const shown = detail ? `${value} ${detail}` : value;
  const spoken = mention ? `${name ?? label}, ${value}` : `${shown} ${label}`;
  return (
    <div
      className="flex min-w-0 flex-col items-center justify-center px-0.5 text-center"
      aria-label={spoken}
    >
      {icon ? <span className="mb-1.5 flex shrink-0">{icon}</span> : null}
      {/* One line, like Maps: "4.9 ★" bold, "(13.8K)" small and muted
          beside it (MESITA-2315). "Not connected" is muted, not shouted. */}
      <span
        className={
          // ONE LINE HEIGHT FOR EVERY COLUMN (MESITA-2623): 24px, so the
          // three labels below sit on one baseline whether the line holds
          // "4.9 ★ (395)" or "Not connected".
          "flex h-6 items-center justify-center leading-none " +
          (mention
            ? "text-muted-foreground text-xs font-medium whitespace-nowrap"
            : "text-foreground text-base font-bold whitespace-nowrap tabular-nums")
        }
      >
        {value}
        {detail ? (
          <span className="text-muted-foreground ml-1 text-xs font-medium">
            {` ${detail}`}
          </span>
        ) : null}
      </span>
      <span className="text-muted-foreground mt-1 max-w-full truncate text-xs leading-tight font-medium">
        {label}
      </span>
    </div>
  );
}

/** Tag chip: a borderless muted pill on the white summary (MESITA-2315).
 *  One fixed height, 32px, and 12px side padding (MESITA-2623), so a chip
 *  with an icon and one without are the same pill. */
export const PROFILE_CHIP_CLASS =
  "bg-muted text-foreground inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs whitespace-nowrap tabular-nums";

export function ProfileMetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className={PROFILE_CHIP_CLASS}>
      {children}
    </span>
  );
}

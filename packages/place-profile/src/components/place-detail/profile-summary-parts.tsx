"use client";

import type React from "react";
import type { LucideIcon } from "lucide-react";

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

/** Instagram-style stat: the network's mark, then a filled number line.
 *  The channel name is read aloud, never printed (MESITA-2623).
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
      {/* NO NETWORK NAME UNDER THE NUMBER (Pato, MESITA-2623: "don't mention
          google instagram facebook with text. its obvious"): the mark above
          already says which network. The name stays for screen readers. */}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** One fact in the header's facts row (MESITA-2629): a small muted icon,
 *  then the fact in 14px medium ink. No fill, no pill, no border: it is
 *  information, and on this screen only buttons wear a fill. `strong`
 *  inks the icon too (an open place's clock). */
export function ProfileFact({
  icon: Icon,
  strong = false,
  children,
  ...rest
}: {
  icon?: LucideIcon;
  strong?: boolean;
  children: React.ReactNode;
} & React.LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className="text-foreground inline-flex min-w-0 items-center gap-1.5 text-sm font-medium whitespace-nowrap tabular-nums"
      {...rest}
    >
      {Icon ? (
        <Icon
          className={
            "h-4 w-4 shrink-0 " +
            (strong ? "text-foreground" : "text-muted-foreground")
          }
          strokeWidth={2}
          aria-hidden
        />
      ) : null}
      {children}
    </li>
  );
}

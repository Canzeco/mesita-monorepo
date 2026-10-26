"use client";

import type React from "react";
import type { LucideIcon } from "lucide-react";

import type { PlaceDetail } from "../../place-detail";
import { cn, firstInitial } from "../../lib/format";
import { PLACE_OUTLINE_CHIP_CLASS } from "../../lib/ui";
import { Spinner } from "../Spinner";

// THE SUMMARY'S PARTS ARE MEASURED ONCE (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"): the photo's frame and a stat column's three classes are read here
// and by ProfileSummarySkeleton, which draws its bones inside them.

/** ProfilePhoto's frame: 88px, rounded-2xl. */
export const PROFILE_PHOTO_FRAME_CLASS = "h-[88px] w-[88px] shrink-0 rounded-2xl";
/** A ProfileStat column. */
export const PROFILE_STAT_CLASS =
  "flex min-w-0 flex-col items-center justify-center px-0.5 text-center";
/** The slot over the number that holds the network's 24px mark. */
export const PROFILE_STAT_MARK_CLASS = "mb-1.5 flex shrink-0";
/** The number line: 24px for every column (MESITA-2623). */
export const PROFILE_STAT_LINE_CLASS =
  "flex h-6 items-center justify-center leading-none";

export function ProfilePhoto({ place }: { place: PlaceDetail }) {
  return (
    <div
      className={cn(
        PROFILE_PHOTO_FRAME_CLASS,
        "border-border overflow-hidden border",
      )}
    >
      {place.photos.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={place.photos[0]}
          alt={place.name}
          className="h-full w-full object-cover"
        />
      ) : (
        // No photo: a grey tile with the initial in Inter ink, the place
        // scale (MESITA-2636); it was a pink gradient with a serif letter.
        <div className="bg-muted flex h-full w-full items-center justify-center">
          <span className="text-muted-foreground font-sans text-3xl font-semibold">
            {firstInitial(place.name)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Instagram-style stat: the network's mark, then a filled number line.
 *  The channel name is read aloud, never printed (MESITA-2623).
 *  Zero is a number. No number shows "-" in the number line (MESITA-2647)
 *  so the column is never a blank gap beside the photo; the screen reader
 *  hears why ("not connected", "no count"). */
export function ProfileStat({
  value,
  detail,
  label,
  icon,
  mention = false,
  spokenValue,
  name,
}: {
  value: string;
  detail?: string;
  label: string;
  icon?: React.ReactNode;
  mention?: boolean;
  spokenValue?: string;
  name?: string;
}) {
  const shown = detail ? `${value} ${detail}` : value;
  const spoken = mention
    ? `${name ?? label}, ${spokenValue ?? value}`
    : `${shown} ${label}`;
  return (
    <div className={PROFILE_STAT_CLASS} aria-label={spoken}>
      {/* NOT CONNECTED IS GREY (Pato, MESITA-2676: "if no Instagram or no
          Facebook, the icon must be grey-scale, not colour"): the mark loses
          its colour and half its weight. Since MESITA-2678 ("you must have
          both the link and its numbers to have colour") any "-" column is
          grey, a linked channel with no count included. */}
      {icon ? (
        <span
          className={
            PROFILE_STAT_MARK_CLASS + (mention ? " opacity-50 grayscale" : "")
          }
        >
          {icon}
        </span>
      ) : null}
      {/* One line, like Maps: "4.9 ★" bold, "(13.8K)" small and muted
          beside it (MESITA-2315). "-" is muted, not shouted. */}
      <span
        className={
          // ONE LINE HEIGHT FOR EVERY COLUMN (MESITA-2623): 24px, so the
          // three labels below sit on one baseline whether the line holds
          // "4.9 ★ (395)" or "-". Joined by hand, not cn(): tailwind-merge
          // would let text-base drop leading-none.
          PROFILE_STAT_LINE_CLASS +
          " " +
          (mention
            ? "text-muted-foreground text-base font-bold whitespace-nowrap"
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

/** One fact in the header's facts row: a small muted icon, then the fact
 *  in 14px medium ink, INSIDE AN OUTLINED BOX (Pato, MESITA-2633: "put them
 *  inside boxes but must not look as a button"): a 1px hairline, no fill,
 *  rounded-lg, 32px. Outlined is information; filled is a button, and on
 *  this screen only buttons wear a fill. `strong` inks the icon too (an
 *  open place's clock). `className` overrides the box (Creating's blue). */
export function ProfileFact({
  icon: Icon,
  emoji,
  strong = false,
  className,
  children,
  ...rest
}: {
  icon?: LucideIcon;
  /** Drawn where the icon goes (a category's own emoji, MESITA-2813). */
  emoji?: string | null;
  strong?: boolean;
  children: React.ReactNode;
} & React.LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn(PLACE_OUTLINE_CHIP_CLASS, className)}
      {...rest}
    >
      {emoji ? (
        <span className="shrink-0 text-base leading-none" aria-hidden>
          {emoji}
        </span>
      ) : Icon ? (
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

/** Work in flight, the first fact of the row: a small spinner where the
 *  icon goes, then the word. Enriching (MESITA-451) is outlined like every
 *  fact, its spinner topped emerald. CREATING IS `loud` (Pato, MESITA-2682:
 *  "add some fucking color. it must be noticable"): a solid blue box, the
 *  map's guest blue (blue-600, #2563eb), the word and the spinner white.
 *  Red would read as closed and green as open, so blue. Enriching stays
 *  outlined: on this screen colour goes only where Pato names it. */
export function RunningFact({
  label,
  loud = false,
}: {
  label: string;
  loud?: boolean;
}) {
  return (
    <ProfileFact
      aria-live="polite"
      className={
        loud ? "text-paper border-blue-600 bg-blue-600 font-semibold" : undefined
      }
    >
      <Spinner
        size="sm"
        label={label}
        className={
          loud
            ? "border-paper/35 border-t-paper h-3.5 w-3.5"
            : "border-border h-3.5 w-3.5 border-t-emerald-600"
        }
      />
      {label}
    </ProfileFact>
  );
}

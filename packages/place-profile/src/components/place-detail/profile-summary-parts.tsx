"use client";

import type React from "react";
import { Star, type LucideIcon } from "lucide-react";

import type { PlaceDetail } from "../../place-detail";
import { cn, firstInitial } from "../../lib/format";
import {
  PLACE_FIGURE_CLASS,
  PLACE_OUTLINE_CHIP_CLASS,
} from "../../lib/ui";
import { Spinner } from "../Spinner";
import { SizedImg } from "../SizedPhoto";

// THE SUMMARY'S PARTS ARE MEASURED ONCE (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"): the photo's frame and a stat column's three classes are read here
// and by ProfileSummarySkeleton, which draws its bones inside them.

/** ProfilePhoto's frame: 88px, a circle (Pato, MESITA-3432: "make the
 *  profile picture circular"; rounded-xl until then). */
export const PROFILE_PHOTO_FRAME_CLASS = "h-[88px] w-[88px] shrink-0 rounded-full";
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
      {/* The profile picture (MESITA-3528): the owner's pick, else the cover. */}
      {place.profilePhoto ? (
        <SizedImg
          src={place.profilePhoto}
          size="thumb"
          alt={place.name}
          className="h-full w-full object-cover"
        />
      ) : (
        // No photo: a grey tile with the initial in Inter, muted, at the
        // scale's one big size (MESITA-2636; 30px until MESITA-3379); it was
        // a pink gradient with a serif letter.
        <div className="bg-muted flex h-full w-full items-center justify-center">
          <span className={cn(PLACE_FIGURE_CLASS, "text-muted-foreground font-sans")}>
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
  unitIcon: UnitIcon,
  unit,
  mention = false,
  spokenValue,
  name,
}: {
  value: string;
  detail?: string;
  label: string;
  icon?: React.ReactNode;
  /** What the count counts, drawn hugging the number on its left (Pato,
   *  MESITA-3447: "icons at the left, k or amount at the right, not
   *  spaces"): a reviews mark for Google, a followers mark for Instagram
   *  and Facebook. */
  unitIcon?: LucideIcon;
  /** The word read aloud after the count: "reviews", "followers". */
  unit?: string;
  mention?: boolean;
  spokenValue?: string;
  name?: string;
}) {
  const shown = detail ? `${value} ${detail} stars` : value;
  const spoken = mention
    ? `${name ?? label}, ${spokenValue ?? value}`
    : `${shown} ${label}${unit ? ` ${unit}` : ""}`;
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
      {/* ONE BOLD LINE (MESITA-3355): the value, then the detail at the same
          size with a filled star in the ink hugging it, Google's "11K 4.7★"
          (dark since MESITA-3358, Pato: "make google star dark again";
          amber for an hour)
          (Pato: "same text for stars ... in the same line, not below ...
          an actual star, yellow"); a small line under the value for an
          hour (MESITA-3351), "4.9 ★ (13.8K)" before. "-" is muted. */}
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
        {UnitIcon ? (
          <UnitIcon className="mr-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
        ) : null}
        {value}
        {detail ? (
          <span className="ml-1.5 inline-flex items-center gap-0.5">
            {detail}
            <Star className="h-4 w-4 fill-current" aria-hidden />
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
  iconClassName,
  className,
  children,
  ...rest
}: {
  icon?: LucideIcon;
  /** The icon's own colour (MESITA-3440: money green, star amber, clock
   *  green or red, zone red, distance blue, as on the Home tile). */
  iconClassName?: string;
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
        <span className="shrink-0 text-sm leading-none" aria-hidden>
          {emoji}
        </span>
      ) : Icon ? (
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            iconClassName ?? (strong ? "text-foreground" : "text-muted-foreground"),
          )}
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
 *  Red would read as closed and green as open, so blue. ENRICHING IS THE
 *  SAME SOLID BOX IN GREEN (Pato, MESITA-2812: "enriching tag must be color
 *  background green just as creating"), the emerald its spinner carried. */
export function RunningFact({
  label,
  tone,
}: {
  label: string;
  tone: "blue" | "green";
}) {
  return (
    <ProfileFact
      aria-live="polite"
      className={cn(
        "text-paper font-semibold",
        tone === "blue"
          ? "border-blue-600 bg-blue-600"
          : "border-emerald-600 bg-emerald-600",
      )}
    >
      <Spinner
        size="sm"
        label={label}
        className="border-paper/35 border-t-paper h-3.5 w-3.5"
      />
      {label}
    </ProfileFact>
  );
}

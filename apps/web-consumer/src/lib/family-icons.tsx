// The consumer app's family marks: monochrome line icons, never emoji
// (Pato, MESITA-2478: "emojis uses color and that takes attention"). The
// app is ink on white; an emoji was the only color besides photos.
//
// CONSUMER ONLY. The family list and its emoji (lib/place-families.ts) are
// unchanged, and admin keeps showing the emoji. This file maps a key to the
// icon the guest sees: Home's column, Search's chips, and the Google card
// with no photo. Icons draw in `currentColor`; callers pick the stroke
// (1.75, the chosen row 2.25 — BottomNav's pair).

import { createElement, type ComponentType, type SVGProps } from "react";
import {
  Beef,
  Beer,
  CakeSlice,
  Clapperboard,
  Coffee,
  Croissant,
  Dices,
  Drumstick,
  EggFried,
  Fish,
  Gamepad2,
  Hamburger,
  HandPlatter,
  Heart,
  Landmark,
  MicVocal,
  Moon,
  Music,
  Pizza,
  Salad,
  Shrimp,
  Star,
  Users,
  Utensils,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

export type LineIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;

/** Lucide has no mark for these families, so each is drawn in lucide's own
 *  24px grid, stroke and caps and sits beside the others (MESITA-2953). */
function drawnIcon(name: string, paths: readonly string[]) {
  function DrawnIcon({
    className,
    strokeWidth = 2,
    ...rest
  }: SVGProps<SVGSVGElement>) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...rest}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  }
  DrawnIcon.displayName = name;
  return DrawnIcon;
}

/** A folded shell and its filling. */
export const Taco = drawnIcon("Taco", [
  "M2 18a10 10 0 0 1 20 0Z",
  "M6 12c1-1.5 2-.5 3-1.5s2 .5 3-1 2 .5 3-1 2 .5 3 1",
]);

/** A one-country cuisine wears its country's flag (Pato, MESITA-3108 for
 *  Mexican, MESITA-3129 for the rest: "same style across all icons"). Every
 *  flag shares this outline and is told apart by what is inside it. */
const FLAG_OUTLINE =
  "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z";

function flagIcon(name: string, inside: readonly string[]) {
  return drawnIcon(name, [FLAG_OUTLINE, ...inside]);
}

/** Three bands and the eagle's round emblem in the middle one: 🇲🇽. */
const MexicanFlag = flagIcon("MexicanFlag", [
  "M9 5v14",
  "M15 5v14",
  "M10.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0",
]);

/** Three bands, no emblem: 🇮🇹. */
const ItalianFlag = flagIcon("ItalianFlag", ["M9 5v14", "M15 5v14"]);

/** The disc: 🇯🇵. */
const JapaneseFlag = flagIcon("JapaneseFlag", [
  "M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
]);

/** The great star at the hoist: 🇨🇳. */
const ChineseFlag = flagIcon("ChineseFlag", [
  "M8.5 7.5 9.35 9.83 11.83 9.92 9.88 11.45 10.56 13.83 8.5 12.45 6.44 13.83 7.12 11.45 5.17 9.92 7.65 9.83Z",
]);

/** Three stripes and the wheel in the middle one: 🇮🇳. */
const IndianFlag = flagIcon("IndianFlag", [
  "M3 9.7h18",
  "M3 14.3h18",
  "M10.8 12a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0",
]);

/** The ring of stars, eight so they stay apart at chip size: 🇪🇺. */
const EuropeanFlag = flagIcon("EuropeanFlag", [
  "M16 12h.01",
  "M14.83 14.83h.01",
  "M12 16h.01",
  "M9.17 14.83h.01",
  "M8 12h.01",
  "M9.17 9.17h.01",
  "M12 8h.01",
  "M14.83 9.17h.01",
]);

/** The canton and the stripes: 🇺🇸. */
const AmericanFlag = flagIcon("AmericanFlag", [
  "M11 5v7",
  "M11 8.5h10",
  "M3 12h18",
  "M3 15.5h18",
]);

/** A bowl and its chopsticks: Asian. */
const NoodleBowl = drawnIcon("NoodleBowl", [
  "M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z",
  "M13 9.5 20 3",
  "M10 9.5 15.5 2.5",
]);

/** Three chunks on a skewer: Arabic. */
const Kebab = drawnIcon("Kebab", [
  "M2.5 21.5 6.3 17.7",
  "M8.7 15.3l2.1-2.1",
  "M13.2 10.8l2.1-2.1",
  "M17.7 6.3l3.8-3.8",
  "M10.8 17.4 6.6 13.2 4.2 15.6 8.4 19.8Z",
  "M15.3 12.9 11.1 8.7 8.7 11.1 12.9 15.3Z",
  "M19.8 8.4 15.6 4.2 13.2 6.6 17.4 10.8Z",
]);

/** A grown-up and a child: Family. Social's Users is two equals. */
const ParentAndChild = drawnIcon("ParentAndChild", [
  "M9 3.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  "M3 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 3.5 1.4",
  "M18 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  "M14.5 21v-1a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3v1",
]);

/** A soccer ball: Sports. */
const SoccerBall = drawnIcon("SoccerBall", [
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
  "M12 8.5l3.3 2.4-1.2 3.9H9.9l-1.2-3.9Z",
  "M12 8.5V2",
  "M15.3 10.9l6.2-2",
  "M14.1 14.8l3.8 5.3",
  "M9.9 14.8l-3.8 5.3",
  "M8.7 10.9l-6.2-2",
]);

/** Bowl, tray, stem, base and hose: Hookah. */
const Hookah = drawnIcon("Hookah", [
  "M10 2.5h4l-.5 3h-3Z",
  "M8 7h8",
  "M12 5.5v9.5",
  "M12 15a3.5 3.5 0 0 0-3.5 3.5c0 1 .4 1.9 1 2.5h5c.6-.6 1-1.5 1-2.5A3.5 3.5 0 0 0 12 15Z",
  "M12 11c3.5 0 6 1.5 6 4.5 0 2-1 3.5-2 4.5",
]);

/** A hanging mirror ball and a glint: Club's 🪩. */
const DiscoBall = drawnIcon("DiscoBall", [
  "M12 2v4",
  "M12 6a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z",
  "M4.5 13.5h15",
  "M5.4 10h13.2",
  "M5.4 17h13.2",
  "M12 6c-2 2-3.2 4.7-3.2 7.5S10 19 12 21",
  "M12 6c2 2 3.2 4.7 3.2 7.5S14 19 12 21",
  "M19.5 2.5v3",
  "M18 4h3",
]);

/** A lotus: Spa. */
const Lotus = drawnIcon("Lotus", [
  "M12 20c-2.5-2-3.5-5-3.5-8S10 6.5 12 4.5c2 2 3.5 4.5 3.5 7.5s-1 6-3.5 8Z",
  "M12 20c-4.5 0-8.5-2.5-9.5-7.5 2.5-.5 5 .3 6.5 1.8",
  "M12 20c4.5 0 8.5-2.5 9.5-7.5-2.5-.5-5 .3-6.5 1.8",
]);

/** A family with no icon of its own. */
export const FALLBACK_FAMILY_ICON: LineIcon = Utensils;

/** Every row and chip key the guest sees → its line icon. All (Search's
 *  chip, MESITA-2502; Home's row, MESITA-2516), Home's Social and Saved by
 *  their chip keys; families by their family key. Each mark names the thing
 *  a guest goes there for, as its emoji does (MESITA-2953: a grape for
 *  Italian, wind for Hookah and a TV for Sports did not). A one-country
 *  cuisine is the exception: it wears its flag (MESITA-3129). */
export const FAMILY_ICONS: Readonly<Record<string, LineIcon>> = {
  // Top (MESITA-2534) wears a star (Pato, MESITA-2557: fire "feels like
  // trending"); before that fire, a trending-up arrow, a grid of everything.
  all: Star,
  social: Users,
  saved: Heart,
  coffee: Coffee,
  breakfast: EggFried,
  bakery: Croissant,
  sweet: CakeSlice,
  healthy: Salad,
  quick_bite: Zap,
  tacos: Taco,
  burgers: Hamburger,
  pizza: Pizza,
  chicken: Drumstick,
  sushi: Fish,
  mexican: MexicanFlag,
  steak: Beef,
  seafood: Shrimp,
  italian: ItalianFlag,
  japanese: JapaneseFlag,
  chinese: ChineseFlag,
  asian: NoodleBowl,
  indian: IndianFlag,
  arabic: Kebab,
  european: EuropeanFlag,
  american: AmericanFlag,
  dinner: UtensilsCrossed,
  fancy: HandPlatter,
  family: ParentAndChild,
  drinks: Beer,
  sports: SoccerBall,
  hookah: Hookah,
  night_out: Moon,
  nightclub: DiscoBall,
  music: Music,
  karaoke: MicVocal,
  fun: Gamepad2,
  cinema: Clapperboard,
  casino: Dices,
  spa: Lotus,
  tourist: Landmark,
};

/** The icon for a row, chip or family key; Utensils when it has none. */
export function familyIcon(key: string): LineIcon {
  return FAMILY_ICONS[key] ?? FALLBACK_FAMILY_ICON;
}

/** Draws the icon for `name` (a row, chip or family key). One stable
 *  component, so a caller never creates one during render. */
export function FamilyIcon({
  name,
  className,
  strokeWidth = 1.75,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  return createElement(familyIcon(name), {
    className,
    strokeWidth,
    "aria-hidden": true,
  });
}

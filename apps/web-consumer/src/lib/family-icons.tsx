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
  Soup,
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

/** A chili pepper and its stem: Mexican's 🌶️. Never fire, which reads as
 *  trending (MESITA-2557). */
const Chili = drawnIcon("Chili", [
  "M4 8c0 7 6 13 16.5 13.5-4-3-6.5-7.5-7.5-13",
  "M4 8c2.5-1.5 7-1.5 9 .5",
  "M8.5 7.3c0-2.3 1-4 3-4.8",
]);

/** Spaghetti wound on a fork over its bowl: Italian's 🍝. */
const Pasta = drawnIcon("Pasta", [
  "M4 15h16c0 3.3-3.6 6-8 6s-8-2.7-8-6Z",
  "M12 9.5V3",
  "M10 2.5v2.5a2 2 0 0 0 4 0V2.5",
  "M8.5 9.5c0-.8 1.6-1.5 3.5-1.5s3.5.7 3.5 1.5-1.6 1.5-3.5 1.5-3.5-.7-3.5-1.5Z",
  "M9 11c-.6 1.2.4 2.8-.2 4",
  "M15 11c.6 1.2-.4 2.8.2 4",
]);

/** A rice triangle in its nori band: Japanese. */
const Onigiri = drawnIcon("Onigiri", [
  "M10.3 4.6 3.8 15.9C2.6 18 4 20.5 6.4 20.5h11.2c2.4 0 3.8-2.5 2.6-4.6L13.7 4.6a2 2 0 0 0-3.4 0Z",
  "M9 20.5V15h6v5.5",
]);

/** The folded takeout pail and its wire handle: Chinese's 🥡. */
const TakeoutBox = drawnIcon("TakeoutBox", [
  "M5.5 10h13L17 21H7Z",
  "M5.5 10 8 5.5h8l2.5 4.5",
  "M8 5.5 10 10",
  "M16 5.5 14 10",
  "M8.5 5.5C8.5 3.5 10 2 12 2s3.5 1.5 3.5 3.5",
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

/** European's 🥨: one rope, its ends crossed onto the belly. */
const Pretzel = drawnIcon("Pretzel", [
  "M15.5 18 12 12.5C10.5 10 10 5 7 5 4.5 5 3 7 3 10c0 5.5 4 10.5 9 10.5s9-5 9-10.5c0-3-1.5-5-4-5-3 0-3.5 5-5 7.5L8.5 18",
]);

/** A carton of fries: American's 🍟. */
const Fries = drawnIcon("Fries", [
  "M5.5 10.5 7 21h10l1.5-10.5",
  "M5.5 10.5c4 2.5 9 2.5 13 0",
  "M8 11.5 7 4",
  "M10.5 12V3",
  "M13.5 12V3",
  "M16 11.5 17 4",
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
 *  Italian, a flag for American, wind for Hookah and a TV for Sports did
 *  not). */
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
  mexican: Chili,
  steak: Beef,
  seafood: Shrimp,
  italian: Pasta,
  japanese: Onigiri,
  chinese: TakeoutBox,
  asian: NoodleBowl,
  indian: Soup,
  arabic: Kebab,
  european: Pretzel,
  american: Fries,
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

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
  Bean,
  Beef,
  Beer,
  Bird,
  CakeSlice,
  Castle,
  ChefHat,
  Citrus,
  Coffee,
  Cookie,
  CookingPot,
  Croissant,
  Disc3,
  Donut,
  Drumstick,
  Egg,
  EggFried,
  Fish,
  Flag,
  Flame,
  Gem,
  Globe,
  Grape,
  Guitar,
  Ham,
  Hamburger,
  Heart,
  Hop,
  IceCreamCone,
  LeafyGreen,
  Martini,
  Mic,
  Moon,
  Music,
  Nut,
  Origami,
  Pizza,
  Salad,
  Sandwich,
  Shrimp,
  Soup,
  Star,
  Sun,
  Tv,
  Users,
  Utensils,
  UtensilsCrossed,
  Vegan,
  Wheat,
  Wind,
  Wine,
  Zap,
} from "lucide-react";

export type LineIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;

/** Lucide has no taco: a folded shell and its filling, drawn in lucide's
 *  own 24px grid, stroke and caps so it sits beside the others. */
export function Taco({
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
      <path d="M2 18a10 10 0 0 1 20 0Z" />
      <path d="M6 12c1-1.5 2-.5 3-1.5s2 .5 3-1 2 .5 3-1 2 .5 3 1" />
    </svg>
  );
}

/** A family with no icon of its own. */
export const FALLBACK_FAMILY_ICON: LineIcon = Utensils;

/** Every row and chip key the guest sees → its line icon. All (Search's
 *  chip, MESITA-2502; Home's row, MESITA-2516), Home's Social and Saved by
 *  their chip keys; families by their family key. */
export const FAMILY_ICONS: Readonly<Record<string, LineIcon>> = {
  // Top (MESITA-2534) wears a star (Pato, MESITA-2557: fire "feels like
  // trending"); before that fire, a trending-up arrow, a grid of everything.
  all: Star,
  social: Users,
  saved: Heart,
  coffee: Coffee,
  breakfast: EggFried,
  brunch: Egg,
  bakery: Donut,
  sweet: CakeSlice,
  gelato: IceCreamCone,
  healthy: Salad,
  vegan: Vegan,
  quick_bite: Zap,
  tacos: Taco,
  mexican: Flame,
  burgers: Hamburger,
  pizza: Pizza,
  chicken: Drumstick,
  wings: Bird,
  sandwiches: Sandwich,
  kebab: Nut,
  arabic: Bean,
  sushi: Fish,
  japanese: Origami,
  ramen: Soup,
  noodles: Utensils,
  korean: CookingPot,
  chinese: ChefHat,
  dumplings: Cookie,
  thai: Citrus,
  indian: Wheat,
  asian: LeafyGreen,
  bbq: Ham,
  steak: Beef,
  seafood: Shrimp,
  italian: Grape,
  french: Croissant,
  mediterranean: Sun,
  spanish: Guitar,
  european: Castle,
  american: Flag,
  latin: Globe,
  dinner: UtensilsCrossed,
  fancy: Gem,
  drinks: Beer,
  beer: Hop,
  cocktails: Martini,
  wine: Wine,
  sports: Tv,
  hookah: Wind,
  nightclub: Disc3,
  night_out: Moon,
  karaoke: Mic,
  music: Music,
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

// The guest's family marks: coloured duotone icons, never emoji (Pato,
// 2026-11-23, MESITA-4782: "keep icons with colors but from another source,
// not emojies … looks like AI slop"). Phosphor's duotone set draws most of
// them; the few it lacks are drawn below on the same 24px grid, 1.5px
// stroke and 20% fill, so they sit beside Phosphor's.
//
// CONSUMER ONLY. The family list and its emoji (lib/place-families.ts) stay
// the data admin and business show. Home's strip and menu, Search's chips
// and Search's families sheet draw `FamilyMark`: the icon in its family's
// colour, white on the chosen ink circle.

import type { CSSProperties, ReactNode, SVGProps } from "react";
import {
  BeerStein,
  Bread,
  BowlSteam,
  Cake,
  Champagne,
  Coffee,
  CookingPot,
  Cow,
  DiceFive,
  EggCrack,
  FishSimple,
  Flag,
  ForkKnife,
  GameController,
  Hamburger,
  Heart,
  Leaf,
  Lightning,
  MapPin,
  Moon,
  MusicNotes,
  Pizza,
  Shrimp,
  Smiley,
  Sparkle,
  Star,
} from "@phosphor-icons/react/ssr";

type IconProps = { size?: number; color?: string; className?: string };
export type FamilyIconComponent = (props: IconProps) => ReactNode;

/** Phosphor's duotone weight, the one every family wears. */
function phosphor(Icon: typeof Star): FamilyIconComponent {
  function PhosphorMark({ size, color, className }: IconProps) {
    return <Icon size={size} color={color} weight="duotone" className={className} />;
  }
  PhosphorMark.displayName = `Phosphor(${Icon.displayName ?? "Icon"})`;
  return PhosphorMark;
}

/** Phosphor has no mark for these families, so each is drawn on its grid:
 *  the outline at 1.5px and its body (`fills`) at Phosphor's 20% duotone. */
function drawnIcon(
  name: string,
  paths: readonly string[],
  fills: readonly string[] = [],
): FamilyIconComponent {
  function DrawnIcon({ size = 24, color = "currentColor", className }: IconProps & SVGProps<SVGSVGElement>) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        {fills.map((d) => (
          <path key={`f${d}`} d={d} fill={color} fillOpacity={0.2} stroke="none" />
        ))}
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
export const Taco = drawnIcon(
  "Taco",
  ["M2 18a10 10 0 0 1 20 0Z", "M6 12c1-1.5 2-.5 3-1.5s2 .5 3-1 2 .5 3-1 2 .5 3 1"],
  ["M2 18a10 10 0 0 1 20 0Z"],
);

/** Spaghetti wound on a fork over its bowl: Italian's 🍝. */
const Pasta = drawnIcon("Pasta", [
  "M4 15h16c0 3.3-3.6 6-8 6s-8-2.7-8-6Z",
  "M12 9.5V3",
  "M10 2.5v2.5a2 2 0 0 0 4 0V2.5",
  "M8.5 9.5c0-.8 1.6-1.5 3.5-1.5s3.5.7 3.5 1.5-1.6 1.5-3.5 1.5-3.5-.7-3.5-1.5Z",
  "M9 11c-.6 1.2.4 2.8-.2 4",
  "M15 11c.6 1.2-.4 2.8.2 4",
], [
  "M4 15h16c0 3.3-3.6 6-8 6s-8-2.7-8-6Z",
]);

/** A rice triangle in its nori band: Japanese. */
const Onigiri = drawnIcon("Onigiri", [
  "M10.3 4.6 3.8 15.9C2.6 18 4 20.5 6.4 20.5h11.2c2.4 0 3.8-2.5 2.6-4.6L13.7 4.6a2 2 0 0 0-3.4 0Z",
  "M9 20.5V15h6v5.5",
], [
  "M10.3 4.6 3.8 15.9C2.6 18 4 20.5 6.4 20.5h11.2c2.4 0 3.8-2.5 2.6-4.6L13.7 4.6a2 2 0 0 0-3.4 0Z",
]);

/** The folded takeout pail and its wire handle: Chinese's 🥡. */
const TakeoutBox = drawnIcon("TakeoutBox", [
  "M5.5 10h13L17 21H7Z",
  "M5.5 10 8 5.5h8l2.5 4.5",
  "M8 5.5 10 10",
  "M16 5.5 14 10",
  "M8.5 5.5C8.5 3.5 10 2 12 2s3.5 1.5 3.5 3.5",
], [
  "M5.5 10h13L17 21H7Z",
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
], [
  "M10.8 17.4 6.6 13.2 4.2 15.6 8.4 19.8Z",
]);

/** European's 🥨: one rope, its ends crossed onto the belly. */
const Pretzel = drawnIcon("Pretzel", [
  "M15.5 18 12 12.5C10.5 10 10 5 7 5 4.5 5 3 7 3 10c0 5.5 4 10.5 9 10.5s9-5 9-10.5c0-3-1.5-5-4-5-3 0-3.5 5-5 7.5L8.5 18",
], [
  "M12 20.5c5 0 9-5 9-10.5 0-3-1.5-5-4-5-3 0-3.5 5-5 7.5C10.5 10 10 5 7 5 4.5 5 3 7 3 10c0 5.5 4 10.5 9 10.5Z",
]);

/** A carton of fries: American's 🍟. */
const Fries = drawnIcon("Fries", [
  "M5.5 10.5 7 21h10l1.5-10.5",
  "M5.5 10.5c4 2.5 9 2.5 13 0",
  "M8 11.5 7 4",
  "M10.5 12V3",
  "M13.5 12V3",
  "M16 11.5 17 4",
], [
  "M5.5 10.5 7 21h10l1.5-10.5c-4 2.5-9 2.5-13 0Z",
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
], [
  "M12 6a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z",
]);

/** Lucide's drumstick on this grid: Wings' 🍗. */
const Drumstick = drawnIcon(
  "Drumstick",
  [
    "M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23",
    "m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59",
  ],
  ["M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23"],
);

type Mark = { icon: FamilyIconComponent; color: string };

/** Every row and chip key the guest sees → its icon and colour. Each mark
 *  names the thing a guest goes there for, as its emoji does; the colours
 *  are the food's own (coffee brown, salad green, chili red), deep enough
 *  to read on white. */
export const FAMILY_MARKS: Readonly<Record<string, Mark>> = {
  // The specials.
  saved: { icon: phosphor(Heart), color: "#E11D48" },
  social: { icon: phosphor(Smiley), color: "#F59E0B" },
  near: { icon: phosphor(MapPin), color: "#2563EB" },
  nearby: { icon: phosphor(MapPin), color: "#2563EB" },
  all: { icon: phosphor(Star), color: "#EAB308" },
  // The thirty families.
  dinner: { icon: phosphor(ForkKnife), color: "#475569" },
  coffee: { icon: phosphor(Coffee), color: "#92400E" },
  drinks: { icon: phosphor(BeerStein), color: "#D97706" },
  quick_bite: { icon: phosphor(Lightning), color: "#EAB308" },
  breakfast: { icon: phosphor(EggCrack), color: "#F59E0B" },
  mexican: { icon: phosphor(Flag), color: "#15803D" },
  tacos: { icon: Taco, color: "#EA580C" },
  seafood: { icon: phosphor(Shrimp), color: "#F97316" },
  asian: { icon: phosphor(BowlSteam), color: "#DC2626" },
  european: { icon: Pretzel, color: "#B45309" },
  fancy: { icon: phosphor(Champagne), color: "#9333EA" },
  steak: { icon: phosphor(Cow), color: "#B91C1C" },
  japanese: { icon: Onigiri, color: "#0F766E" },
  american: { icon: Fries, color: "#DC2626" },
  healthy: { icon: phosphor(Leaf), color: "#16A34A" },
  italian: { icon: Pasta, color: "#CA8A04" },
  sushi: { icon: phosphor(FishSimple), color: "#0284C7" },
  pizza: { icon: phosphor(Pizza), color: "#EA580C" },
  burgers: { icon: phosphor(Hamburger), color: "#A16207" },
  arabic: { icon: Kebab, color: "#C2410C" },
  chinese: { icon: TakeoutBox, color: "#DC2626" },
  indian: { icon: phosphor(CookingPot), color: "#D97706" },
  chicken: { icon: Drumstick, color: "#C2410C" },
  sweet: { icon: phosphor(Cake), color: "#DB2777" },
  night_out: { icon: phosphor(Moon), color: "#4F46E5" },
  bakery: { icon: phosphor(Bread), color: "#B45309" },
  nightclub: { icon: DiscoBall, color: "#7C3AED" },
  music: { icon: phosphor(MusicNotes), color: "#DB2777" },
  fun: { icon: phosphor(GameController), color: "#0891B2" },
  casino: { icon: phosphor(DiceFive), color: "#059669" },
};

/** A key with no mark of its own. */
export const FALLBACK_FAMILY_MARK: Mark = { icon: phosphor(Sparkle), color: "#64748B" };

/** The mark for a row, chip or family key; a grey sparkle when it has none. */
export function familyMark(key: string): Mark {
  return FAMILY_MARKS[key] ?? FALLBACK_FAMILY_MARK;
}

/** Draws `name`'s icon in its colour, or white on the chosen ink circle.
 *  One stable component per mark, so a caller never creates one in render. */
export function FamilyMark({
  name,
  on = false,
  size = 22,
  className,
}: {
  name: string;
  on?: boolean;
  size?: number;
  className?: string;
}) {
  const { icon: Icon, color } = familyMark(name);
  const style: CSSProperties = { display: "block" };
  return (
    <span aria-hidden className={className} style={style}>
      <Icon size={size} color={on ? "#FFFFFF" : color} />
    </span>
  );
}

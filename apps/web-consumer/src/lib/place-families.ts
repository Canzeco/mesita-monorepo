// Twenty guest families, plus Undefined last. Undefined is not a filter.
// Each guest family has one emoji. That mark is the rail title and the
// same mark in the admin console. A place may wear more than one (MESITA-2749).
// One word each (MESITA-2760): the labels are words a guest says, the keys
// stay as stored.

export type FamilyKey =
  | "coffee"
  | "breakfast"
  | "quick_bite"
  | "mexican"
  | "pizza"
  | "burgers"
  | "chicken"
  | "sushi"
  | "noodles"
  | "korean"
  | "chinese"
  | "italian"
  | "seafood"
  | "steak"
  | "indian"
  | "thai"
  | "dinner"
  | "sweet"
  | "drinks"
  | "night_out"
  | "undefined";

type PlaceFamily = {
  key: FamilyKey;
  label: string;
  emoji: string;
};

export const PLACE_FAMILIES: PlaceFamily[] = [
  { key: "coffee", label: "Coffee", emoji: "☕" },
  { key: "breakfast", label: "Breakfast", emoji: "🥐" },
  { key: "quick_bite", label: "Quick", emoji: "🥙" },
  { key: "mexican", label: "Mexican", emoji: "🌮" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "burgers", label: "Burgers", emoji: "🍔" },
  { key: "chicken", label: "Chicken", emoji: "🍗" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "noodles", label: "Noodles", emoji: "🍜" },
  { key: "korean", label: "Korean", emoji: "🍚" },
  { key: "chinese", label: "Chinese", emoji: "🥡" },
  { key: "italian", label: "Italian", emoji: "🍝" },
  { key: "seafood", label: "Seafood", emoji: "🦐" },
  { key: "steak", label: "Steak", emoji: "🥩" },
  { key: "indian", label: "Indian", emoji: "🍛" },
  { key: "thai", label: "Thai", emoji: "🍲" },
  { key: "dinner", label: "Dinner", emoji: "🍽️" },
  { key: "sweet", label: "Dessert", emoji: "🍰" },
  { key: "drinks", label: "Drinks", emoji: "🍸" },
  { key: "night_out", label: "Nightlife", emoji: "🌙" },
  { key: "undefined", label: "Undefined", emoji: "·" },
];

export const FILTERABLE_PLACE_FAMILIES: PlaceFamily[] = PLACE_FAMILIES.filter(
  (family) => family.key !== "undefined",
);

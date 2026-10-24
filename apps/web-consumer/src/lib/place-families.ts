// Twenty guest families, plus Undefined last. Undefined is not a filter.
// Each guest family has one emoji. That mark is the rail title and the
// same mark in the admin console. A place may wear more than one (MESITA-2749).

export type FamilyKey =
  | "coffee"
  | "breakfast"
  | "quick_bite"
  | "tacos"
  | "mexican"
  | "pizza"
  | "burgers"
  | "sushi"
  | "noodles"
  | "japanese"
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
  { key: "quick_bite", label: "Quick bite", emoji: "🥙" },
  { key: "tacos", label: "Tacos", emoji: "🌮" },
  { key: "mexican", label: "Mexican", emoji: "🌶️" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "burgers", label: "Burgers", emoji: "🍔" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "noodles", label: "Noodles", emoji: "🍜" },
  { key: "japanese", label: "Japanese", emoji: "🍱" },
  { key: "chinese", label: "Chinese", emoji: "🥡" },
  { key: "italian", label: "Italian", emoji: "🍝" },
  { key: "seafood", label: "Seafood", emoji: "🦐" },
  { key: "steak", label: "Steak", emoji: "🥩" },
  { key: "indian", label: "Indian", emoji: "🍛" },
  { key: "thai", label: "Thai", emoji: "🍲" },
  { key: "dinner", label: "Dinner", emoji: "🍽️" },
  { key: "sweet", label: "Sweet", emoji: "🍰" },
  { key: "drinks", label: "Drinks", emoji: "🍸" },
  { key: "night_out", label: "Night out", emoji: "🌙" },
  { key: "undefined", label: "Undefined", emoji: "·" },
];

export const FILTERABLE_PLACE_FAMILIES: PlaceFamily[] = PLACE_FAMILIES.filter(
  (family) => family.key !== "undefined",
);

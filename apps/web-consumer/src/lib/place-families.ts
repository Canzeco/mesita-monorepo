// Twelve guest families, plus Undefined last. Undefined is not a filter.
// Each guest family has one emoji. That mark is the rail title and the
// same mark in the admin console.

export type FamilyKey =
  | "coffee"
  | "breakfast"
  | "quick_bite"
  | "pizza"
  | "tacos"
  | "sushi"
  | "burgers"
  | "noodles"
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
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "tacos", label: "Tacos", emoji: "🌮" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "burgers", label: "Burgers", emoji: "🍔" },
  { key: "noodles", label: "Noodles", emoji: "🍜" },
  { key: "dinner", label: "Dinner", emoji: "🍝" },
  { key: "sweet", label: "Sweet", emoji: "🍰" },
  { key: "drinks", label: "Drinks", emoji: "🍸" },
  { key: "night_out", label: "Night out", emoji: "🌙" },
  { key: "undefined", label: "Undefined", emoji: "·" },
];

export const FILTERABLE_PLACE_FAMILIES: PlaceFamily[] = PLACE_FAMILIES.filter(
  (family) => family.key !== "undefined",
);

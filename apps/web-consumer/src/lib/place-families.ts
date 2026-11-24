// Twenty-five guest families (MESITA-4820), plus Undefined last. Undefined is not a filter.
// Each guest family has one emoji. That mark is the rail title and the
// same mark in the admin console. A place may wear more than one (MESITA-2749);
// its families are a dictionary of its Google categories, never a model's
// pick and never edited by hand (MESITA-2834). Two rails sit past the table
// since MESITA-4588: Fun and Casino.
// One word each (MESITA-2760): the labels are words a guest says, the keys
// stay as stored.

export type FamilyKey =
  | "restaurants"
  | "coffee"
  | "drinks"
  | "breakfast"
  | "brunch"
  | "dinner"
  | "quick_bite"
  | "tacos"
  | "seafood"
  | "asian"
  | "european"
  | "fancy"
  | "steak"
  | "japanese"
  | "american"
  | "healthy"
  | "italian"
  | "sushi"
  | "pizza"
  | "burgers"
  | "arabic"
  | "sweet"
  | "night_out"
  | "fun"
  | "casino"
  | "undefined";

type PlaceFamily = {
  key: FamilyKey;
  label: string;
  emoji: string;
};

export const PLACE_FAMILIES: PlaceFamily[] = [
  { key: "restaurants", label: "Restaurants", emoji: "🍽️" },
  { key: "coffee", label: "Coffee", emoji: "☕" },
  { key: "drinks", label: "Bar", emoji: "🍻" },
  { key: "breakfast", label: "Breakfast", emoji: "🍳" },
  { key: "brunch", label: "Brunch", emoji: "🥞" },
  { key: "dinner", label: "Dinner", emoji: "🌙" },
  { key: "quick_bite", label: "Quick", emoji: "⚡" },
  { key: "tacos", label: "Tacos", emoji: "🌮" },
  { key: "seafood", label: "Seafood", emoji: "🦐" },
  { key: "asian", label: "Asian", emoji: "🍥" },
  { key: "european", label: "European", emoji: "🥨" },
  { key: "fancy", label: "Fancy", emoji: "🥂" },
  { key: "steak", label: "Steak", emoji: "🥩" },
  { key: "japanese", label: "Japanese", emoji: "🍱" },
  { key: "american", label: "American", emoji: "🍟" },
  { key: "healthy", label: "Healthy", emoji: "🥗" },
  { key: "italian", label: "Italian", emoji: "🍝" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "burgers", label: "Burgers", emoji: "🍔" },
  { key: "arabic", label: "Arabic", emoji: "🧆" },
  { key: "sweet", label: "Dessert", emoji: "🍰" },
  { key: "night_out", label: "Club", emoji: "🪩" },
  { key: "fun", label: "Fun", emoji: "🎯" },
  { key: "casino", label: "Casino", emoji: "🎰" },
  { key: "undefined", label: "Undefined", emoji: "·" },
];

export const FILTERABLE_PLACE_FAMILIES: PlaceFamily[] = PLACE_FAMILIES.filter(
  (family) => family.key !== "undefined",
);

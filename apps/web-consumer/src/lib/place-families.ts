// Forty guest families, plus Undefined last. Undefined is not a filter.
// Each guest family has one emoji. That mark is the rail title and the
// same mark in the admin console. A place may wear more than one (MESITA-2749);
// its families are a dictionary of its Google categories, never a model's
// pick and never edited by hand (MESITA-2834). Six rails sit past the table
// since MESITA-2888: Family, Fun, Cinema, Casino, Spa, Tourist.
// One word each (MESITA-2760): the labels are words a guest says, the keys
// stay as stored.

export type FamilyKey =
  | "coffee"
  | "breakfast"
  | "bakery"
  | "sweet"
  | "healthy"
  | "quick_bite"
  | "tacos"
  | "burgers"
  | "pizza"
  | "chicken"
  | "sushi"
  | "mexican"
  | "steak"
  | "seafood"
  | "italian"
  | "japanese"
  | "chinese"
  | "asian"
  | "indian"
  | "arabic"
  | "european"
  | "american"
  | "dinner"
  | "fancy"
  | "family"
  | "drinks"
  | "beer"
  | "cocktails"
  | "wine"
  | "sports"
  | "hookah"
  | "night_out"
  | "nightclub"
  | "music"
  | "karaoke"
  | "fun"
  | "cinema"
  | "casino"
  | "spa"
  | "tourist"
  | "undefined";

type PlaceFamily = {
  key: FamilyKey;
  label: string;
  emoji: string;
};

export const PLACE_FAMILIES: PlaceFamily[] = [
  { key: "coffee", label: "Coffee", emoji: "☕" },
  { key: "breakfast", label: "Breakfast", emoji: "🍳" },
  { key: "bakery", label: "Bakery", emoji: "🥐" },
  { key: "sweet", label: "Dessert", emoji: "🍰" },
  { key: "healthy", label: "Healthy", emoji: "🥗" },
  { key: "quick_bite", label: "Quick", emoji: "⚡" },
  { key: "tacos", label: "Tacos", emoji: "🌮" },
  { key: "burgers", label: "Burgers", emoji: "🍔" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "chicken", label: "Wings", emoji: "🍗" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "mexican", label: "Mexican", emoji: "🌶️" },
  { key: "steak", label: "Steak", emoji: "🥩" },
  { key: "seafood", label: "Seafood", emoji: "🦐" },
  { key: "italian", label: "Italian", emoji: "🍝" },
  { key: "japanese", label: "Japanese", emoji: "🍱" },
  { key: "chinese", label: "Chinese", emoji: "🥡" },
  { key: "asian", label: "Asian", emoji: "🍥" },
  { key: "indian", label: "Indian", emoji: "🍛" },
  { key: "arabic", label: "Arabic", emoji: "🧆" },
  { key: "european", label: "European", emoji: "🥨" },
  { key: "american", label: "American", emoji: "🍟" },
  { key: "dinner", label: "Dinner", emoji: "🍽️" },
  { key: "fancy", label: "Fancy", emoji: "🥂" },
  { key: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { key: "drinks", label: "Bar", emoji: "🍻" },
  { key: "beer", label: "Beer", emoji: "🍺" },
  { key: "cocktails", label: "Cocktails", emoji: "🍸" },
  { key: "wine", label: "Wine", emoji: "🍷" },
  { key: "sports", label: "Sports", emoji: "📺" },
  { key: "hookah", label: "Hookah", emoji: "💨" },
  { key: "night_out", label: "Night", emoji: "🌙" },
  { key: "nightclub", label: "Club", emoji: "🪩" },
  { key: "music", label: "Music", emoji: "🎶" },
  { key: "karaoke", label: "Karaoke", emoji: "🎤" },
  { key: "fun", label: "Fun", emoji: "🎯" },
  { key: "cinema", label: "Cinema", emoji: "🎬" },
  { key: "casino", label: "Casino", emoji: "🎰" },
  { key: "spa", label: "Spa", emoji: "🧖" },
  { key: "tourist", label: "Tourist", emoji: "🏛️" },
  { key: "undefined", label: "Undefined", emoji: "·" },
];

export const FILTERABLE_PLACE_FAMILIES: PlaceFamily[] = PLACE_FAMILIES.filter(
  (family) => family.key !== "undefined",
);

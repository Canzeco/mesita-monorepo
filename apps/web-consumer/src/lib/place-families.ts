// Fifty guest families, plus Undefined last. Undefined is not a filter.
// Each guest family has one emoji. That mark is the rail title and the
// same mark in the admin console. A place may wear more than one (MESITA-2749);
// its families are a dictionary of its Google categories, never a model's
// pick and never edited by hand (MESITA-2834).
// One word each (MESITA-2760): the labels are words a guest says, the keys
// stay as stored.

export type FamilyKey =
  | "coffee"
  | "breakfast"
  | "brunch"
  | "bakery"
  | "sweet"
  | "gelato"
  | "healthy"
  | "vegan"
  | "quick_bite"
  | "tacos"
  | "burgers"
  | "pizza"
  | "sandwiches"
  | "chicken"
  | "wings"
  | "kebab"
  | "dinner"
  | "mexican"
  | "steak"
  | "bbq"
  | "seafood"
  | "italian"
  | "sushi"
  | "japanese"
  | "ramen"
  | "noodles"
  | "chinese"
  | "dumplings"
  | "korean"
  | "thai"
  | "indian"
  | "asian"
  | "arabic"
  | "mediterranean"
  | "spanish"
  | "french"
  | "european"
  | "american"
  | "latin"
  | "fancy"
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
  | "undefined";

type PlaceFamily = {
  key: FamilyKey;
  label: string;
  emoji: string;
};

export const PLACE_FAMILIES: PlaceFamily[] = [
  { key: "coffee", label: "Coffee", emoji: "☕" },
  { key: "breakfast", label: "Breakfast", emoji: "🍳" },
  { key: "brunch", label: "Brunch", emoji: "🥞" },
  { key: "bakery", label: "Bakery", emoji: "🥐" },
  { key: "sweet", label: "Dessert", emoji: "🍰" },
  { key: "gelato", label: "Gelato", emoji: "🍦" },
  { key: "healthy", label: "Healthy", emoji: "🥗" },
  { key: "vegan", label: "Vegan", emoji: "🌱" },
  { key: "quick_bite", label: "Quick", emoji: "⚡" },
  { key: "tacos", label: "Tacos", emoji: "🌮" },
  { key: "burgers", label: "Burgers", emoji: "🍔" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "sandwiches", label: "Sandwich", emoji: "🥪" },
  { key: "chicken", label: "Chicken", emoji: "🍗" },
  { key: "wings", label: "Wings", emoji: "🔥" },
  { key: "kebab", label: "Kebab", emoji: "🥙" },
  { key: "dinner", label: "Dinner", emoji: "🍽️" },
  { key: "mexican", label: "Mexican", emoji: "🌶️" },
  { key: "steak", label: "Steak", emoji: "🥩" },
  { key: "bbq", label: "BBQ", emoji: "🍖" },
  { key: "seafood", label: "Seafood", emoji: "🦐" },
  { key: "italian", label: "Italian", emoji: "🍝" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "japanese", label: "Japanese", emoji: "🍱" },
  { key: "ramen", label: "Ramen", emoji: "🍜" },
  { key: "noodles", label: "Noodles", emoji: "🥢" },
  { key: "chinese", label: "Chinese", emoji: "🥡" },
  { key: "dumplings", label: "Dumpling", emoji: "🥟" },
  { key: "korean", label: "Korean", emoji: "🍚" },
  { key: "thai", label: "Thai", emoji: "🍲" },
  { key: "indian", label: "Indian", emoji: "🍛" },
  { key: "asian", label: "Asian", emoji: "🍥" },
  { key: "arabic", label: "Arabic", emoji: "🧆" },
  { key: "mediterranean", label: "Greek", emoji: "🫒" },
  { key: "spanish", label: "Spanish", emoji: "🥘" },
  { key: "french", label: "French", emoji: "🥖" },
  { key: "european", label: "European", emoji: "🥨" },
  { key: "american", label: "American", emoji: "🍟" },
  { key: "latin", label: "Latin", emoji: "🌎" },
  { key: "fancy", label: "Fancy", emoji: "🥂" },
  { key: "drinks", label: "Bar", emoji: "🍻" },
  { key: "beer", label: "Beer", emoji: "🍺" },
  { key: "cocktails", label: "Cocktail", emoji: "🍸" },
  { key: "wine", label: "Wine", emoji: "🍷" },
  { key: "sports", label: "Sports", emoji: "📺" },
  { key: "hookah", label: "Hookah", emoji: "💨" },
  { key: "night_out", label: "Night", emoji: "🌙" },
  { key: "nightclub", label: "Club", emoji: "🪩" },
  { key: "music", label: "Music", emoji: "🎶" },
  { key: "karaoke", label: "Karaoke", emoji: "🎤" },
  { key: "undefined", label: "Undefined", emoji: "·" },
];

export const FILTERABLE_PLACE_FAMILIES: PlaceFamily[] = PLACE_FAMILIES.filter(
  (family) => family.key !== "undefined",
);

// Home's chips, in the web's order. The keys are the backend's and are never
// renamed; the pictures are Fluent Emoji Flat.

export const CHIPS = [
  { key: "saved", label: "Saved", picture: require("../../../assets/families/saved.svg") },
  { key: "near", label: "Nearby", picture: require("../../../assets/families/near.svg") },
  { key: "all", label: "Popular", picture: require("../../../assets/families/all.svg") },
  { key: "restaurants", label: "Restaurants", picture: require("../../../assets/families/restaurants.svg") },
  { key: "coffee", label: "Coffee", picture: require("../../../assets/families/coffee.svg") },
  { key: "drinks", label: "Bar", picture: require("../../../assets/families/drinks.svg") },
  { key: "breakfast", label: "Breakfast", picture: require("../../../assets/families/breakfast.svg") },
  { key: "brunch", label: "Brunch", picture: require("../../../assets/families/brunch.svg") },
  { key: "dinner", label: "Dinner", picture: require("../../../assets/families/dinner.svg") },
  { key: "quick_bite", label: "Quick", picture: require("../../../assets/families/quick_bite.svg") },
  { key: "tacos", label: "Tacos", picture: require("../../../assets/families/tacos.svg") },
  { key: "seafood", label: "Seafood", picture: require("../../../assets/families/seafood.svg") },
  { key: "asian", label: "Asian", picture: require("../../../assets/families/asian.svg") },
  { key: "european", label: "European", picture: require("../../../assets/families/european.svg") },
  { key: "fancy", label: "Fancy", picture: require("../../../assets/families/fancy.svg") },
  { key: "steak", label: "Steak", picture: require("../../../assets/families/steak.svg") },
  { key: "japanese", label: "Japanese", picture: require("../../../assets/families/japanese.svg") },
  { key: "american", label: "American", picture: require("../../../assets/families/american.svg") },
  { key: "healthy", label: "Healthy", picture: require("../../../assets/families/healthy.svg") },
  { key: "italian", label: "Italian", picture: require("../../../assets/families/italian.svg") },
  { key: "sushi", label: "Sushi", picture: require("../../../assets/families/sushi.svg") },
  { key: "pizza", label: "Pizza", picture: require("../../../assets/families/pizza.svg") },
  { key: "burgers", label: "Burgers", picture: require("../../../assets/families/burgers.svg") },
  { key: "arabic", label: "Arabic", picture: require("../../../assets/families/arabic.svg") },
  { key: "sweet", label: "Dessert", picture: require("../../../assets/families/sweet.svg") },
  { key: "night_out", label: "Club", picture: require("../../../assets/families/night_out.svg") },
  { key: "fun", label: "Fun", picture: require("../../../assets/families/fun.svg") },
  { key: "casino", label: "Casino", picture: require("../../../assets/families/casino.svg") },
] as const;

export type Chip = (typeof CHIPS)[number];
export type ChipKey = Chip["key"];

const SPECIAL: readonly ChipKey[] = ["saved", "near", "all"];
export const isSpecial = (key: ChipKey) => SPECIAL.includes(key);

/** Saved is a member's. */
export function chipsFor(member: boolean): readonly Chip[] {
  return CHIPS.filter((c) => member || c.key !== "saved");
}

export type Question = { rankMode: "nearby" | "popular" | "family"; familyKeys: string[] };

/** What a chip asks the catalog. */
export function questionOf(key: ChipKey): Question {
  if (key === "near") return { rankMode: "nearby", familyKeys: [] };
  if (key === "all" || key === "saved") return { rankMode: "popular", familyKeys: [] };
  return { rankMode: "family", familyKeys: [key] };
}

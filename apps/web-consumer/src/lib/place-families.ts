// Twenty guest families, plus Undefined last. Undefined is not a filter.
// Labels are the carousel titles.

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
  | "wine"
  | "night_out"
  | "live"
  | "go_out"
  | "with_kids"
  | "outdoors"
  | "culture"
  | "move"
  | "feel_better"
  | "undefined";

type PlaceFamily = {
  key: FamilyKey;
  label: string;
  emoji: string;
};

export const PLACE_FAMILIES: PlaceFamily[] = [
  { key: "coffee", label: "Coffee", emoji: "·" },
  { key: "breakfast", label: "Breakfast", emoji: "·" },
  { key: "quick_bite", label: "Quick bite", emoji: "·" },
  { key: "pizza", label: "Pizza", emoji: "·" },
  { key: "tacos", label: "Tacos", emoji: "·" },
  { key: "sushi", label: "Sushi", emoji: "·" },
  { key: "burgers", label: "Burgers", emoji: "·" },
  { key: "noodles", label: "Noodles", emoji: "·" },
  { key: "dinner", label: "Dinner", emoji: "·" },
  { key: "sweet", label: "Sweet", emoji: "·" },
  { key: "drinks", label: "Drinks", emoji: "·" },
  { key: "wine", label: "Wine", emoji: "·" },
  { key: "night_out", label: "Night out", emoji: "·" },
  { key: "live", label: "Live", emoji: "·" },
  { key: "go_out", label: "Go out", emoji: "·" },
  { key: "with_kids", label: "With kids", emoji: "·" },
  { key: "outdoors", label: "Outdoors", emoji: "·" },
  { key: "culture", label: "Culture", emoji: "·" },
  { key: "move", label: "Move", emoji: "·" },
  { key: "feel_better", label: "Feel better", emoji: "·" },
  { key: "undefined", label: "Undefined", emoji: "·" },
];

export const FILTERABLE_PLACE_FAMILIES: PlaceFamily[] = PLACE_FAMILIES.filter(
  (family) => family.key !== "undefined",
);

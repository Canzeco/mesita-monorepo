type MenuKind = "image" | "pdf" | "drive";

type Nutrition = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** The word under a menu's name. */
export function menuKindLabel(kind: MenuKind): string {
  if (kind === "image") return "Image";
  if (kind === "pdf") return "PDF";
  return "Google Drive";
}

/** Kilocalories, then protein, carbs and fat. A missing estimate prints nothing. */
export function nutritionLine(n: Nutrition | null | undefined): string | null {
  if (!n) return null;
  const kcal = new Intl.NumberFormat("en-US").format(Math.round(n.kcal));
  return `${kcal} kcal · ${Math.round(n.proteinG)} g protein · ${Math.round(n.carbsG)} g carbs · ${Math.round(n.fatG)} g fat`;
}

/** Image menus count pages. A Drive file says it is a reference preview. */
export function menuMeta(kind: MenuKind, pages: number | null): string {
  if (kind === "image") {
    const n = pages && pages > 0 ? pages : 1;
    return `${menuKindLabel(kind)} · ${n === 1 ? "1 page" : `${n} pages`}`;
  }
  if (kind === "drive") return "Google Drive · reference preview";
  return pages && pages > 0 ? (pages === 1 ? "PDF · 1 page" : `PDF · ${pages} pages`) : "PDF";
}

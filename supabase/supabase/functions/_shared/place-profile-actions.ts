// Description → Actions (Intaker function 9): which guest CTAs are unlocked.
//
// Visit is NOT stored here — it is computed at read time from `promoting`
// (paid plan + live promo lane). These two flags are persisted:
//
//   orders_enabled        true when the place has a menu / product catalog.
//   reservations_enabled  LLM inference — this kind of place likely takes
//                         reservations (fine dining yes, fast food no).
//
// Defaults are false at create. Contents enrichment sets both during the
// Description step alongside category, tags, and presentation.

/** Minimal row shape for menu detection — matches places columns. */
export type OrderCatalogFields = {
  products?: unknown;
  menus?: unknown;
  menu_pdf_url?: unknown;
};

export type ActionFlagFields = OrderCatalogFields & {
  orders_enabled?: boolean | null;
  reservations_enabled?: boolean | null;
};

/** True when products.menu, legacy menus[], or menu_pdf_url has content. */
export function placeHasOrderCatalog(
  row: OrderCatalogFields | null | undefined,
): boolean {
  if (!row) return false;
  const products = row.products;
  if (products && typeof products === "object" && !Array.isArray(products)) {
    const menu = (products as Record<string, unknown>).menu;
    if (Array.isArray(menu) && menu.length > 0) return true;
  }
  if (Array.isArray(row.menus) && row.menus.length > 0) return true;
  if (typeof row.menu_pdf_url === "string" && row.menu_pdf_url.trim().length > 0) {
    return true;
  }
  return false;
}

/** Guest Order CTA — menu on file (re-checked so manual menu edits unlock). */
export function placeOrderActionEnabled(
  row: ActionFlagFields | null | undefined,
): boolean {
  if (!row) return false;
  if (row.orders_enabled === true) return true;
  return placeHasOrderCatalog(row);
}

/** Guest Reserve CTA — LLM-set flag only; default false. */
export function placeReserveActionEnabled(
  row: ActionFlagFields | null | undefined,
): boolean {
  return row?.reservations_enabled === true;
}

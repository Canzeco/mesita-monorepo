// Description → Actions (Enricher step 7): which guest CTAs are unlocked.
//
// Visit is NOT stored here — it is computed at read time from `promoting`
// (paid plan + live promo lane). These two flags are persisted:
//
//   orders_enabled        true when the place has a menu / product catalog.
//   reservations_enabled  guest Reserve CTA. Off only when the operator
//                         picked Not (`reservation_channel = none`) or a
//                         contents run confirmed walk-in. Default true
//                         (MESITA-1799); missing/undefined also offers it.

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

/** Guest Order CTA — fail-closed until the order rail ships (MESITA-1155).
 *  `orders_enabled` remains menu-driven for operator surfaces only. */
export function placeOrderActionEnabled(
  _row: ActionFlagFields | null | undefined,
): boolean {
  return false;
}

/** Guest Reserve CTA — off only on an explicit false (Not / walk-in). */
export function placeReserveActionEnabled(
  row: ActionFlagFields | null | undefined,
): boolean {
  return row?.reservations_enabled !== false;
}

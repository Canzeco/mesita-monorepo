// Guest action gates — mirrors supabase/_shared/place-profile-actions.ts.
// Visit uses `promoting` from the wire mapper, not these flags.

export type ActionFlagRow = {
  orders_enabled?: boolean | null;
  reservations_enabled?: boolean | null;
  products?: unknown;
  menus?: unknown;
  menu_pdf_url?: unknown;
};

function hasMenuCatalog(row: ActionFlagRow): boolean {
  const products = row.products;
  if (products && typeof products === "object" && !Array.isArray(products)) {
    const menu = (products as Record<string, unknown>).menu;
    if (Array.isArray(menu) && menu.length > 0) return true;
  }
  if (Array.isArray(row.menus) && row.menus.length > 0) return true;
  if (typeof row.menu_pdf_url === "string" && row.menu_pdf_url.trim()) return true;
  return false;
}

export function isOrderActionEnabled(row: ActionFlagRow | null | undefined): boolean {
  if (!row) return false;
  if (row.orders_enabled === true) return true;
  return hasMenuCatalog(row);
}

export function isReserveActionEnabled(
  row: ActionFlagRow | null | undefined,
): boolean {
  return row?.reservations_enabled === true;
}

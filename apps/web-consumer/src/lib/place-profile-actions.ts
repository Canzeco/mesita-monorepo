// Guest action gates — mirrors supabase/_shared/place-profile-actions.ts.
// Visit uses `promoting` from the wire mapper, not these flags.

export type ActionFlagRow = {
  orders_enabled?: boolean | null;
  reservations_enabled?: boolean | null;
  products?: unknown;
  menus?: unknown;
  menu_pdf_url?: unknown;
};

/** Guest Order CTA — fail-closed until the order rail ships (MESITA-1155).
 *  `places.orders_enabled` stays menu-driven for operator surfaces; a menu on
 *  file is not a table-order destination (MESITA-1967). */
export function isOrderActionEnabled(
  _row: ActionFlagRow | null | undefined,
): boolean {
  return false;
}

/** Guest Reserve CTA — off only on an explicit false (Not / walk-in). */
export function isReserveActionEnabled(
  row: ActionFlagRow | null | undefined,
): boolean {
  return row?.reservations_enabled !== false;
}

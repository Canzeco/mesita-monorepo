// Guest Reserve gate — mirrors `isReserveActionEnabled` in
// supabase/_shared/place-profile-actions.ts.

export type ActionFlagRow = {
  reservations_enabled?: boolean | null;
};

/** Guest Reserve CTA — off only on an explicit false (Not / walk-in). */
export function isReserveActionEnabled(
  row: ActionFlagRow | null | undefined,
): boolean {
  return row?.reservations_enabled !== false;
}

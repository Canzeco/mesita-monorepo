/** Mesita Selected (MESITA-2707): `places.selected` on the row. */
export function isSelectedRow(row: { selected?: boolean | null }): boolean {
  return row.selected === true;
}

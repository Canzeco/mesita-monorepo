// One page of Mesita Search's table (MESITA-3942). The catalog is loaded in
// full; the table shows it 50 rows at a time so 2,000 places never render
// at once.

export const PAGE_SIZE = 50;

export type Page<T> = {
  rows: T[];
  /** 1-based index of the first row shown; 0 when there is none. */
  from: number;
  to: number;
  total: number;
  pages: number;
  /** The page actually shown, after clamping. */
  page: number;
};

export function pageOf<T>(rows: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const per = size >= 1 ? Math.floor(size) : PAGE_SIZE;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / per));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  if (total === 0) return { rows: [], from: 0, to: 0, total: 0, pages: 1, page: 1 };
  const start = (p - 1) * per;
  const slice = rows.slice(start, start + per);
  return { rows: slice, from: start + 1, to: start + slice.length, total, pages, page: p };
}

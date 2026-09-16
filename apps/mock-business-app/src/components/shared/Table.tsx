// The console's one table.
//
// Full-bleed inside its card, scrollable on its own axis, with the header
// pinned to ITS OWN SCROLLPORT and no `top-[…]` offset — ever. `position:
// sticky` resolves `top` against the nearest SCROLLING ANCESTOR, and this
// header sits inside an `overflow-x-auto` div, which CSS makes a scroll
// container on both axes. An offset measured from the page's chrome means
// nothing in that coordinate system: the real console shipped a thead shifted
// 57px down its own card for weeks, with the first row's thumbnail surfacing in
// the gap above the column labels.
import { STATES_HEAD_BG, STATES_HEAD_STICKY } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  head: string;
  /** Right-align the numbers. A money column that is not right-aligned cannot
   *  be scanned for magnitude, which is the only reason to put it in a table. */
  align?: "left" | "right";
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function Table<T extends { id: string }>({
  columns,
  rows,
  empty,
  minWidth = 640,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: React.ReactNode;
  /** The width below which this table SCROLLS instead of squeezing, in px.
   *
   *  It is a prop and an inline style rather than a `min-w-[…]` class because
   *  the right floor is a property of the COLUMN SET, not of the component: a
   *  three-column table is comfortable at 640, and the nine-column Customers
   *  table at 640 does not scroll — it compresses, wraps a phone number over
   *  four lines and triples every row's height. A table that wraps instead of
   *  scrolling is the failure this number exists to prevent. */
  minWidth?: number;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead className={cn(STATES_HEAD_STICKY, STATES_HEAD_BG)}>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "text-muted-foreground border-border border-b px-3 py-2 text-[11px] font-semibold tracking-wide uppercase",
                  c.align === "right" ? "text-right" : "text-left",
                )}
              >
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-border hover:bg-muted/40 border-b last:border-0">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-3 py-2.5 align-middle",
                    c.align === "right" ? "text-right tabular-nums" : "text-left",
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
//
// ── `inCard` AND `groups` (MESITA-2034, Setup standard §2/D11) ─────────────
//
// A Setup Group draws its OWN `rounded-lg` card; `inCard` drops this table's
// own `border`/`rounded-xl`/`bg-card` so it doesn't nest inside that card —
// card-in-card is exactly the idiom the Setup grammar exists to kill.
// `overflow-x-auto` stays either way; a wide table still scrolls, it just
// doesn't draw a second border doing it.
//
// `groups` renders one `<tbody>` per named section (Menu's "De la brasa",
// "Para empezar", "De la barra"), each opened by a row-group head carrying
// the section name and this table's own column heads — the law MenuView.tsx
// wrote for its old per-section markup ("the heads ride with the SECTION, not
// with the card") survives the move into `Table`.
//
// THE ROW-GROUP HEAD IS NOT `position: sticky`. Only the outer `<thead>` is,
// unchanged — making the row-group head sticky too would risk the exact
// nearest-scrolling-ancestor bug this file's own header comment documents,
// and Menu's 2–7-dish sections don't need it to stay readable.
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

export type TableGroup<T> = {
  id: string;
  /** The row-group head's label, e.g. a Menu section name. */
  name: string;
  rows: T[];
};

function Cells<T>({ row, columns }: { row: T; columns: Column<T>[] }) {
  return (
    <>
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
    </>
  );
}

export function Table<T extends { id: string }>({
  columns,
  rows,
  groups,
  empty,
  minWidth = 640,
  inCard = false,
}: {
  columns: Column<T>[];
  /** Flat rows. Mutually exclusive with `groups` — pass one or the other. */
  rows?: T[];
  /** Named row-groups (Menu's sections). When set, `rows` is ignored. */
  groups?: TableGroup<T>[];
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
  /** Drop this table's own border/radius/bg so it can sit inside a Setup
   *  Group's card without becoming card-in-card. `overflow-x-auto` stays. */
  inCard?: boolean;
}) {
  const flatRows = groups ? groups.flatMap((g) => g.rows) : (rows ?? []);
  if (flatRows.length === 0 && empty) return <>{empty}</>;
  return (
    // `bg-card`, because since MESITA-1938 the page under it is grey: a table
    // dropped straight onto a screen (Activity) has to bring its own white,
    // and inside a card it is the white that was already there. `inCard`
    // skips both the border and the bg — the Group's own card is that white.
    <div
      className={cn(
        "overflow-x-auto",
        !inCard && "border-border bg-card rounded-xl border",
      )}
    >
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
        {groups ? (
          groups.map((g) => (
            <tbody key={g.id}>
              {/* The row-group head — NOT sticky, see the file header. */}
              <tr className="border-border bg-muted/30 border-b">
                <th
                  scope="rowgroup"
                  colSpan={columns.length}
                  className="text-foreground px-3 py-1.5 text-left text-[12px] font-semibold"
                >
                  {g.name}
                </th>
              </tr>
              {g.rows.map((row) => (
                <tr key={row.id} className="border-border hover:bg-muted/40 border-b last:border-0">
                  <Cells row={row} columns={columns} />
                </tr>
              ))}
            </tbody>
          ))
        ) : (
          <tbody>
            {(rows ?? []).map((row) => (
              <tr key={row.id} className="border-border hover:bg-muted/40 border-b last:border-0">
                <Cells row={row} columns={columns} />
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

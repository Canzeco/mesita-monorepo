// The one table every Monitor list wears (MESITA-4566, Pato: "make all those
// tables in table format"): a header row, one column per field, aligned. It
// scrolls sideways inside its card when a phone is too narrow; the page never
// does. A plain module of parts, no state.

import Link from "next/link";
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { customerHref, customerLabel } from "@/lib/monitor";
import { cn } from "@/lib/utils";
import { GuestAvatar, type GuestFace } from "./GuestAvatar";

/** A small quiet link to a related row. */
export const CHIP =
  "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap tabular-nums";

export type Column<T> = {
  head: string;
  cell: (row: T) => React.ReactNode;
  /** Money and ids sit right, so the digits line up. */
  align?: "right";
};

const TH = "text-muted-foreground px-3 py-2 text-xs font-medium whitespace-nowrap first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6";
const TD = "px-3 py-2 align-middle whitespace-nowrap first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6";

export function MonitorTable<T>({ columns, rows, rowKey, rowId }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; rowId?: (row: T) => string }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/40 border-border border-b">
          <tr>
            {columns.map((c) => (
              <th key={c.head} scope="col" className={cn(TH, c.align === "right" && "text-right")}>
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((row) => (
            <tr key={rowKey(row)} id={rowId?.(row)} className="hover:bg-muted/30">
              {columns.map((c) => (
                <td key={c.head} className={cn(TD, c.align === "right" && "text-right tabular-nums")}>
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

/** "—" for an empty cell, so a column never reads as broken. */
export function Dash() {
  return <span className="text-muted-foreground/60">—</span>;
}

/** The guest: face and name, the name linking to their Customers row. */
export function GuestCell({ placeId, customer, name, face }: { placeId: string; customer: string | null; name: string | null; face: GuestFace }) {
  const label = name ?? "Deleted guest";
  return (
    <span className="flex items-center gap-2">
      <GuestAvatar face={face} size={24} />
      {customer ? (
        <Link href={customerHref(placeId, customer)} className="font-medium underline-offset-2 hover:underline">
          {label}
        </Link>
      ) : (
        <span className="text-muted-foreground font-medium">{label}</span>
      )}
    </span>
  );
}

/** The guest's Customer #ID chip. */
export function CustomerChip({ placeId, customer }: { placeId: string; customer: string | null }) {
  if (!customer) return <Dash />;
  return (
    <Link href={customerHref(placeId, customer)} className={cn(CHIP, "gap-1")}>
      <UserCircleIcon size={12} weight="bold" aria-hidden />
      {customerLabel(customer)}
    </Link>
  );
}

/** The row's own #ID, quiet and monospaced. */
export function IdCell({ id }: { id: string }) {
  return <span className="text-muted-foreground font-mono text-xs">{id}</span>;
}

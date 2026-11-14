import { cn } from "./cn";
import { STICKY_COL_CELL, STICKY_COL_HEAD } from "./classes";
import { Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

// The one table: scrolls inside its card on a phone; numbers right-aligned
// and tabular; hover only on clickable rows; `sticky` pins the identity column.

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return <UiTable className={className}>{children}</UiTable>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <TableHeader>{children}</TableHeader>;
}

export const TBody = TableBody;

export function Tr({
  clickable,
  className,
  ...rest
}: { clickable?: boolean } & React.ComponentProps<"tr">) {
  return <TableRow className={cn(clickable && "hover:bg-muted/50 cursor-pointer", className)} {...rest} />;
}

export function Th({
  numeric,
  sticky,
  className,
  ...rest
}: { numeric?: boolean; sticky?: boolean } & React.ComponentProps<"th">) {
  return <TableHead className={cn(numeric ? "text-right" : "text-left", sticky && STICKY_COL_HEAD, className)} {...rest} />;
}

export function Td({
  numeric,
  sticky,
  className,
  ...rest
}: { numeric?: boolean; sticky?: boolean } & React.ComponentProps<"td">) {
  return (
    <TableCell
      className={cn(numeric && "text-right tabular-nums", sticky && STICKY_COL_CELL, className)}
      {...rest}
    />
  );
}

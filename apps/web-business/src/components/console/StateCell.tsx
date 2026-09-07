// One cell of the states matrix (MESITA-1608).
//
// FOUR ANSWERS, NOT TWO. `yes` · `no` · `?` · a count. The `?` is the one that
// matters and the one a two-state cell cannot say:
//
//   • the pool withholds Partner, Verified and the intake map on purpose —
//     any Mesita account can read that scope,
//   • merging to main auto-deploys the Edge Function AND triggers the Vercel
//     build in parallel, so for about a minute this component runs against a
//     payload that predates it,
//   • a verification lookup can fail.
//
// In all three the honest answer is "we did not read it". Rendering `no` there
// asserts a fact nobody checked, which on a screen whose entire contract is
// "this cell is the truth" is worse than an empty column.
//
// TEXT, NEVER COLOUR ALONE. A green-vs-grey pill differing only in fill fails
// for anyone who cannot separate them, and this table is 1,000 cells of
// exactly that shape. The word is the state; the colour is emphasis.
//
// TOKENS, NEVER RAW COLOUR LITERALS. web-admin's twin uses `text-green-700`
// with no dark variant, which is safe THERE because web-admin ships no dark
// theme at all. web-business has `@custom-variant dark` and a full `.dark`
// block, where `text-green-700` on the dark card ground is about 2.5:1 and
// fails AA. Every tone below carries its `dark:` pair.
import { cn } from "@/lib/utils";

export type CellValue = boolean | "unknown";

/** `pending` paints a false rose: a debt the viewer can settle. `neutral`
 *  paints it grey: a fact that simply is not true and implies no work. The
 *  taxonomy is STATE_FACT_FALSE_TONE's, so this table and the State box
 *  cannot disagree about which absences are defects. */
export type FalseTone = "pending" | "neutral";

export function StateCell({
  value,
  label,
  falseTone = "pending",
  note,
}: {
  value: CellValue;
  /** The column name, for the accessible sentence. A screen reader landing
   *  mid-table has no header in earshot, so the cell says both halves. */
  label: string;
  falseTone?: FalseTone;
  /** Extra clause for the accessible name and the tooltip — "ran and failed",
   *  or why the queue stopped. */
  note?: string;
}) {
  const spoken = value === "unknown" ? "unknown" : value ? "yes" : "no";
  const text = value === "unknown" ? "?" : value ? "yes" : "no";
  return (
    <span
      title={note ? `${label}: ${spoken} — ${note}` : `${label}: ${spoken}`}
      aria-label={note ? `${label}: ${spoken}, ${note}` : `${label}: ${spoken}`}
      className={cn(
        "type-label inline-flex items-center justify-center rounded-full px-2 py-0.5 font-semibold",
        value === "unknown"
          ? "bg-muted text-muted-foreground"
          : value
            ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
            : falseTone === "neutral"
              ? "bg-muted text-muted-foreground"
              : "bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
      )}
    >
      {text}
    </span>
  );
}

/** Requested is a COUNT, never a Yes/No (MESITA-1372). `tabular-nums` keeps a
 *  column of numbers aligned; without it a lone `0` among pills reads as a
 *  rendering error rather than as an answer. */
export function CountCell({
  value,
  label,
}: {
  value: number | "unknown";
  label: string;
}) {
  const spoken = value === "unknown" ? "unknown" : String(value);
  return (
    <span
      title={`${label}: ${spoken}`}
      aria-label={`${label}: ${spoken}`}
      className={cn(
        "type-label font-semibold tabular-nums",
        value === "unknown" || value === 0
          ? "text-muted-foreground"
          : "text-foreground",
      )}
    >
      {value === "unknown" ? "?" : value}
    </span>
  );
}

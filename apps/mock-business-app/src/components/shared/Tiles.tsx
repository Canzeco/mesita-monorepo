// A row of counted facts.
//
// Every tile prints something the page actually READ. A tile with no number is
// a dash, never a zero: zero is a measurement and "we did not read it" is not,
// and a console that prints 0 for an unread value is lying in the quietest way
// it can.
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export type Tile = {
  label: string;
  value: string | number | null;
  hint?: string;
};

export function Tiles({ tiles, className }: { tiles: Tile[]; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {tiles.map((t) => (
        <div key={t.label} className="border-border bg-card rounded-xl border px-3 py-3">
          <p className={TINY_LABEL_CLASS}>{t.label}</p>
          <p className="font-display mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {t.value ?? "—"}
          </p>
          {t.hint && (
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{t.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}

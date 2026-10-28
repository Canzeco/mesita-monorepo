"use client";

import { cn } from "@/lib/utils";

// ONE ROW FOR BOTH PLACE LISTS (Pato, MESITA-2931: "this top bar and the
// other shit must look really similar in the sense that you can add a place
// super easily"). The Search bar's results and the Add a place sheet draw
// the same row: a mark, the name over its address, and one button on the
// right — "Create profile" (ink) for a place Google holds alone, "Open"
// (muted) for one Mesita holds. A Location has no button: it is an area,
// not a place.
//
// The body and the button are siblings, never nested: in the bar the body
// anchors the map (MESITA-1405) and the button opens or creates.

export type PlaceRowAction = {
  onMesita: boolean;
  onClick: () => void;
};

export function PlaceActionRow({
  mark,
  title,
  subtitle,
  onRowClick,
  rowLabel,
  action,
  className,
}: {
  mark: React.ReactNode;
  title: string;
  subtitle?: string | null;
  /** The bar's anchor tap. Without it the body is plain text (the sheet). */
  onRowClick?: () => void;
  /** Spoken name of the body button. */
  rowLabel?: string;
  action?: PlaceRowAction | null;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{mark}</span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-semibold">
          {title}
        </span>
        {subtitle ? (
          <span className="text-muted-foreground block truncate text-xs">
            {subtitle}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      {onRowClick ? (
        <button
          type="button"
          onClick={onRowClick}
          aria-label={rowLabel}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition active:opacity-70"
        >
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
      )}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          aria-label={`${action.onMesita ? "Open" : "Create profile for"} ${title}`}
          className={cn(
            "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97]",
            action.onMesita ? "bg-muted text-foreground" : "bg-foreground text-paper",
          )}
          data-place-row-action={action.onMesita ? "open" : "create"}
        >
          {action.onMesita ? "Open" : "Create profile"}
        </button>
      ) : null}
    </div>
  );
}

// A DOOR THE SCREEN DEPENDS ON (MESITA-2034, Setup standard §7). Replaces
// the dashed bands this app used for "you need to do this first" — MenuDoor's
// own card, the Menu draft band — with one solid-hairline row at the top of
// the stack. Dashed still means "not built yet" (SoonStrip, EmptyState);
// Notice is a door that exists and can be walked through right now, so it
// gets a solid border, not the not-here-yet dash.
//
//   ┌──────────────────────────────────────────────────────┐
//   │ 📖  Publish your menu first          [Open Digital…] │
//   │     Online Orders reads the published menu…          │
//   └──────────────────────────────────────────────────────┘
//
// 0–2 PER SCREEN, ORDERED BY `priority` (lower renders first) — NOT BY JSX
// ORDER. Two Notices on one screen (Website's Locked notice + its MenuDoor)
// must not depend on which `<Notice>` call happens to come first in the
// source; a Locked/error banner is priority 0, a door like MenuDoor is
// priority 1. Renders nothing once its own condition clears (`show={false}`)
// — a Notice that stays on screen after being walked through is a heading
// about the past.
import { cn } from "@/lib/utils";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

export function Notice({
  show = true,
  tone = "default",
  icon,
  title,
  note,
  action,
  className,
}: {
  /** False when the condition this Notice exists for has already cleared
   *  (e.g. `menuPublishedAt !== null`). Renders nothing. */
  show?: boolean;
  tone?: "default" | "bad";
  icon: React.ReactNode;
  title: string;
  note?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  if (!show) return null;
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cn(
        "border-border flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-display text-sm font-semibold tracking-tight">
          {title}
        </p>
        {note && (
          <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
            {note}
          </p>
        )}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={GHOST_PILL_BUTTON_CLASS}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Sorts a screen's Notices by priority (lower first) before rendering, so
 *  two `<Notice>` calls never depend on their JSX order. Pass every Notice a
 *  screen might show, in any order; this returns them in the right one. */
export function orderNotices<T extends { priority: number }>(notices: T[]): T[] {
  return [...notices].sort((a, b) => a.priority - b.priority);
}

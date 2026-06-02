import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_KIND_META,
  type ConsumerActivity,
} from "./consumer-activity-data";

export function ConsumerActivityList({
  items,
  anonymisedNote = false,
}: {
  items: ConsumerActivity[];
  anonymisedNote?: boolean;
}) {
  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((a) => {
          const meta = ACTIVITY_KIND_META[a.kind];
          return (
            <li
              key={a.id}
              className="border-border bg-card flex items-center gap-3 rounded-xl border p-3"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  meta.bg,
                )}
              >
                <meta.Icon
                  className={cn("h-4 w-4", meta.color)}
                  strokeWidth={2.25}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-[13px] leading-snug">
                  {a.handle && (
                    <strong className="font-semibold">{a.handle}</strong>
                  )}
                  {a.handle ? " " : ""}
                  {a.verb}{" "}
                  {a.venue && (
                    <strong className="text-foreground font-semibold">
                      {a.venue}
                    </strong>
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {a.when}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {anonymisedNote ? (
        <p className="text-muted-foreground inline-flex items-center justify-center gap-1.5 text-[11px]">
          <Sparkles className="h-3 w-3" />
          Anonymised — handles, venues, and amounts are shuffled.
        </p>
      ) : null}
    </>
  );
}

export function InboxSegmentTabs({
  active,
  onChange,
  myCount,
  globalCount,
}: {
  active: "mine" | "global";
  onChange: (tab: "mine" | "global") => void;
  myCount: number;
  globalCount: number;
}) {
  return (
    <div className="border-border bg-card flex rounded-full border p-1">
      <InboxTabButton
        active={active === "mine"}
        onClick={() => onChange("mine")}
        label="My activity"
        count={myCount}
      />
      <InboxTabButton
        active={active === "global"}
        onClick={() => onChange("global")}
        label="Global activity"
        count={globalCount}
        dot
      />
    </div>
  );
}

function InboxTabButton({
  active,
  onClick,
  label,
  count,
  dot = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium transition sm:gap-2 sm:px-3 sm:text-sm",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span
            className={cn(
              "absolute inset-0 animate-ping rounded-full",
              active ? "bg-emerald-300/70" : "bg-emerald-500/60",
            )}
          />
          <span
            className={cn(
              "relative h-1.5 w-1.5 rounded-full",
              active ? "bg-emerald-300" : "bg-emerald-500",
            )}
          />
        </span>
      )}
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
          active
            ? "bg-background/20 text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

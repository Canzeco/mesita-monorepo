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
                <p className="text-foreground type-body leading-snug">
                  {a.handle && (
                    <strong className="font-semibold">{a.handle}</strong>
                  )}
                  {a.handle ? " " : ""}
                  {a.verb}{" "}
                  {a.place && (
                    <strong className="text-foreground font-semibold">
                      {a.place}
                    </strong>
                  )}
                </p>
                <p className="text-muted-foreground type-label mt-0.5">
                  {a.when}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {anonymisedNote ? (
        <p className="text-muted-foreground type-label inline-flex items-center justify-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Anonymised — handles, places, and amounts are shuffled.
        </p>
      ) : null}
    </>
  );
}

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SwipeDecisionBadge({
  side,
  active,
  children,
}: {
  side: "left" | "right";
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "type-label pointer-events-none absolute top-4 z-30 rounded-md px-3 py-1 font-bold tracking-wider text-white uppercase transition-all",
        side === "left"
          ? "bg-foreground/40 left-4 border-2 border-white"
          : "bg-pink-gradient right-4",
        active ? "scale-100 opacity-100" : "scale-90 opacity-0",
      )}
    >
      {children}
    </div>
  );
}

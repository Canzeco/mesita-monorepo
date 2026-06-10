"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Sticky, horizontally-scrollable segmented top menu used to split a page
// into subpages (e.g. Place → Details / Media / Hours). Lives at the top
// of a page's scroll body and pins under the Topbar while the content
// below scrolls. Mirrors the consumer app's in-app sub-navigation feel.
export type SubTabItem<T extends string = string> = {
  id: T;
  label: string;
  Icon?: LucideIcon;
  // Optional count badge (e.g. tickets per status). Hidden when undefined.
  count?: number;
};

export function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  equalWidth = false,
}: {
  tabs: readonly SubTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  // When true, tabs share the row evenly (e.g. 5 tabs → 20% each).
  equalWidth?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "bg-background/90 border-border sticky top-0 z-10 -mx-4 border-b py-2 backdrop-blur-md",
        equalWidth
          ? "grid gap-1 px-2"
          : "scrollbar-hide flex gap-1 overflow-x-auto px-4",
        className,
      )}
      style={
        equalWidth && tabs.length > 0
          ? { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {tabs.map(({ id, label, Icon, count }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center rounded-full font-semibold transition",
              equalWidth
                ? "min-w-0 justify-center gap-1 px-1 py-1.5 text-[11px] sm:text-[12px]"
                : "shrink-0 gap-1.5 px-3.5 py-1.5 text-[13px] whitespace-nowrap",
              isActive
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {Icon && (
              <Icon
                className={cn("shrink-0", equalWidth ? "h-3 w-3" : "h-3.5 w-3.5")}
              />
            )}
            <span className={equalWidth ? "truncate" : undefined}>{label}</span>
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                  isActive
                    ? "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

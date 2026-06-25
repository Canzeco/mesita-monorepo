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
  variant = "default",
}: {
  tabs: readonly SubTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  equalWidth?: boolean;
  variant?: "default" | "minimal" | "segmented";
}) {
  const isSegmented = variant === "segmented";
  const segmentedStacked = isSegmented && equalWidth;

  const tabList = (
    <>
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
              "font-semibold transition-all duration-200 ease-out",
              segmentedStacked
                ? "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5"
                : "flex items-center",
              equalWidth && !segmentedStacked
                ? cn(
                    "min-w-0 justify-center gap-1 rounded-lg px-2 py-2 text-[12px]",
                    isSegmented && tabs.length >= 5 && "px-1 text-[11px]",
                    isSegmented && tabs.length >= 6 && "px-0.5 text-[10px]",
                    isSegmented && "py-2.5",
                  )
                : !segmentedStacked &&
                    "shrink-0 gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap",
              isSegmented
                ? isActive
                  ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] ring-1 ring-pink-500/15"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                : variant === "minimal"
                  ? isActive
                    ? "bg-foreground/8 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                  : isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
              !equalWidth && variant === "minimal" && "rounded-lg px-3 py-1.5 text-[12px]",
              equalWidth && variant === "default" && "sm:text-[12px] rounded-full px-1",
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "shrink-0 transition-colors",
                  segmentedStacked ? "h-4 w-4" : equalWidth ? "h-3 w-3" : "h-3.5 w-3.5",
                  isSegmented && isActive && "text-pink-500",
                )}
                strokeWidth={isSegmented && isActive ? 2.25 : 2}
              />
            )}
            <span
              className={cn(
                segmentedStacked
                  ? "max-w-full truncate text-[10px] leading-none tracking-tight"
                  : equalWidth
                    ? "truncate"
                    : undefined,
              )}
            >
              {label}
            </span>
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                  isActive
                    ? isSegmented || variant === "default"
                      ? "bg-muted text-muted-foreground"
                      : "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </>
  );

  if (isSegmented && equalWidth) {
    return (
      <div
        className={cn(
          "border-border/40 sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur-md",
          className,
        )}
      >
        <div
          role="tablist"
          className="border-border/50 bg-muted/35 grid gap-1 rounded-2xl border p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabList}
        </div>
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn(
        variant === "minimal"
          ? "border-border/60 sticky top-0 z-10 -mx-4 border-b bg-background/95 px-3 py-1.5 backdrop-blur-sm"
          : "bg-background/90 border-border sticky top-0 z-10 -mx-4 border-b py-2 backdrop-blur-md",
        equalWidth
          ? "grid gap-1"
          : "scrollbar-hide flex gap-1 overflow-x-auto px-4",
        !equalWidth && variant === "default" && "px-4",
        equalWidth && variant === "minimal" && "px-2",
        equalWidth && variant === "default" && "px-2",
        className,
      )}
      style={
        equalWidth && tabs.length > 0
          ? { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {tabList}
    </div>
  );
}

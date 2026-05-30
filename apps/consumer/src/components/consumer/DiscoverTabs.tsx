"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Flame, Map as MapIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Three Discover modes, ordered left-to-right as an ascending engagement
// curve — lowest-effort browse → spatial → highest-effort AI tool:
//
//   Swipe   →   Map      →   AI-Search
//   flick       pin-map      conversational
//
// Keyword Search + Catalog were removed from the tab bar (their routes stay
// alive as deep links); AI-Search is now the single "search/find" lane.
const TABS = [
  { href: "/discover/swipe", label: "Swipe", Icon: Flame },
  { href: "/discover/map", label: "Map", Icon: MapIcon },
  { href: "/discover/ai", label: "AI-Search", Icon: Search },
];

export function DiscoverTabs() {
  const pathname = usePathname();
  // Optimistic active href — flips the moment the user clicks, before the
  // pathname change lands. Reset on every real pathname change using the
  // "previous-value" pattern (React docs) so we don't need a useEffect,
  // and so browser back/forward correctly clears stale optimism.
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOptimisticHref(null);
  }

  const activeHref = optimisticHref ?? pathname;

  return (
    <div className="px-3 pt-2 pb-1">
      {/* Three tabs share equal flex-1 width; whitespace-nowrap guards
          against any future longer label wrapping. */}
      <div className="border-border bg-card/70 flex items-center gap-0.5 rounded-full border p-1 backdrop-blur">
        {TABS.map(({ href, label, Icon }) => {
          const active = activeHref === href;
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={() => {
                if (href !== pathname) setOptimisticHref(href);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-medium whitespace-nowrap transition",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

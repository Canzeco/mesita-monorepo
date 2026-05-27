"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Flame, LayoutGrid, Map as MapIcon, Search, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

// Five Discover modes, ordered left-to-right as a friction ramp:
//
//   no typing                  │ typed query │ recall
//   Swipe → Map → Catalog      │ AI Search   │ Saved
//   flick  spatial scroll-grid │ ask anything │ yours
//
// AI and Search merged into one tab — the underlying surface (Don
// Memo at /discover/ai) handles both one-word lookups ("sushi") and
// full sentences ("a romantic spot for Friday under MX$800") through
// the same conversational entry. Splitting them into two tabs created
// a false choice. The lupa icon stays because it telegraphs the
// action (search); the "AI" in the label carries the "how it's
// powered" half.
const TABS = [
  { href: "/discover/swipe", label: "Swipe", Icon: Flame },
  { href: "/discover/map", label: "Map", Icon: MapIcon },
  { href: "/discover/catalog", label: "Catalog", Icon: LayoutGrid },
  { href: "/discover/ai", label: "AI Search", Icon: Search },
  { href: "/discover/saved", label: "Saved", Icon: Bookmark },
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
      <div className="border-border bg-card/70 flex items-center gap-1 rounded-full border p-1 backdrop-blur">
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
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-[12px] font-medium transition",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Flame, Map as MapIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Rendered in the top chrome row's center column (see DiscoverHeader),
// flanked by the logo and class chip; discovery filters open from a Filter
// button in the swipe action bar.
const TABS = [
  { href: CONSUMER_ROUTES.explore.swipe, label: "Swipe", Icon: Flame },
  { href: CONSUMER_ROUTES.explore.map, label: "Map", Icon: MapIcon },
  {
    href: CONSUMER_ROUTES.explore.add,
    label: "Add",
    Icon: Sparkles,
    iconClassName: "h-3.5 w-3.5",
    linkClassName: "gap-1.5 px-3",
  },
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
    // Fills the header's center column (flex-1 + min-w-0 so it shrinks on
    // narrow phones); three tabs share equal flex-1 width and whitespace-nowrap
    // guards against label wrapping.
    <div className="segment-control min-w-0 flex-1">
      {TABS.map(({ href, label, Icon, iconClassName, linkClassName }) => {
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
              "segment-tab",
              linkClassName,
              active ? "segment-tab-active" : "segment-tab-idle",
            )}
          >
            <Icon className={cn("h-3 w-3 shrink-0", iconClassName)} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

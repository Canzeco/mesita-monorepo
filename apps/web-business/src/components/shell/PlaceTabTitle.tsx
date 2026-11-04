"use client";

// The open place page's title (MESITA-3151): the same grey icon, name and
// one line on every page, under the place's name.

import { usePathname } from "next/navigation";
import { placeTabFromPathname } from "@/lib/routes";
import { PLACE_TAB_META } from "./place-tab-meta";

export function PlaceTabTitle({ right }: { right?: React.ReactNode }) {
  const tab = placeTabFromPathname(usePathname());
  if (!tab) return null;
  const { label, icon: Icon, sub } = PLACE_TAB_META[tab];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="bg-card border-border flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-xs">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{label}</h2>
          <p className="text-muted-foreground text-sm">{sub}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

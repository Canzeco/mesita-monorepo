"use client";

// The open place page's header (MESITA-3151; the band since MESITA-3232): its
// name and one line. The place's name and your role are in the side menu.

import { usePathname } from "next/navigation";
import { placeTabFromPathname } from "@/lib/routes";
import { PageHeader } from "./Page";
import { PLACE_TAB_META } from "./place-tab-meta";

export function PlaceTabTitle({ right }: { right?: React.ReactNode }) {
  const tab = placeTabFromPathname(usePathname());
  if (!tab) return null;
  const { label, sub } = PLACE_TAB_META[tab];
  return <PageHeader title={label} sub={sub} right={right} />;
}

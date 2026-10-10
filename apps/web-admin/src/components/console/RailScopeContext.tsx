"use client";

// Admin's answer to the business console's rail scope (MESITA-2086). The
// shared place surface (PromosSection) reads `useRailScopeContext()?.places`
// to find the place's own catalogue row — partnered, Mesita Pay, the viewer's
// role. Admin has no rail to resolve a scope from, so the place layout
// publishes ONE row: the place being managed, read from the console catalogue
// with scope "all". Null outside that layout, exactly as in business.

import { createContext, useContext } from "react";
import type { ConsolePlace } from "@/lib/api/console";

export type RailScopeValue = {
  places: readonly ConsolePlace[];
  isSuperAdmin: boolean;
};

const RailScopeContext = createContext<RailScopeValue | null>(null);

export function RailScopeProvider({
  value,
  children,
}: {
  value: RailScopeValue;
  children: React.ReactNode;
}) {
  return <RailScopeContext.Provider value={value}>{children}</RailScopeContext.Provider>;
}

/** Null outside the place layout (a page rendered without it, or a test). */
export function useRailScopeContext(): RailScopeValue | null {
  return useContext(RailScopeContext);
}

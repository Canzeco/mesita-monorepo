"use client";

// The rail's scope, shared with the page (MESITA-1822).
//
// AppShell resolves the scope ONCE (lib/use-rail-scope.ts) for the two rail
// instances and the header. A page needs the same answer — the place ladder
// reads its place's two tier flags off this rather than paying a second
// console-viewer call per navigation (MESITA-1867) — so the shell provides it
// and the page reads it. One resolution, four readers, no drift.
import { createContext, useContext } from "react";
import type { RailPlace, RailScope } from "@/lib/rail-scope";

export type RailScopeValue = {
  scope: RailScope;
  places: readonly RailPlace[];
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

/** Null outside the shell (a page rendered without AppShell, or a test). */
export function useRailScopeContext(): RailScopeValue | null {
  return useContext(RailScopeContext);
}

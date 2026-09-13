"use client";

// The rail's scope, shared with the page (MESITA-1822).
//
// AppShell resolves the scope ONCE (lib/use-rail-scope.ts) for the two rail
// instances and the header. The Organization page needs the same answer —
// its switchers ("change organization, change place", Pato 2026-09-13) live
// on the page, not in the rail — so the shell provides it and the page reads
// it. One resolution, four readers, no drift.
import { createContext, useContext } from "react";
import type { RailOrg, RailScope } from "@/lib/rail-scope";

export type RailScopeValue = {
  scope: RailScope;
  organizations: readonly RailOrg[];
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

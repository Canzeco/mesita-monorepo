"use client";

// The rail's scope, resolved ONCE for every piece of chrome (MESITA-1807).
//
// AppShell calls this and hands the answer to both rail instances and the
// header, so the three can never disagree about which organization or place
// is on screen — the drift MESITA-1713 found when each resolved it alone.
// The rule itself is pure (lib/rail-scope.ts); this hook only feeds it the
// pathname and the session's last place.
import { usePathname } from "next/navigation";
import { useLastPlaceId } from "@/components/console/OpenPlace";
import { resolveRailScope, type RailOrg, type RailScope } from "@/lib/rail-scope";

export function useRailScope(input: {
  organizations: readonly RailOrg[];
  rememberedPlaceId: string | null;
  rememberedOrgId: string | null;
  /** The organizations read failed (`(shell)/layout.tsx`). Carried, never
   *  re-derived: an empty array is a different fact (MESITA-1879). */
  viewerError: boolean;
}): RailScope {
  const pathname = usePathname();
  const lastPlaceId = useLastPlaceId();
  return resolveRailScope({
    organizations: input.organizations,
    pathname,
    lastPlaceId,
    rememberedPlaceId: input.rememberedPlaceId,
    rememberedOrgId: input.rememberedOrgId,
    viewerError: input.viewerError,
  });
}

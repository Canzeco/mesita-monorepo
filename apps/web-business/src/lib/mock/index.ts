// Mock data resolver — the ONLY door components use. Swapping this module
// for the real Edge Function client is the entire backend migration for
// the shell (both must satisfy src/lib/model/types.ts).
//
// The org switcher is a `?org=` search param so Server Components can read
// it. Unknown/absent values fall back to the established org — a garbage
// param must never crash a page.
import type { OrgData, Place } from "@/lib/model/types";
import { grupoRuiz } from "./grupo-ruiz";
import { nuevo } from "./nuevo";

export const ORGS: Record<string, OrgData> = {
  "grupo-ruiz": grupoRuiz,
  nuevo,
};

export const DEFAULT_ORG_KEY = "grupo-ruiz";

export function resolveOrgKey(param: string | string[] | undefined): string {
  const key = Array.isArray(param) ? param[0] : param;
  return key && key in ORGS ? key : DEFAULT_ORG_KEY;
}

export function getOrg(param: string | string[] | undefined): OrgData {
  return ORGS[resolveOrgKey(param)];
}

export function getPlace(
  param: string | string[] | undefined,
  placeId: string,
): Place | undefined {
  return getOrg(param).places.find((p) => p.id === placeId);
}

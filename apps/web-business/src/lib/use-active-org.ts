"use client";

// WHICH organization is on screen — resolved ONCE, for every piece of chrome.
//
// A server layout cannot read searchParams, so it cannot answer this; it can
// only pass the list. Every client component that renders chrome therefore has
// to resolve `?org=` itself, and the first version of the rail had three copies
// of the rule: the rail's own switcher, the header's breadcrumb, and the mobile
// wordmark's href.
//
// They drifted immediately, which is the whole argument for this file. The
// header was handed a server-resolved `organizations[0]` and rendered it for
// the life of the session, so a multi-org operator saw one name in the switcher
// and a DIFFERENT name in the breadcrumb that exists to say whose data is on
// screen — the one line whose entire job is to not lie about that.
//
// The rule itself is the same one every page uses server-side: `?org=` when it
// names an organization you belong to, else the first. Never trust the param
// on its own — an id you are not a member of must resolve exactly like an id
// that does not exist, or the fallback becomes a membership oracle.

import { useSearchParams } from "next/navigation";
import type { Organization } from "@/lib/api/organizations";

export type ChromeOrg = Pick<Organization, "id" | "name">;

/** What the RAIL needs of an organization: the chrome pair plus the viewer's
 *  role (which of a place's views they may open) and the places it holds
 *  (MESITA-1779). A RailOrg is a ChromeOrg, so the header and the resolver
 *  below take it unchanged. */
export type RailOrg = Pick<Organization, "id" | "name" | "myRole" | "places">;

/** The rule, without React, so it can be tested as the rule it is. Mirrors
 *  `resolveActiveOrg`, which every page applies server-side. Generic so a
 *  caller holding RailOrgs gets a RailOrg back, not the narrower pair. */
export function resolveChromeOrg<T extends ChromeOrg>(
  organizations: T[],
  requested: string | null,
): T | null {
  return (
    (requested ? organizations.find((o) => o.id === requested) : undefined) ??
    organizations[0] ??
    null
  );
}

export function useActiveOrg<T extends ChromeOrg>(organizations: T[]): {
  activeOrg: T | null;
  activeOrgId: string | null;
} {
  const activeOrg = resolveChromeOrg(organizations, useSearchParams().get("org"));
  return { activeOrg, activeOrgId: activeOrg?.id ?? null };
}

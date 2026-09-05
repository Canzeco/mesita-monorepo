// Which organization is this request about?
//
// The console is org-scoped: an account may belong to several, so every
// screen needs one resolved the same way. `?org=` wins when it names an
// organization the caller actually belongs to; otherwise the first one.
// An unknown or foreign id falls back rather than erroring — a stale link
// should land you somewhere sane, and it must never become a way to probe
// which organization ids exist.
import type { Organization } from "@/lib/api/organizations";

export function resolveActiveOrg(
  organizations: Organization[],
  requested: string | string[] | undefined,
): Organization | null {
  if (organizations.length === 0) return null;
  const wanted = Array.isArray(requested) ? requested[0] : requested;
  const match = wanted ? organizations.find((o) => o.id === wanted) : undefined;
  return match ?? organizations[0];
}

/** Claiming and releasing are writes; a viewer may read the portfolio but
 *  not change it. Release is owner-only server-side — this mirrors the EF
 *  guard so the UI doesn't offer a button that will 403. */
export function canClaim(role: Organization["myRole"]): boolean {
  return role === "owner" || role === "editor";
}
export function canRelease(role: Organization["myRole"]): boolean {
  return role === "owner";
}

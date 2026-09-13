// Which organization, which place — the pure rules, with no React and no
// server imports, so the rail (client), the root resolver (server) and the
// tests all read the SAME function.
//
// THE PATH IS THE STATE (MESITA-1807). `/orgs/<id>/…` names the organization
// and `/places/<id>/…` names the place; the rules below only fill in what the
// path does not say — which place the rail shows while you are on an
// organization page, and where `/` lands.
//
// NEVER AN ORACLE. An id you are not a member of resolves exactly like an id
// that does not exist: `findOrg` answers null for both, the org layout
// answers 404 for both, and the fallbacks below never distinguish them. A
// rule that treated a foreign id differently from a nonexistent one would
// let anyone with a URL bar probe which organizations exist.
import type { Organization, RailPlace } from "@/lib/api/organizations";

type OrgLike = { id: string };
type Portfolio = OrgLike & { places: RailPlace[] };

/** The organization with this id, if the caller belongs to it. */
export function findOrg<T extends OrgLike>(
  orgs: readonly T[],
  orgId: string | null | undefined,
): T | null {
  if (!orgId) return null;
  return orgs.find((o) => o.id === orgId) ?? null;
}

/** The organization to assume when the path names none (Account, the
 *  ceremony, a pool place, `/`): the one remembered from the last visit if
 *  the caller still belongs to it, else the first. Null only when the caller
 *  belongs to none. */
export function preferredOrg<T extends OrgLike>(
  orgs: readonly T[],
  rememberedOrgId: string | null | undefined,
): T | null {
  return findOrg(orgs, rememberedOrgId) ?? orgs[0] ?? null;
}

/** Who holds this place, searched across EVERY organization the caller is
 *  in — a pasted link to org A's place while org B was remembered must still
 *  find A. Null for a pool place, and for a place held by an organization
 *  the caller is not in (the place layout answers 404 for that one). */
export function findHolder<T extends Portfolio>(
  orgs: readonly T[],
  placeId: string | null | undefined,
): { org: T; place: RailPlace } | null {
  if (!placeId) return null;
  for (const org of orgs) {
    const place = org.places.find((p) => p.id === placeId);
    if (place) return { org, place };
  }
  return null;
}

/** The place the rail shows for an organization when the path names none:
 *  the first candidate the organization actually holds (a released place or
 *  another organization's id falls through), else its first place by name
 *  (the EF sorts them), else none. */
export function pickPlace(
  org: Portfolio | null,
  ...candidateIds: (string | null | undefined)[]
): RailPlace | null {
  if (!org) return null;
  for (const id of candidateIds) {
    if (!id) continue;
    const hit = org.places.find((p) => p.id === id);
    if (hit) return hit;
  }
  return org.places[0] ?? null;
}

/** Where `/` lands. */
export type Landing =
  | { kind: "place"; placeId: string }
  | { kind: "org"; orgId: string }
  | { kind: "create" };

/** The resolver behind `/` (Pato, D3 2026-09-12): the last place opened,
 *  searched across every organization; else the remembered (or first)
 *  organization's first place; else that organization's Overview; else
 *  Create, and ONLY from a successful empty list — a failed read throws
 *  before this is ever called. */
export function resolveLanding<T extends Portfolio>(input: {
  organizations: readonly T[];
  rememberedPlaceId: string | null | undefined;
  rememberedOrgId: string | null | undefined;
}): Landing {
  const { organizations, rememberedPlaceId, rememberedOrgId } = input;
  const held = findHolder(organizations, rememberedPlaceId);
  if (held) return { kind: "place", placeId: held.place.id };
  const org = preferredOrg(organizations, rememberedOrgId);
  if (!org) return { kind: "create" };
  const place = pickPlace(org);
  return place
    ? { kind: "place", placeId: place.id }
    : { kind: "org", orgId: org.id };
}

/** Claiming and releasing are writes; a viewer may read the portfolio but
 *  not change it. Release is owner-only server-side — this mirrors the EF
 *  guard so the UI doesn't offer a button that will 403. */
export function canClaim(role: Organization["myRole"]): boolean {
  return role === "owner" || role === "editor";
}

/** The Add place ceremony (create or claim-from-search) is owner-only,
 *  matching `business-web-claim-place`. Editors still see Claim on the
 *  list; that button 403s today and is not this door. */
export function canAddPlace(role: Organization["myRole"]): boolean {
  return role === "owner";
}
export function canRelease(role: Organization["myRole"]): boolean {
  return role === "owner";
}

/** Verifying is the proof half of the claim ceremony, so it carries the same
 *  law as the ownership moves it completes: owner only, matching
 *  business-web-verify-place's own guard. Named rather than borrowing
 *  canRelease, because the two answering the same today is a coincidence of
 *  the role table, not a rule — and a later split should not have to guess
 *  which callers meant which. */
export function canVerify(role: Organization["myRole"]): boolean {
  return role === "owner";
}

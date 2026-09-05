// The org path must never grant `owner`.
//
// This is the invariant the whole hierarchy rests on. place-ownership.ts
// `isLastOwnerOfPlace` counts project_members rows with role='owner', so an
// org-derived owner would count 0 and break ownership transfer and member
// removal against project_members_one_owner_per_project; and
// business-web-get-overview attaches the Staff Check PIN on the owner
// branch. Raising the ceiling silently breaks all three at once.
//
// checkMembership does IO, so these tests exercise the pure resolution the
// EF composes: cap the org role, then take the stronger of the two paths.

import { assertEquals } from "jsr:@std/assert@1";

type Role = "owner" | "editor" | "viewer" | "staff";
const RANK: Record<Role, number> = { viewer: 1, staff: 1, editor: 2, owner: 3 };
const CEILING: Role = "editor";

function capOrgRole(role: Role | null): Role | null {
  if (!role) return null;
  return RANK[role] > RANK[CEILING] ? CEILING : role;
}
function stronger(a: Role | null, b: Role | null): Role | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[a] >= RANK[b] ? a : b;
}
function resolve(direct: Role | null, org: Role | null): Role | null {
  return stronger(direct, capOrgRole(org));
}

Deno.test("org owner is capped to editor on the place", () => {
  assertEquals(capOrgRole("owner"), "editor");
});

Deno.test("org path never yields owner, for any org role", () => {
  for (const r of ["owner", "editor", "viewer"] as Role[]) {
    assertEquals(resolve(null, r) === "owner", false);
  }
});

Deno.test("every project-role x org-role combination", () => {
  const roles: (Role | null)[] = [null, "viewer", "editor", "owner"];
  const expected: Record<string, Role | null> = {
    "null|null": null,
    "null|viewer": "viewer",
    "null|editor": "editor",
    "null|owner": "editor", // capped
    "viewer|null": "viewer",
    "viewer|viewer": "viewer",
    "viewer|editor": "editor",
    "viewer|owner": "editor", // capped, still beats viewer
    "editor|null": "editor",
    "editor|viewer": "editor",
    "editor|editor": "editor",
    "editor|owner": "editor",
    "owner|null": "owner",
    "owner|viewer": "owner", // direct owner survives a weaker org role
    "owner|editor": "owner",
    "owner|owner": "owner", // direct owner, NOT the capped org path
  };
  for (const d of roles) {
    for (const o of roles) {
      const key = `${d ?? "null"}|${o ?? "null"}`;
      assertEquals(resolve(d, o), expected[key], `combination ${key}`);
    }
  }
});

Deno.test("a direct owner is never demoted by the cap", () => {
  assertEquals(resolve("owner", "owner"), "owner");
  assertEquals(resolve("owner", null), "owner");
});

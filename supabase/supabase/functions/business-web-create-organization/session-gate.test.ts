// The gate that replaced the managers-row check (MESITA-1623). Two things
// have to stay true at once: a consumer session still cannot mint an
// organization, and a business session with no managers row still can.
import { assert, assertEquals } from "jsr:@std/assert";
import { mayCreateOrganization } from "./session-gate.ts";

const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("business and admin sessions pass", () => {
  assert(mayCreateOrganization({ appRole: "business", email: "a@b.com" }));
  assert(mayCreateOrganization({ appRole: "admin", email: "a@b.com" }));
});

Deno.test("consumer and staff sessions are refused", () => {
  // The pool that must never reach the claim path. Consumers are phone-only,
  // but refuse them even if an email is somehow present.
  assertEquals(mayCreateOrganization({ appRole: "consumer", email: null }), false);
  assertEquals(
    mayCreateOrganization({ appRole: "consumer", email: "a@b.com" }),
    false,
  );
  assertEquals(mayCreateOrganization({ appRole: "staff", email: null }), false);
});

Deno.test("an unstamped email session passes; an unstamped phone session does not", () => {
  // A business mid-sign-up whose role stamp has not landed yet. Refusing it
  // would trade the old dead end for a new one.
  assert(mayCreateOrganization({ appRole: null, email: "a@b.com" }));
  assertEquals(mayCreateOrganization({ appRole: null, email: null }), false);
});

Deno.test("a missing managers row is ensured, never refused", () => {
  // The regression this issue exists for: reading the row and 403ing on a
  // miss stranded every session that outlived admin_reset_database.
  assert(
    !SRC.includes("No business account for this session"),
    "a missing managers row must not be a 403",
  );
  assert(
    /\.from\("managers"\)\s*\.upsert\(/.test(SRC),
    "the managers row must be upserted before the membership insert",
  );
  assert(
    SRC.indexOf('.from("managers")') < SRC.indexOf('.from("organization_members")'),
    "the FK target must exist before the membership insert",
  );
});

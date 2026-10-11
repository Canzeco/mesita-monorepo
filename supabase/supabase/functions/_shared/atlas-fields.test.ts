// MESITA-1740 — the Profile editor's vocabulary has ONE body.
//
// `_shared/atlas-fields.ts` states the catalog once; `admin-web-get-atlas-fields`
// is a super-admin guard in front of it. It had a business twin until the
// business console was deleted (MESITA-2090), and the body stays shared so a
// future door cannot drift the caps an operator's editor enforces.
import { assert, assertStringIncludes } from "jsr:@std/assert@1";

const ADMIN_DOOR = new URL("../admin-web-get-atlas-fields/index.ts", import.meta.url);
const SHARED = new URL("./atlas-fields.ts", import.meta.url);

const read = async (url: URL) => await Deno.readTextFile(url);

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("the catalog is stated once", async () => {
  const shared = codeOnly(await read(SHARED));
  assertStringIncludes(shared, "fetchPlaceCategories(");
  assertStringIncludes(shared, "fetchPlaceTags(");
  assertStringIncludes(shared, "ENRICH_FIELD_LIMITS");
});

Deno.test("the door does not re-declare the catalog", async () => {
  const code = codeOnly(await read(ADMIN_DOOR));
  assert(
    !code.includes("fetchPlaceCategories("),
    "admin-web-get-atlas-fields fetches categories itself — it would drift from the shared body",
  );
  assertStringIncludes(
    code,
    '"../_shared/atlas-fields.ts"',
    "admin-web-get-atlas-fields does not share the body",
  );
});

Deno.test("the door is super-admin only", async () => {
  const admin = codeOnly(await read(ADMIN_DOOR));
  assertStringIncludes(admin, "requireSuperAdmin(");
  assert(!admin.includes("requireEditor("), "the admin door must stay super-admin only");
});

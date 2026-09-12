// MESITA-1740 — the Profile editor's vocabulary has TWO doors and ONE body.
//
// `admin-web-get-atlas-fields` is requireSuperAdmin. The business Profile
// tab cannot render its category picker, tag picker or character counters
// without the same catalog, and for an operator the FALLBACK_LIMITS in
// PlaceSection were the only values — silently the wrong caps. The EF
// name is the ACL, so the fix is a second door rather than a widened one.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

const ADMIN_DOOR = new URL("../admin-web-get-atlas-fields/index.ts", import.meta.url);
const BUSINESS_DOOR = new URL(
  "../business-web-get-atlas-fields/index.ts",
  import.meta.url,
);
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

Deno.test("neither door re-declares the catalog", async () => {
  for (
    const [name, url] of [["admin", ADMIN_DOOR], ["business", BUSINESS_DOOR]] as const
  ) {
    const code = codeOnly(await read(url));
    assert(
      !code.includes("fetchPlaceCategories("),
      `${name}-web-get-atlas-fields fetches categories itself — the two doors would drift`,
    );
    assertStringIncludes(
      code,
      '"../_shared/atlas-fields.ts"',
      `${name}-web-get-atlas-fields does not share the body`,
    );
  }
});

Deno.test("the two doors differ in who may open them", async () => {
  const admin = codeOnly(await read(ADMIN_DOOR));
  const business = codeOnly(await read(BUSINESS_DOOR));

  assertStringIncludes(admin, "requireSuperAdmin(");
  assert(!admin.includes("requireEditor("), "the admin door must stay super-admin only");

  assert(
    !business.includes("requireSuperAdmin("),
    "the business door must not require a super-admin — that is the bug this split fixed",
  );
  assertStringIncludes(business, "getAuthedUser(");
  assertEquals(
    business.includes("requireMembership("),
    false,
    "the catalog is not place-specific — membership is the wrong gate",
  );
});

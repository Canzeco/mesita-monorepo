// admin-web-get-families is the Families page door. Super-admin only,
// and it builds the map instead of copying the taxonomy into the client.
import { assert, assertStringIncludes } from "jsr:@std/assert@1";

const DOOR = new URL("../admin-web-get-families/index.ts", import.meta.url);

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("the families door is super-admin only and reads the map", async () => {
  const admin = codeOnly(await Deno.readTextFile(DOOR));
  assertStringIncludes(admin, "requireSuperAdmin(");
  assertStringIncludes(admin, "buildFamiliesMap(");
  assertStringIncludes(admin, "fetchPlaceTags(");
  assertStringIncludes(admin, "fetchGoogleCategories(");
  assert(
    !admin.includes("requireEditor("),
    "the admin door must stay super-admin only",
  );
});

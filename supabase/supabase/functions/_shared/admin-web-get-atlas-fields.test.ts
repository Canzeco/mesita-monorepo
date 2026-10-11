// admin-web-get-atlas-fields serves the Profile editor's vocabulary (families,
// categories, tags, facets, field limits). It must stay super-admin only.
import { assert, assertStringIncludes } from "jsr:@std/assert@1";

const ADMIN_DOOR = new URL("../admin-web-get-atlas-fields/index.ts", import.meta.url);

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("the door is super-admin only", async () => {
  const admin = codeOnly(await Deno.readTextFile(ADMIN_DOOR));
  assertStringIncludes(admin, "requireSuperAdmin(");
  assert(!admin.includes("requireEditor("), "the admin door must stay super-admin only");
});

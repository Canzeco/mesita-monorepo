// admin-web-get-atlas-fields is the vocabulary door (families, categories,
// tags, facets, field limits). The Single Place profile does not call it —
// that read is admin-web-get-overview. This door stays super-admin only.
import { assert, assertStringIncludes } from "jsr:@std/assert@1";

const ADMIN_DOOR = new URL("../admin-web-get-atlas-fields/index.ts", import.meta.url);

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("the door is super-admin only", async () => {
  const admin = codeOnly(await Deno.readTextFile(ADMIN_DOOR));
  assertStringIncludes(admin, "requireAdminRequest(");
  assert(!admin.includes("requireEditor("), "the admin door must stay super-admin only");
});

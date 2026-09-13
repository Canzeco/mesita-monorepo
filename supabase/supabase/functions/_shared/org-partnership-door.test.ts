// MESITA-1798 — org Partner is a NARROW door: a boolean, never a plan field.
import { assert, assertStringIncludes } from "jsr:@std/assert@1";

const DOOR = new URL("../business-web-set-org-partnership/index.ts", import.meta.url);
const BODY = new URL("./org-partnership.ts", import.meta.url);

const read = async (url: URL) => await Deno.readTextFile(url);

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("the org Partner door does not take a plan field", async () => {
  const door = codeOnly(await read(DOOR));
  assertStringIncludes(door, "requireOrgRole(");
  assertStringIncludes(door, '["owner"]');
  assertStringIncludes(door, "setOrgPartnership(");
  assert(
    !door.includes("body.plan"),
    "a client must not pick plan through the org Partner door",
  );
});

Deno.test("the org Partner body lives once, in _shared", async () => {
  const door = codeOnly(await read(DOOR));
  const body = await Deno.readTextFile(BODY);
  assertStringIncludes(door, '"../_shared/org-partnership.ts"');
  assert(
    !door.includes("mesita_pay_enabled:"),
    "the door must not re-declare the cascade — that is how it would drift from claim-place",
  );
  assert(
    body.includes("mesita_pay_enabled: partnered"),
    "turning Partner on is what writes the org Mesita Pay package",
  );
  assert(
    body.includes('"stripe_not_ready"'),
    "Stripe Ready is the lock, and the body is the one that names the 409",
  );
});

// The admin Discovery box shows each family's Google battery read-only
// (`SUPER_FIELDS` in apps/web-admin/…/filters-config/catalog.ts). It is a
// hand copy, so this pins it to the batteries the Edge Functions send
// (MESITA-2438): a battery that changes here and not there would show the
// operator a bill Google never sees.
import { assertEquals } from "jsr:@std/assert@1";
import { GOOGLE_SEARCH_TYPES } from "./google-type-super.ts";

const ADMIN_CATALOG = new URL(
  "../../../../apps/web-admin/src/app/(app)/filters-config/catalog.ts",
  import.meta.url,
);

Deno.test("admin SUPER_FIELDS batteries equal GOOGLE_SEARCH_TYPES", async () => {
  const src = await Deno.readTextFile(ADMIN_CATALOG);
  const rows = [...src.matchAll(/\{\s*key: "([a-z_]+)",[^{}]*?battery: \[([^\]]*)\]/g)];
  if (rows.length === 0) throw new Error("no SUPER_FIELDS rows parsed");
  const admin = Object.fromEntries(
    rows.map((m) => [m[1], [...m[2].matchAll(/"([a-z_]+)"/g)].map((t) => t[1])]),
  );
  const ef = Object.fromEntries(
    Object.entries(GOOGLE_SEARCH_TYPES).filter(([k]) => k !== "undefined").map(([k, v]) => [k, [...v]]),
  );
  assertEquals(admin, ef);
});

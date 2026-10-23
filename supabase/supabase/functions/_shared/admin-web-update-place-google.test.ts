import { assertEquals } from "jsr:@std/assert@1";

const SRC = await Deno.readTextFile(
  new URL("../admin-web-update-place-google/index.ts", import.meta.url),
);

const CODE = SRC.split("\n")
  .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
  .join("\n");

Deno.test("admin-web-update-place-google is super-admin only", () => {
  assertEquals(CODE.includes("requireSuperAdmin(admin, authRes.user"), true);
});

Deno.test("admin-web-update-place-google delegates to shared Google update", () => {
  assertEquals(CODE.includes("runGooglePlaceUpdate("), true);
  assertEquals(CODE.includes("fetchGoogleBasics("), false);
});

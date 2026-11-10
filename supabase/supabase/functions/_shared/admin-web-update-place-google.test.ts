import { assertEquals } from "jsr:@std/assert@1";

const code = (src: string) =>
  src.split("\n")
    .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
    .join("\n");

const read = async (path: string) => code(await Deno.readTextFile(new URL(path, import.meta.url)));

// The body is shared since MESITA-3157; both doors run only it.
const HANDLER = await read("./google-update-handler.ts");
const DOORS = {
  "admin-web-update-place-google": await read("../admin-web-update-place-google/index.ts"),
  "business-web-update-place-google": await read("../business-web-update-place-google/index.ts"),
};

Deno.test("the Google update body is super-admin only", () => {
  assertEquals(HANDLER.includes("requireAdminRequest(req"), true);
});

Deno.test("the Google update body delegates to the shared Google update", () => {
  assertEquals(HANDLER.includes("runGooglePlaceUpdate("), true);
  assertEquals(HANDLER.includes("fetchGoogleBasics("), false);
});

for (const [name, src] of Object.entries(DOORS)) {
  Deno.test(`${name} runs only the shared, super-admin body`, () => {
    assertEquals(src.includes(`handleGooglePlaceUpdate(req, "${name}")`), true);
    assertEquals(src.includes("runGooglePlaceUpdate("), false);
  });
}

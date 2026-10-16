// Save stores the link. Sync is a different door.
import { assertEquals } from "jsr:@std/assert@1";

const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const CODE = SRC.split("\n")
  .filter((line) => {
    const trimmed = line.trimStart();
    return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
  })
  .join("\n");

Deno.test("a profile save does not verify or sync a link", () => {
  assertEquals(CODE.includes("reviewPatchForSocialEdit"), false);
  assertEquals(CODE.includes("verifyChangedSocialLinks"), false);
  assertEquals(CODE.includes("runPlaceSync"), false);
  assertEquals(CODE.includes("reviewsTileKeyInBody"), true);
});

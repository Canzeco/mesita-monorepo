// Save stores the link; Sync is a different door. And an owner's save carries
// only the profile a guest reads (MESITA-3103).
import { assertEquals } from "jsr:@std/assert@1";
import { firstNonOwnerField, OWNER_WRITABLE_FIELDS } from "./place-update-apply.ts";

const SRC = await Deno.readTextFile(new URL("./place-update-apply.ts", import.meta.url));
const CODE = SRC.split("\n")
  .filter((line) => {
    const trimmed = line.trimStart();
    return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
  })
  .join("\n");

Deno.test("a profile save does not verify or sync a link", () => {
  assertEquals(CODE.includes("reviewPatchForSocialEdit"), false);
  assertEquals(CODE.includes("runPlaceSync"), false);
  assertEquals(CODE.includes("reviewsTileKeyInBody"), true);
});

Deno.test("an owner may not flip Mesita's switches", () => {
  for (const key of ["prepay_enabled", "reservations_enabled", "reservation_channel", "mesita_photos"]) {
    assertEquals(firstNonOwnerField({ id: "p", name: "x", [key]: true }), key);
  }
});

Deno.test("an owner's profile body passes whole", () => {
  const body: Record<string, unknown> = { id: "p" };
  for (const key of OWNER_WRITABLE_FIELDS) body[key] = null;
  assertEquals(firstNonOwnerField(body), null);
});

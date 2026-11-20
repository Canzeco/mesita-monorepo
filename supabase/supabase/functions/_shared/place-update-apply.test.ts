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

Deno.test("an owner may not flip Mesita's remaining switches", () => {
  for (const key of ["prepay_enabled", "reservation_channel", "mesita_photos", "payments_enabled"]) {
    assertEquals(firstNonOwnerField({ id: "p", name: "x", [key]: true }), key);
  }
});

Deno.test("an owner may save the Reservations switch and phone (MESITA-4137)", () => {
  assertEquals(firstNonOwnerField({ id: "p", reservations_enabled: false }), null);
  assertEquals(firstNonOwnerField({ id: "p", reservation_target: "+528183782164" }), null);
  assertEquals(OWNER_WRITABLE_FIELDS.includes("reservations_enabled"), true);
  assertEquals(OWNER_WRITABLE_FIELDS.includes("reservation_target"), true);
});

Deno.test("an owner's profile body passes whole", () => {
  const body: Record<string, unknown> = { id: "p" };
  for (const key of OWNER_WRITABLE_FIELDS) body[key] = null;
  assertEquals(firstNonOwnerField(body), null);
});

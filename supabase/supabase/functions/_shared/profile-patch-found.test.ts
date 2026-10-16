import { assertEquals } from "jsr:@std/assert@1";
import { withoutFoundFlags } from "./profile-patch-found.ts";

Deno.test("found flags leave the profile patch and stay booleans", () => {
  const { profile, found } = withoutFoundFlags({
    content_state: "ready",
    phone: "+52 55 0000 0000",
    google_found: true,
    instagram_found: false,
    facebook_found: true,
  });
  assertEquals(profile, { content_state: "ready", phone: "+52 55 0000 0000" });
  assertEquals(found, { google_found: true, instagram_found: false, facebook_found: true });
});

Deno.test("a patch with no found flags writes nothing extra", () => {
  const { profile, found } = withoutFoundFlags({
    content_state: "ready",
    description: "A nightclub.",
  });
  assertEquals(profile, { content_state: "ready", description: "A nightclub." });
  assertEquals(found, {});
});

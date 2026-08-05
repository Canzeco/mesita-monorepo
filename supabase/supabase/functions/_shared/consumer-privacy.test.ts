import { assertEquals } from "jsr:@std/assert";
import {
  ANONYMOUS_GUEST_NAME,
  isPrivateAccount,
  publicGuestIdentity,
  storiesVisibleOnMesita,
} from "./consumer-privacy.ts";

Deno.test("isPrivateAccount: only explicit false is private", () => {
  assertEquals(isPrivateAccount(false), true);
  assertEquals(isPrivateAccount(true), false);
  assertEquals(isPrivateAccount(null), false);
  assertEquals(isPrivateAccount(undefined), false);
});

Deno.test("publicGuestIdentity: private strips name + handle", () => {
  assertEquals(
    publicGuestIdentity({
      profile_public: false,
      full_name: "Ada Lovelace",
      first_name: "Ada",
      instagram_handle: "ada",
    }),
    { name: ANONYMOUS_GUEST_NAME, handle: "", anonymous: true },
  );
});

Deno.test("publicGuestIdentity: public keeps name + @handle", () => {
  assertEquals(
    publicGuestIdentity({
      profile_public: true,
      full_name: "Ada Lovelace",
      instagram_handle: "ada",
    }),
    { name: "Ada Lovelace", handle: "@ada", anonymous: false },
  );
});

Deno.test("storiesVisibleOnMesita: default on, explicit false hides", () => {
  assertEquals(storiesVisibleOnMesita(true), true);
  assertEquals(storiesVisibleOnMesita(undefined), true);
  assertEquals(storiesVisibleOnMesita(null), true);
  assertEquals(storiesVisibleOnMesita(false), false);
});

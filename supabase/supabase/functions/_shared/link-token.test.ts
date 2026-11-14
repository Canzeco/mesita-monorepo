// The calendar feed's token (MESITA-3954) is the only key to a guest's
// reservations: pin that it is long, base64url and unguessable-shaped.

import { assert } from "jsr:@std/assert@1";
import { isLinkToken, newLinkToken } from "./link-token.ts";

Deno.test("a new link token is 43 base64url characters", () => {
  const t = newLinkToken();
  assert(isLinkToken(t) && t.length === 43);
  assert(newLinkToken() !== t);
});

Deno.test("short or slashed tokens are refused", () => {
  assert(!isLinkToken("short"));
  assert(!isLinkToken("has/slash-kwkPzBJxhN_m0smCvKOxUbFu7jauVe1D"));
});

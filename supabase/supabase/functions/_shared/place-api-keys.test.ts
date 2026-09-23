import { assertEquals } from "jsr:@std/assert";
import {
  PLACE_API_KEY_PREFIX,
  hashPlaceApiKey,
  mintPlaceApiKeyPlaintext,
} from "./place-api-keys.ts";

Deno.test("mintPlaceApiKeyPlaintext uses mesita_place_ prefix and stable hash", async () => {
  const a = await mintPlaceApiKeyPlaintext();
  assertEquals(a.plaintext.startsWith(PLACE_API_KEY_PREFIX), true);
  assertEquals(a.prefix, a.plaintext.slice(0, 16));
  assertEquals(a.hash, await hashPlaceApiKey(a.plaintext));
});

Deno.test("hashPlaceApiKey differs for different secrets", async () => {
  const a = await hashPlaceApiKey(`${PLACE_API_KEY_PREFIX}aaa`);
  const b = await hashPlaceApiKey(`${PLACE_API_KEY_PREFIX}bbb`);
  assertEquals(a === b, false);
});

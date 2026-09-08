import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import {
  generateGiftCode,
  GIFT_CODE_LENGTH,
  hashGiftCode,
  isPlausibleGiftCode,
} from "./gift-code.ts";

Deno.test("generateGiftCode: ten digits, never a leading zero", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateGiftCode();
    assertEquals(code.length, GIFT_CODE_LENGTH);
    assert(/^[1-9][0-9]{9}$/.test(code), `bad code: ${code}`);
  }
});

Deno.test("generateGiftCode: deterministic under an injected rand", () => {
  const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.05];
  const freshRand = () => {
    let i = 0;
    return () => seq[i++ % seq.length];
  };
  assertEquals(generateGiftCode(freshRand()), generateGiftCode(freshRand()));
});

Deno.test("isPlausibleGiftCode: accepts the real shape, rejects everything else", () => {
  assert(isPlausibleGiftCode("1234567890"));
  assert(isPlausibleGiftCode("9999999999"));
  assert(!isPlausibleGiftCode("0234567890")); // leading zero
  assert(!isPlausibleGiftCode("123456789")); // 9 digits
  assert(!isPlausibleGiftCode("12345678901")); // 11 digits
  assert(!isPlausibleGiftCode("123456789a")); // non-digit
  assert(!isPlausibleGiftCode(""));
  assert(!isPlausibleGiftCode("  1234567890  "));
});

Deno.test("hashGiftCode: deterministic, keyed, and never leaks the raw code in output shape", async () => {
  const a = await hashGiftCode("1234567890", "service-role-secret-a");
  const b = await hashGiftCode("1234567890", "service-role-secret-a");
  assertEquals(a, b, "same code + same key must hash identically");
  assertEquals(a.length, 64, "hex-encoded SHA-256 digest is 64 chars");
  assert(/^[0-9a-f]{64}$/.test(a));
});

Deno.test("hashGiftCode: different codes hash differently under the same key", async () => {
  const a = await hashGiftCode("1234567890", "service-role-secret-a");
  const b = await hashGiftCode("1234567891", "service-role-secret-a");
  assertNotEquals(a, b);
});

Deno.test("hashGiftCode: the key is load-bearing — a different service key changes the digest", async () => {
  const a = await hashGiftCode("1234567890", "service-role-secret-a");
  const b = await hashGiftCode("1234567890", "service-role-secret-b");
  assertNotEquals(
    a,
    b,
    "a plain unkeyed hash would not depend on the service key at all",
  );
});

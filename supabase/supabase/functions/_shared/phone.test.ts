import { assertEquals } from "jsr:@std/assert@1";
import { normalizePhoneE164, phoneDigits, phonesMatch } from "./phone.ts";

Deno.test("phoneDigits strips non-digits", () => {
  assertEquals(phoneDigits("+52 55 1234-5678"), "525512345678");
  assertEquals(phoneDigits("(55) 1234 5678"), "5512345678");
});

Deno.test("normalizePhoneE164 accepts MX-shaped numbers", () => {
  assertEquals(normalizePhoneE164("+525512345678"), "+525512345678");
  assertEquals(normalizePhoneE164("525512345678"), "+525512345678");
  assertEquals(normalizePhoneE164("not-a-phone"), null);
});

Deno.test("phonesMatch compares last 10 digits", () => {
  assertEquals(phonesMatch("+525512345678", "5512345678"), true);
  assertEquals(phonesMatch("+525512345678", "+525598765432"), false);
});

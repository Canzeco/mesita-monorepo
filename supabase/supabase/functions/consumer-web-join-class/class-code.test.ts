import { assertEquals } from "jsr:@std/assert@1";
import { parseClassCode } from "./class-code.ts";

// The one gate before a guest's class is written (MESITA-2984).
Deno.test("a code is exactly twelve digits, spaces and dashes dropped", () => {
  assertEquals(parseClassCode("123456789012"), "123456789012");
  assertEquals(parseClassCode("1234 5678 9012"), "123456789012");
  assertEquals(parseClassCode("1234-5678-9012"), "123456789012");
});

Deno.test("anything else is not a code", () => {
  for (
    const raw of [
      "",
      "12345678901",
      "1234567890123",
      "12345678901a",
      "１２３４５６７８９０１２",
      null,
      123456789012,
    ]
  ) {
    assertEquals(parseClassCode(raw), null, String(raw));
  }
});

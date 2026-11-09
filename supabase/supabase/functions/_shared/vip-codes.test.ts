import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { formatVipCode, hashVipCode, newVipCode, readSaveVipCodeBody } from "./vip-codes.ts";

// MESITA-3540: the EF stores sha256 of the twelve digits and the SQL redeem
// recomputes it with encode(sha256(convert_to(code, 'UTF8')), 'hex'). A
// mismatch would make every issued code invalid.
Deno.test("the hash is sha256 hex of the ASCII digits, as the SQL redeem computes it", async () => {
  assertEquals(
    await hashVipCode("000000000000"),
    "f7b11509f4d675c3c44f0dd37ca830bb02e8cfa58f04c46283c4bfcbdce1ff45",
  );
});

Deno.test("a new code is twelve digits; a skewed byte source cannot bias it out of range", () => {
  for (let i = 0; i < 50; i++) assertMatch(newVipCode(), /^\d{12}$/);
  // Bytes 250..255 are dropped, so an all-255 source with one usable byte per
  // fill still ends in twelve digits.
  let n = 0;
  const skewed = (b: Uint8Array) => {
    b.fill(255);
    b[0] = n++ % 250;
    return b;
  };
  assertMatch(newVipCode(skewed), /^\d{12}$/);
  assertEquals(formatVipCode("123456789012"), "1234 5678 9012");
});

Deno.test("a save body issues or revokes", () => {
  assertEquals(readSaveVipCodeBody({}), { ok: true, action: "issue", label: null, vipPartnerId: null });
  assertEquals(readSaveVipCodeBody({ label: "  Ana   R ", vipPartnerId: "" }), {
    ok: true,
    action: "issue",
    label: "Ana R",
    vipPartnerId: null,
  });
  assertEquals(readSaveVipCodeBody({ label: "x".repeat(81) }).ok, false);
  assertEquals(readSaveVipCodeBody({ vipPartnerId: "nope" }).ok, false);
  assertEquals(readSaveVipCodeBody({ revoke: true, id: "nope" }).ok, false);
  const id = "00000000-0000-4000-8000-000000003540";
  assertEquals(readSaveVipCodeBody({ revoke: true, id }), { ok: true, action: "revoke", id });
});

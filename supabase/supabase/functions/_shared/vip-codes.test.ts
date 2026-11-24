import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { formatVipCode, hashVipCode, newVipCode, readAllPages, readRedeemVipCodeBody, readSaveVipCodeBody, redeemAnswer, vipReason } from "./vip-codes.ts";

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

// MESITA-4766: Remove VIP, the redeem body and its answers.
Deno.test("a save body removes a code-made VIP by guest id", () => {
  const consumerId = "00000000-0000-4000-8000-000000004766";
  assertEquals(readSaveVipCodeBody({ removeVip: true, consumerId }), { ok: true, action: "removeVip", consumerId });
  assertEquals(readSaveVipCodeBody({ removeVip: true, consumerId: "nope" }).ok, false);
});

Deno.test("the redeem body is twelve digits as text, spaces and dashes ignored, leading zeros kept", () => {
  assertEquals(readRedeemVipCodeBody({ code: "0123 4567-8901" }), { ok: true, code: "012345678901" });
  assertEquals(readRedeemVipCodeBody({ code: "12345678901" }).ok, false);
  assertEquals(readRedeemVipCodeBody({ code: 123456789012 }).ok, false);
  assertEquals(readRedeemVipCodeBody({ code: "12345678901a" }).ok, false);
  assertEquals(readRedeemVipCodeBody(null).ok, false);
});

Deno.test("each redeem outcome has its status and code", () => {
  assertEquals(redeemAnswer({ outcome: "joined" }), { status: 200, body: { ok: true, outcome: "joined" } });
  assertEquals(redeemAnswer({ outcome: "already_vip" }), { status: 200, body: { ok: true, outcome: "already_vip" } });
  assertEquals(redeemAnswer({ outcome: "invalid" }).status, 422);
  assertEquals(redeemAnswer({ outcome: "invalid" }).body.code, "code_invalid");
  const limited = redeemAnswer({ outcome: "rate_limited", retry_after_seconds: 120.4 });
  assertEquals([limited.status, limited.body.code, limited.body.retryAfterSeconds], [429, "too_many_tries", 121]);
  assertEquals(redeemAnswer({ outcome: "rate_limited" }).body.retryAfterSeconds, 3600);
  assertEquals(redeemAnswer({ outcome: "consumer_not_found" }).status, 404);
  assertEquals(redeemAnswer(null).status, 500);
  assertEquals(redeemAnswer({ outcome: "something_new" }).body.code, "save_failed");
});

Deno.test("why a guest is VIP: a code first, else Instagram, else none", () => {
  assertEquals(vipReason({ vip_invited_at: "2026-11-23T00:00:00Z", guest_class: "vip" }), "code");
  assertEquals(vipReason({ vip_invited_at: null, guest_class: "vip" }), "instagram");
  assertEquals(vipReason({ guest_class: "regular" }), null);
  assertEquals(vipReason({}), null);
});

Deno.test("readAllPages: reads past one page, and a failed page is never a short list (MESITA-4912)", async () => {
  const all = [1, 2, 3, 4, 5];
  const read = (from: number, to: number) => Promise.resolve({ data: all.slice(from, to + 1), error: null });
  assertEquals(await readAllPages(read, 2), all);
  let failed = false;
  try {
    await readAllPages((from) => Promise.resolve(from === 0 ? { data: [1, 2], error: null } : { data: null, error: { message: "down" } }), 2);
  } catch {
    failed = true;
  }
  assertEquals(failed, true);
});

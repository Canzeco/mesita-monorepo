// MESITA-3292 — the send body refuses what would move the wrong money, the
// link's key is stored only as a prefixed hash, and every code the gift EFs
// answer is a money code the client knows.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { giftRefusalStatus, hashGiftToken, mintGiftToken, readSendBody } from "./gift.ts";
import { MONEY_CODES } from "./money-codes.ts";
import { MAX_PAYMENT_INPUT_CENTS } from "./money.ts";
import { moneyConfigFrom, sendingOn } from "./money-config.ts";

const PLACE = "00000000-0000-4000-8000-000000013292";
const REQ = "00000000-0000-4000-8000-00000000a001";

Deno.test("readSendBody takes a whole positive amount within the cap", () => {
  assert(readSendBody({ place_id: PLACE, request_id: REQ, amount_cents: 5000 }).ok);
  for (const amount_cents of [0, -1, 10.5, "5000", null]) {
    const r = readSendBody({ place_id: PLACE, request_id: REQ, amount_cents });
    assert(!r.ok && r.code === "amount_required", String(amount_cents));
  }
  const over = readSendBody({ place_id: PLACE, request_id: REQ, amount_cents: MAX_PAYMENT_INPUT_CENTS + 1 });
  assert(!over.ok && over.code === "above_cap");
  assert(!readSendBody({ place_id: "nope", request_id: REQ, amount_cents: 1 }).ok);
  assert(!readSendBody({ place_id: PLACE, amount_cents: 1 }).ok);
});

Deno.test("the link's key is stored as a prefixed sha256, never in clear", async () => {
  const token = mintGiftToken();
  const hash = await hashGiftToken(token);
  assert(/^[0-9a-f]{64}$/.test(hash));
  assertNotEquals(hash, token);
  assertEquals(hash, await hashGiftToken(token));
  assertNotEquals(hash, await hashGiftToken(mintGiftToken()));
});

Deno.test("every gift refusal is a money code with a client status", () => {
  for (const code of ["gone", "insufficient", "taken", "too_many_open", "own_gift", "claimed", "taken_back", "not_live"]) {
    assert((MONEY_CODES as readonly string[]).includes(code), code);
  }
  assertEquals(giftRefusalStatus("own_gift"), 409);
  assertEquals(giftRefusalStatus("gone"), 404);
});

Deno.test("sending is always on in test mode, and in live only once sending_live is set", () => {
  assert(sendingOn(moneyConfigFrom({}), false));
  assert(!sendingOn(moneyConfigFrom({}), true));
  assert(!sendingOn(moneyConfigFrom({ sending_live: "true" }), true));
  assert(sendingOn(moneyConfigFrom({ sending_live: true }), true));
});

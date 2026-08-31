import { assertEquals } from "jsr:@std/assert@1";
import { parseSelectTicketPaymentMethod } from "./select-ticket-payment-method.ts";

Deno.test("at_place is the live path", () => {
  assertEquals(parseSelectTicketPaymentMethod("at_place"), {
    ok: true,
    method: "at_place",
  });
});

Deno.test("null and omitted roll back / mean no pick", () => {
  assertEquals(parseSelectTicketPaymentMethod(null), {
    ok: true,
    method: null,
  });
  assertEquals(parseSelectTicketPaymentMethod(undefined), {
    ok: true,
    method: null,
  });
});

Deno.test("mesita is retired 410, not a 400 unknown method", () => {
  const got = parseSelectTicketPaymentMethod("mesita");
  assertEquals(got.ok, false);
  if (got.ok) return;
  assertEquals(got.status, 410);
  assertEquals(got.body.code, "retired");
});

Deno.test("any other string is 400", () => {
  const got = parseSelectTicketPaymentMethod("credits");
  assertEquals(got.ok, false);
  if (got.ok) return;
  assertEquals(got.status, 400);
});

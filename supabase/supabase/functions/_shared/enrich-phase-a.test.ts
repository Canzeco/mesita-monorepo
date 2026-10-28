import { assertEquals } from "jsr:@std/assert@1";
import { apifyActorError, apifyBillingDetail } from "./apify.ts";

Deno.test("Apify's invoice refusal is named, and any other error is not", () => {
  assertEquals(
    apifyBillingDetail("platform-feature-disabled: Too many outstanding invoices"),
    "Apify refused the call: too many outstanding invoices.",
  );
  assertEquals(apifyBillingDetail("actor timed out"), null);
  assertEquals(apifyBillingDetail(null), null);
  assertEquals(
    apifyActorError('{"error":{"message":"Too many outstanding invoices"}}'),
    "Apify refused the call: too many outstanding invoices.",
  );
  assertEquals(apifyActorError("client timeout after 20000ms"), "client timeout after 20000ms");
});

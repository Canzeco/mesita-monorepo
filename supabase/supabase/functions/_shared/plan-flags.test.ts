// MESITA-4393: the flags that stop the reserve form from blocking or
// upselling a guest the server treats differently (money path).
import { assertEquals } from "jsr:@std/assert@1";
import { planFlags } from "./plan-flags.ts";

Deno.test("cap_lifted follows the unlimitedReservations switch exactly", () => {
  assertEquals(planFlags({}, { unlimitedReservations: true })?.cap_lifted, true);
  assertEquals(planFlags({}, { unlimitedReservations: false })?.cap_lifted, false);
  assertEquals(planFlags({}, {})?.cap_lifted, false);
  assertEquals(planFlags({}, null)?.cap_lifted, false);
  assertEquals(planFlags({}, { unlimitedReservations: "true" })?.cap_lifted, false);
});

Deno.test("cap_override is true only for an override the server enforces", () => {
  assertEquals(planFlags({ reservation_cap_override: null }, {})?.cap_override, false);
  assertEquals(planFlags({ reservation_cap_override: 3 }, {})?.cap_override, true);
  assertEquals(planFlags({ reservation_cap_override: 0 }, {})?.cap_override, true);
  assertEquals(planFlags({ reservation_cap_override: -1 }, {})?.cap_override, false);
  assertEquals(planFlags({ reservation_cap_override: 2.5 }, {})?.cap_override, false);
  assertEquals(planFlags({ reservation_cap_override: "5" }, {})?.cap_override, false);
});

Deno.test("test_call is on for a test number or the guest's phone, off in production", () => {
  assertEquals(planFlags({}, { testCall: { enabled: true, target: "number" } })?.test_call, true);
  assertEquals(planFlags({}, { testCall: { enabled: true, target: "guest" } })?.test_call, true);
  assertEquals(planFlags({}, { testCall: { enabled: false, target: "number" } })?.test_call, false);
  assertEquals(planFlags({}, { testCall: { enabled: "true" } })?.test_call, false);
  assertEquals(planFlags({}, {})?.test_call, false);
  assertEquals(planFlags({}, null)?.test_call, false);
});

Deno.test("a failed settings read yields no flags (the form fails open)", () => {
  assertEquals(planFlags({ reservation_cap_override: 3 }, null, true), null);
});

Deno.test("plan-flags and create-reservation read the same switch key", async () => {
  const here = new URL(".", import.meta.url);
  const flags = await Deno.readTextFile(new URL("plan-flags.ts", here));
  const create = await Deno.readTextFile(new URL("../consumer-web-create-reservation/index.ts", here));
  for (const src of [flags, create]) {
    assertEquals(src.includes("reservations_config"), true);
    assertEquals(src.includes("unlimitedReservations"), true);
  }
});

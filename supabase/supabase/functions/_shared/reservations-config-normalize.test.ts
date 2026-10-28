// Unit tests — the Reservations Config strict save gate (MESITA-805).
//
// The second of the two STRICT whole-blob config gates (the other is
// the since-deleted admin-web-update-lineup-config). Strict + whole-blob means any key the gate
// REQUIRES and the admin page stops sending 400s the entire page — the failure
// mode MESITA-804 hit on /lineup-config (MESITA-804). These tests pin the contract so the same
// drift is caught here by CI instead of by an operator clicking Save.
//
// The retired keys (MESITA-2144): `priority`, `disabled`, `attempts` and
// `testCall.consumerNumber`; `respectAdminOverride` since MESITA-2424. A
// deployed console may still post them with every save, so the gate must keep
// ACCEPTING them, malformed or not, and must never write them back.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { normalizeConfig } from "./reservations-config-normalize.ts";

const RETIRED = ["priority", "disabled", "attempts", "respectAdminOverride"] as const;

// The blob the deployed admin console posts, retired keys included.
function consoleBlob() {
  return {
    priority: ["phone"],
    disabled: [] as string[],
    respectAdminOverride: true,
    testCall: { enabled: false, number: "", consumerNumber: "" },
    attempts: 2,
    unlimitedReservations: false,
  };
}

Deno.test("normalizeConfig: the blob the admin console posts is accepted", () => {
  const r = normalizeConfig(consoleBlob());
  assert(r.ok, `console blob rejected: ${r.ok ? "" : r.error}`);
});

Deno.test("normalizeConfig: the retired keys are accepted and never written back", () => {
  const r = normalizeConfig(consoleBlob());
  assert(r.ok);
  for (const key of RETIRED) {
    assertEquals(key in r.value, false, `${key} was written back`);
  }
  assertEquals("consumerNumber" in r.value.testCall, false, "consumerNumber was written back");
});

Deno.test("normalizeConfig: output round-trips — its own clean value is accepted again", () => {
  const first = normalizeConfig(consoleBlob());
  assert(first.ok);
  const second = normalizeConfig(first.value);
  assert(second.ok, `gate rejected its own output: ${second.ok ? "" : second.error}`);
  assertEquals(second.value, first.value);
});

Deno.test("normalizeConfig: a malformed retired respectAdminOverride still saves", () => {
  const wrongType = { ...consoleBlob(), respectAdminOverride: "yes" };
  assert(normalizeConfig(wrongType).ok);
});

Deno.test("normalizeConfig: optional keys may be omitted (older and newer admin builds)", () => {
  // The retired keys are optional so the console can stop sending them; the
  // rest are optional ON PURPOSE so a shipped-but-stale admin build keeps
  // saving. Guard both promises.
  for (
    const key of [...RETIRED, "testCall", "unlimitedReservations", "reminder"] as const
  ) {
    const blob = consoleBlob() as Record<string, unknown>;
    delete blob[key];
    const r = normalizeConfig(blob);
    assert(r.ok, `omitting optional ${key} was rejected: ${r.ok ? "" : r.error}`);
  }
});

Deno.test("normalizeConfig: retired keys are ignored even when malformed", () => {
  // Nothing reads them, so a value the old gate refused (an unknown channel, a
  // fully parked list, a junk guest line) no longer 400s the save.
  const r = normalizeConfig({
    ...consoleBlob(),
    priority: ["carrier-pigeon"],
    disabled: ["phone"],
    attempts: 99,
    testCall: { enabled: false, number: "", consumerNumber: 42 },
  });
  assert(r.ok, `a retired key was still validated: ${r.ok ? "" : r.error}`);
  assertEquals(r.value.testCall, { enabled: false, number: "" });
});

Deno.test("normalizeConfig: an enabled test-call override needs a real number", () => {
  const blob = consoleBlob();
  blob.testCall = { enabled: true, number: "", consumerNumber: "" };
  assert(!normalizeConfig(blob).ok);

  blob.testCall = { enabled: true, number: "+5215512345678", consumerNumber: "" };
  assert(normalizeConfig(blob).ok);
});

Deno.test("normalizeConfig: reminder defaults OFF when omitted, and refuses a bad shape", () => {
  const omitted = normalizeConfig(consoleBlob());
  assert(omitted.ok);
  assertEquals(omitted.value.reminder, { enabled: false });

  const on = consoleBlob() as Record<string, unknown>;
  on.reminder = { enabled: true };
  const r = normalizeConfig(on);
  assert(r.ok);
  assertEquals(r.value.reminder, { enabled: true });

  const bad = consoleBlob() as Record<string, unknown>;
  bad.reminder = true;
  assert(!normalizeConfig(bad).ok);
});

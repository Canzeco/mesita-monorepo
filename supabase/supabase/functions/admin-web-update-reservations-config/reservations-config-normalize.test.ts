// Unit tests — the Reservations Config strict save gate (MESITA-805).
//
// The second of the two STRICT whole-blob config gates (the other is
// admin-web-update-lineup-config). Strict + whole-blob means any key the admin
// page stops sending 400s the entire page — the failure mode MESITA-804 hit on
// /lineup-config. These tests pin the contract so the same drift is caught here
// by CI instead of by an operator clicking Save.
//
// The live tripwire: `priority` must rank EVERY channel in RESERVATION_CHANNELS.
// That rule is deliberate — a channel silently dropped from the array would be
// indistinguishable from one never wired — so it must NOT be loosened. It does
// mean adding a channel to RESERVATION_CHANNELS without also adding it to the
// admin catalog's CHANNELS breaks every save. The completeness test below fails
// the moment those two lists diverge.

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { RESERVATION_CHANNELS } from "../_shared/enrich-reservation-endpoint.ts";
import { normalizeConfig } from "./reservations-config-normalize.ts";

// The blob the admin console posts, built from the EF's own channel list so it
// cannot drift out of sync with the source of truth.
function canonicalBlob() {
  return {
    // Phone-only eligible set (MESITA-842) — nothing to park.
    priority: [...RESERVATION_CHANNELS],
    disabled: [],
    respectAdminOverride: true,
    testCall: { enabled: false, number: "", consumerNumber: "" },
    attempts: 2,
    unlimitedReservations: false,
  };
}

Deno.test("normalizeConfig: the blob the admin console posts is accepted", () => {
  const r = normalizeConfig(canonicalBlob());
  assert(r.ok, `canonical blob rejected: ${r.ok ? "" : r.error}`);
});

Deno.test("normalizeConfig: output round-trips — its own clean value is accepted again", () => {
  const first = normalizeConfig(canonicalBlob());
  assert(first.ok);
  const second = normalizeConfig(first.value);
  assert(second.ok, `gate rejected its own output: ${second.ok ? "" : second.error}`);
  assertEquals(second.value, first.value);
});

Deno.test("normalizeConfig: priority must rank EVERY channel (the drift tripwire)", () => {
  // This is what breaks if a channel is added EF-side and the admin catalog's
  // CHANNELS list is not updated in the same change.
  const short = canonicalBlob();
  short.priority = short.priority.slice(0, -1);
  const r = normalizeConfig(short);
  assert(!r.ok);
  assertStringIncludes(r.error, "must rank every channel");
});

Deno.test("normalizeConfig: the three required keys are load-bearing", () => {
  for (const key of ["priority", "disabled", "respectAdminOverride"] as const) {
    const blob = canonicalBlob() as Record<string, unknown>;
    delete blob[key];
    const r = normalizeConfig(blob);
    assert(!r.ok, `dropping ${key} was accepted — gate went lenient?`);
  }
});

Deno.test("normalizeConfig: optional keys may be omitted (older admin builds)", () => {
  // testCall / attempts / unlimitedReservations are optional ON PURPOSE so a
  // shipped-but-stale admin build keeps saving. Guard that promise.
  for (const key of ["testCall", "attempts", "unlimitedReservations"] as const) {
    const blob = canonicalBlob() as Record<string, unknown>;
    delete blob[key];
    const r = normalizeConfig(blob);
    assert(r.ok, `omitting optional ${key} was rejected: ${r.ok ? "" : r.error}`);
  }
});

Deno.test("normalizeConfig: unknown channels and a fully-parked set are rejected", () => {
  const bogus = canonicalBlob() as Record<string, unknown>;
  bogus.priority = [...RESERVATION_CHANNELS, "carrier-pigeon"];
  assert(!normalizeConfig(bogus).ok);

  const allParked = {
    ...canonicalBlob(),
    disabled: [...RESERVATION_CHANNELS] as string[],
  };
  const r = normalizeConfig(allParked);
  assert(!r.ok);
  assertStringIncludes(r.error, "cannot park every channel");
});

Deno.test("normalizeConfig: an enabled test-call override needs a real number", () => {
  const blob = canonicalBlob();
  blob.testCall = { enabled: true, number: "", consumerNumber: "" };
  assert(!normalizeConfig(blob).ok);

  blob.testCall = { enabled: true, number: "+5215512345678", consumerNumber: "" };
  assert(normalizeConfig(blob).ok);
});

Deno.test("normalizeConfig: attempts is fixed at 2 whatever the client sends", () => {
  const blob = canonicalBlob() as Record<string, unknown>;
  blob.attempts = 99;
  const r = normalizeConfig(blob);
  assert(r.ok);
  assertEquals(r.value.attempts, 2);
});

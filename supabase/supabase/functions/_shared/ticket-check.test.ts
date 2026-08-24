// Unit tests — Tickets v2 self-check-in core (MESITA-806). Pure, no DB.
// The two things that must never regress:
//   1. The public payload allowlist (shapeCheckPayload) — the ONLY shape the
//      unauthenticated check page ever sees. No class, no rungs, no consumer
//      code, no UUIDs; verification channel collapses to "approved".
//   2. The possession token: 22-char base64url, plausibility gate.

import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  type CheckSettings,
  type CheckTicketRow,
  checkUrlFor,
  isPlausibleCheckCode,
  loadCheckSettings,
  newCheckCode,
  requireCheckPin,
  shapeCheckPayload,
} from "./ticket-check.ts";

function row(overrides: Partial<CheckTicketRow> = {}): CheckTicketRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    project_id: "22222222-2222-2222-2222-222222222222",
    consumer_id: "33333333-3333-3333-3333-333333333333",
    status: "open",
    check_code: "abcdefghijklmnopqrstuv",
    first_scanned_at: null,
    story_status: "not_required",
    story_screenshot_url: null,
    review_status: "not_required",
    review_screenshot_url: null,
    bill_subtotal_cents: null,
    tip_cents: null,
    tip_pct: null,
    total_cents: null,
    updated_at: "2026-08-02T00:00:00Z",
    approved_at: null,
    fix_requested: null,
    fix_note: null,
    paid_method: null,
    validated_at: null,
    discount_percent: null,
    discount_cents: null,
    bill_source: null,
    currency: "MXN",
    created_at: "2026-08-02T00:00:00Z",
    revealed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function shape(
  overrides: Partial<CheckTicketRow> = {},
  pinRequired = false,
) {
  return shapeCheckPayload({
    ticket: row(overrides),
    placeName: "Café Prueba",
    placeSlug: "cafe-prueba",
    guestDisplayName: "Ana López",
    guestInstagramHandle: "analopez",
    capMxn: 500,
    pinRequired,
  });
}

Deno.test("newCheckCode: 22-char base64url, unique across draws", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const code = newCheckCode();
    assertMatch(code, /^[A-Za-z0-9_-]{22}$/);
    assert(isPlausibleCheckCode(code));
    seen.add(code);
  }
  assertEquals(seen.size, 200);
  assertEquals(checkUrlFor("abc"), "https://check.mesita.ai/abc");
});

Deno.test("isPlausibleCheckCode: rejects consumer codes, UUIDs, junk", () => {
  assertEquals(isPlausibleCheckCode("0042-1337"), false); // consumers.code
  assertEquals(isPlausibleCheckCode("00421337"), false);
  assertEquals(isPlausibleCheckCode(""), false);
  assertEquals(isPlausibleCheckCode("a".repeat(40)), false);
  assertEquals(isPlausibleCheckCode("has spaces here padded"), false);
});

Deno.test("shapeCheckPayload: the allowlist — forbidden fields never leak", () => {
  const payload = shape({
    status: "awaiting_payment_confirm",
    total_cents: 50_000, // PRE-discount (subtotal + tip)
    bill_subtotal_cents: 50_000,
    discount_percent: 20,
    discount_cents: 10_000,
  });
  const flat = JSON.stringify(payload);
  // The privacy invariant, spelled out: nothing class- or rung-shaped, no
  // identifiers beyond the guest's display name.
  for (
    const forbidden of [
      "class_key",
      "class",
      "segment",
      "strategy",
      "standard",
      "premium",
      "influencer",
      "aura",
      "consumer_id",
      "project_id",
      "11111111", // ticket uuid
      "33333333", // consumer uuid
    ]
  ) {
    assertEquals(
      flat.includes(forbidden),
      false,
      `public payload leaked "${forbidden}"`,
    );
  }
  // What IS there: the blended final percent and the amounts. NB
  // total_cents is the PRE-discount bill (the live-E2E bug): a MX$500 bill
  // with MX$100 off is MX$400 due.
  assertEquals((payload.bill as Record<string, unknown>).discount_percent, 20);
  assertEquals(
    (payload.bill as Record<string, unknown>).amount_due_cents,
    40_000,
  );
});

Deno.test("shapeCheckPayload: pin_required is a flag — the PIN value never ships", () => {
  // MESITA-823. The shaper is only ever handed the BOOLEAN; the digits live
  // on projects.check_pin and are compared server-side in requireCheckPin.
  // This asserts the contract at the one place a leak could happen.
  assertEquals(shape().pin_required, false);
  assertEquals(shape({}, true).pin_required, true);
  const flat = JSON.stringify(shape({}, true));
  for (const forbidden of ["check_pin", 'pin":"', "123456"]) {
    assertEquals(
      flat.includes(forbidden),
      false,
      `public payload leaked "${forbidden}"`,
    );
  }
});

Deno.test("shapeCheckPayload: bill_required defaults on (MESITA-1095)", () => {
  // Same contract as pin_required: the shaper is handed a BOOLEAN. The
  // bill is always required, so omitted → true.
  assertEquals(shape().bill_required, true);
  const required = shapeCheckPayload({
    ticket: row(),
    placeName: "Café Prueba",
    placeSlug: "cafe-prueba",
    guestDisplayName: "Ana López",
    guestInstagramHandle: "analopez",
    capMxn: 500,
    pinRequired: false,
    billRequired: true,
  });
  assertEquals(required.bill_required, true);
  assertEquals(JSON.stringify(required).includes("check_require_bill"), false);
});

Deno.test("shapeCheckPayload: amount due = subtotal minus discount (E2E regression)", () => {
  const payload = shape({
    status: "awaiting_payment_confirm",
    bill_subtotal_cents: 80_000,
    total_cents: 80_000,
    discount_percent: 20,
    discount_cents: 10_000,
  });
  assertEquals(
    (payload.bill as Record<string, unknown>).amount_due_cents,
    70_000,
  );
});

Deno.test("shapeCheckPayload: the tip rides through amount due untouched (C4-6)", () => {
  // The F3 canonical bill: MX$850 + MX$128 tip − MX$100 off = MX$878 due.
  // Before MESITA-1087 three hand-rolled amount-due formulas disagreed by
  // exactly the tip the moment tip_cents went nonzero; this pins the shared
  // formula at the staff payload, the surface where the waiter reads it.
  const payload = shape({
    status: "awaiting_payment_confirm",
    bill_subtotal_cents: 85_000,
    tip_cents: 12_800,
    tip_pct: 15,
    total_cents: 97_800,
    discount_percent: 20,
    discount_cents: 10_000,
  });
  assertEquals(
    (payload.bill as Record<string, unknown>).amount_due_cents,
    87_800,
  );
});

Deno.test("shapeCheckPayload: bill is null before billing", () => {
  const payload = shape();
  assertEquals(payload.bill, null);
});

Deno.test("shapeCheckPayload: verification channel collapses to approved", () => {
  for (
    const status of [
      "self_verified",
      "ai_verified",
      "staff_verified",
      "waiter_verified",
    ]
  ) {
    const payload = shape({ story_status: status });
    assertEquals(
      (payload.story as Record<string, unknown>).state,
      "approved",
      `story_status=${status} must read as plain "approved"`,
    );
  }
});

Deno.test("shapeCheckPayload: screenshot only visible while decidable", () => {
  const submitted = shape({
    story_status: "submitted",
    story_screenshot_url: "https://example.com/s.png",
  });
  assertEquals(
    (submitted.story as Record<string, unknown>).screenshot_url,
    "https://example.com/s.png",
  );
  const approved = shape({
    story_status: "staff_verified",
    story_screenshot_url: "https://example.com/s.png",
  });
  assertEquals(
    (approved.story as Record<string, unknown>).screenshot_url,
    null,
  );
});

Deno.test("shapeCheckPayload: story/review required flags follow status", () => {
  const none = shape();
  assertEquals((none.story as Record<string, unknown>).required, false);
  const pending = shape({ story_status: "pending" });
  assertEquals((pending.story as Record<string, unknown>).required, true);
  assertEquals((pending.story as Record<string, unknown>).state, "pending");
});

Deno.test("shapeCheckPayload: offer states the commitment only while unbilled (MESITA-850)", () => {
  // Unbilled + a live rate → the cap-as-instruction block.
  const open = shapeCheckPayload({
    ticket: row(),
    placeName: "Café Prueba",
    placeSlug: "cafe-prueba",
    guestDisplayName: "Ana López",
    guestInstagramHandle: null,
    capMxn: 500,
    pinRequired: false,
    offerRatePercent: 30,
  });
  assertEquals(open.offer, { discount_percent: 30, reward_cap_mxn: 500 });

  // A billed ticket never carries an offer — the bill block is the truth.
  const billed = shapeCheckPayload({
    ticket: row({ bill_subtotal_cents: 70000, total_cents: 70000 }),
    placeName: "Café Prueba",
    placeSlug: "cafe-prueba",
    guestDisplayName: "Ana López",
    guestInstagramHandle: null,
    capMxn: 500,
    pinRequired: false,
    offerRatePercent: 30,
  });
  assertEquals(billed.offer, null);

  // No rate resolved → no block (the page just shows the ticket).
  assertEquals(shape().offer, null);
});


// ── The staff PIN gate (MESITA-1120) ───────────────────────────────────
//
// The gate is the ONLY protection on six verify_jwt=false write EFs —
// service-role bypasses RLS and `projects` carries no anon policy. Before
// this suite it had zero coverage, which is why a dropped PostgREST error
// held it open in production.

/** Minimal PostgREST double: one `.from().select().eq().maybeSingle()` chain. */
function fakeAdmin(result: { data: unknown; error: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve(result),
    // logCheckEvent inserts; the gate must not depend on it succeeding.
    insert: () => Promise.resolve({ data: null, error: null }),
    // isRateLimited-style reads, unused by these cases.
    gte: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: [], error: null }),
  };
  // deno-lint-ignore no-explicit-any
  return { from: () => chain } as any;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function gate(settings: CheckSettings | undefined, pin: unknown, admin = fakeAdmin({ data: null, error: null })) {
  return requireCheckPin({
    admin,
    projectId: "22222222-2222-2222-2222-222222222222",
    ticketId: "11111111-1111-1111-1111-111111111111",
    pin,
    ipHash: null,
    userAgent: null,
    json,
    settings,
  });
}

Deno.test("loadCheckSettings: an errored read reports loadFailed, never a clean null", async () => {
  const errored = await loadCheckSettings(
    fakeAdmin({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout", details: null } }),
    "22222222-2222-2222-2222-222222222222",
  );
  assertEquals(errored.loadFailed, true);
  assertEquals(errored.pin, null);

  // The shape a genuinely unconfigured place produces — same pin, different
  // meaning. If these two ever collapse again, the gate reopens.
  const unconfigured = await loadCheckSettings(
    fakeAdmin({ data: { check_pin: null }, error: null }),
    "22222222-2222-2222-2222-222222222222",
  );
  assertEquals(unconfigured.loadFailed, false);
  assertEquals(unconfigured.pin, null);
});

Deno.test("requireCheckPin: DENIES 503 when the settings read failed (MESITA-1120)", async () => {
  const res = await gate({ pin: null, requireBill: true, loadFailed: true }, "123456");
  assert(!res.ok, "an unknown PIN state must never pass the gate");
  assertEquals(res.response.status, 503);
  assertEquals((await res.response.json()).code, "pin_unavailable");
});

Deno.test("requireCheckPin: DENIES on a failed read even with no PIN supplied", async () => {
  const res = await gate({ pin: null, requireBill: true, loadFailed: true }, undefined);
  assert(!res.ok);
  assertEquals(res.response.status, 503);
});

Deno.test("requireCheckPin: DENIES when it loads the settings itself and that read errors", async () => {
  // The `settings` arg is optional — callers that skip it used to reach the
  // fail-open path. Now the gate loads the settings itself and must deny too.
  const res = await gate(
    undefined,
    "123456",
    fakeAdmin({ data: null, error: { code: "08006", message: "connection failure", details: null } }),
  );
  assert(!res.ok);
  assertEquals(res.response.status, 503);
});

Deno.test("requireCheckPin: an unconfigured PIN still passes — the gate stays opt-in", async () => {
  const res = await gate({ pin: null, requireBill: true, loadFailed: false }, undefined);
  assert(res.ok);
});

Deno.test("requireCheckPin: correct PIN passes, wrong PIN 401s, absent PIN asks", async () => {
  const settings: CheckSettings = { pin: "123456", requireBill: true, loadFailed: false };

  assert((await gate(settings, "123456")).ok);
  assert((await gate(settings, " 123456 ")).ok, "surrounding whitespace is trimmed");

  const wrong = await gate(settings, "000000");
  assert(!wrong.ok);
  assertEquals(wrong.response.status, 401);
  assertEquals((await wrong.response.json()).code, "pin_invalid");

  const absent = await gate(settings, undefined);
  assert(!absent.ok);
  assertEquals(absent.response.status, 401);
  assertEquals((await absent.response.json()).code, "pin_required");
});

Deno.test("the 503 body never leaks the PIN or its existence", async () => {
  const res = await gate({ pin: "123456", requireBill: true, loadFailed: true }, "000000");
  assert(!res.ok);
  const body = await res.response.text();
  for (const forbidden of ["123456", "check_pin"]) {
    assert(!body.includes(forbidden), `503 body leaked ${forbidden}`);
  }
});

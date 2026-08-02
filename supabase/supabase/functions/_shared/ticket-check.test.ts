// Unit tests — Tickets v2 self-check-in core (MESITA-806). Pure, no DB.
// The two things that must never regress:
//   1. The public payload allowlist (shapeCheckPayload) — the ONLY shape the
//      unauthenticated check page ever sees. No class, no rungs, no consumer
//      code, no UUIDs; verification channel collapses to "approved".
//   2. The possession token: 22-char base64url, plausibility gate.

import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  type CheckTicketRow,
  checkUrlFor,
  isPlausibleCheckCode,
  newCheckCode,
  shapeCheckPayload,
} from "./ticket-check.ts";

function row(overrides: Partial<CheckTicketRow> = {}): CheckTicketRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    project_id: "22222222-2222-2222-2222-222222222222",
    consumer_id: "33333333-3333-3333-3333-333333333333",
    kind: "coupon",
    status: "open",
    check_code: "abcdefghijklmnopqrstuv",
    first_scanned_at: null,
    story_status: "not_required",
    story_screenshot_url: null,
    review_status: "not_required",
    review_screenshot_url: null,
    check_subtotal_cents: null,
    tip_cents: null,
    total_cents: null,
    discount_percent: null,
    discount_cents: null,
    currency: "MXN",
    created_at: "2026-08-02T00:00:00Z",
    revealed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function shape(overrides: Partial<CheckTicketRow> = {}) {
  return shapeCheckPayload({
    ticket: row(overrides),
    placeName: "Café Prueba",
    placeSlug: "cafe-prueba",
    guestDisplayName: "Ana López",
    guestInstagramHandle: "analopez",
    capMxn: 500,
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
  assertEquals(checkUrlFor("abc"), "https://mesita.ai/check/abc");
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
    check_subtotal_cents: 50_000,
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
  assertEquals((payload.bill as Record<string, unknown>).amount_due_cents, 40_000);
});

Deno.test("shapeCheckPayload: amount due = total minus discount (E2E regression)", () => {
  const payload = shape({
    status: "awaiting_payment_confirm",
    check_subtotal_cents: 80_000,
    total_cents: 80_000,
    discount_percent: 20,
    discount_cents: 10_000,
  });
  assertEquals((payload.bill as Record<string, unknown>).amount_due_cents, 70_000);
});

Deno.test("shapeCheckPayload: bill is null before billing", () => {
  const payload = shape();
  assertEquals(payload.bill, null);
});

Deno.test("shapeCheckPayload: verification channel collapses to approved", () => {
  for (const status of ["ai_verified", "staff_verified", "waiter_verified"]) {
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
  assertEquals((approved.story as Record<string, unknown>).screenshot_url, null);
});

Deno.test("shapeCheckPayload: story/review required flags follow status", () => {
  const none = shape();
  assertEquals((none.story as Record<string, unknown>).required, false);
  const pending = shape({ story_status: "pending" });
  assertEquals((pending.story as Record<string, unknown>).required, true);
  assertEquals((pending.story as Record<string, unknown>).state, "pending");
});

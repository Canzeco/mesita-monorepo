// The status-vocabulary partition (MESITA-1085). Pure, no network/DB.
//   deno test supabase/functions/_shared/ticket-status.test.ts
//
// The contract: every enum label lives in exactly one lifecycle bucket
// (live · terminal · legacy), and every derived set stays inside the bucket
// its semantics promise. A label added to the enum without a home here fails
// the partition — which is the point: that failure used to be a ticket
// silently vanishing from the guest's app instead.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  ALL_TICKET_STATUSES,
  BUSINESS_CANCELLABLE_STATUSES,
  CHECK_DEDUPE_STATUSES,
  CLOSED_TICKET_STATUS,
  GUEST_CANCELLABLE_STATUSES,
  LEGACY_STATUSES,
  LIVE_STATUSES,
  TASKABLE_STATUSES,
  TERMINAL_STATUSES,
  TICKET_STATUS,
} from "./ticket-status.ts";

Deno.test("every enum label is classified exactly once (live | terminal | legacy)", () => {
  const buckets = [LIVE_STATUSES, TERMINAL_STATUSES, LEGACY_STATUSES];
  for (const label of ALL_TICKET_STATUSES) {
    const homes = buckets.filter((b) => b.includes(label)).length;
    assertEquals(homes, 1, `${label} is in ${homes} buckets, expected 1`);
  }
  const union = new Set(buckets.flat());
  assertEquals(union.size, ALL_TICKET_STATUSES.length);
});

Deno.test("TICKET_STATUS map and ALL_TICKET_STATUSES agree", () => {
  assertEquals(
    new Set(Object.values(TICKET_STATUS)),
    new Set(ALL_TICKET_STATUSES),
  );
});

Deno.test("taskable tickets are live tickets", () => {
  for (const s of TASKABLE_STATUSES) {
    assert(LIVE_STATUSES.includes(s), `${s} taskable but not live`);
  }
});

Deno.test("cancel windows nest: guest ⊆ business ⊆ live", () => {
  for (const s of GUEST_CANCELLABLE_STATUSES) {
    assert(
      BUSINESS_CANCELLABLE_STATUSES.includes(s),
      `${s} guest-cancellable but not business-cancellable`,
    );
  }
  for (const s of BUSINESS_CANCELLABLE_STATUSES) {
    assert(LIVE_STATUSES.includes(s), `${s} cancellable but not live`);
  }
});

Deno.test("the QR-farming dedupe set is live-only", () => {
  for (const s of CHECK_DEDUPE_STATUSES) {
    assert(LIVE_STATUSES.includes(s), `${s} in dedupe set but not live`);
  }
});

Deno.test("the closed status is terminal, and cancelled is not closed", () => {
  assert(TERMINAL_STATUSES.includes(CLOSED_TICKET_STATUS));
  assert(CLOSED_TICKET_STATUS !== TICKET_STATUS.cancelled);
});

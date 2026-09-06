// The state-vocabulary partition (MESITA-1085). Pure, no network/DB.
//   deno test supabase/functions/_shared/ticket-state.test.ts
//
// The contract: every enum label lives in exactly one lifecycle bucket
// (live · terminal · legacy), and every derived set stays inside the bucket
// its semantics promise. A label added to the enum without a home here fails
// the partition — which is the point: that failure used to be a ticket
// silently vanishing from the guest's app instead.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  ALL_TICKET_STATES,
  BUSINESS_CANCELLABLE_STATES,
  CHECK_DEDUPE_STATES,
  CLOSED_TICKET_STATE,
  GUEST_CANCELLABLE_STATES,
  LEGACY_STATES,
  LIVE_STATES,
  TASKABLE_STATES,
  TERMINAL_STATES,
  TICKET_STATE,
} from "./ticket-state.ts";

Deno.test("every enum label is classified exactly once (live | terminal | legacy)", () => {
  const buckets = [LIVE_STATES, TERMINAL_STATES, LEGACY_STATES];
  for (const label of ALL_TICKET_STATES) {
    const homes = buckets.filter((b) => b.includes(label)).length;
    assertEquals(homes, 1, `${label} is in ${homes} buckets, expected 1`);
  }
  const union = new Set(buckets.flat());
  assertEquals(union.size, ALL_TICKET_STATES.length);
});

Deno.test("TICKET_STATE map and ALL_TICKET_STATES agree", () => {
  assertEquals(
    new Set(Object.values(TICKET_STATE)),
    new Set(ALL_TICKET_STATES),
  );
});

Deno.test("taskable tickets are live tickets", () => {
  for (const s of TASKABLE_STATES) {
    assert(LIVE_STATES.includes(s), `${s} taskable but not live`);
  }
});

Deno.test("cancel windows nest: guest ⊆ business ⊆ live", () => {
  for (const s of GUEST_CANCELLABLE_STATES) {
    assert(
      BUSINESS_CANCELLABLE_STATES.includes(s),
      `${s} guest-cancellable but not business-cancellable`,
    );
  }
  for (const s of BUSINESS_CANCELLABLE_STATES) {
    assert(LIVE_STATES.includes(s), `${s} cancellable but not live`);
  }
});

Deno.test("the QR-farming dedupe set is live-only", () => {
  for (const s of CHECK_DEDUPE_STATES) {
    assert(LIVE_STATES.includes(s), `${s} in dedupe set but not live`);
  }
});

Deno.test("the closed state is terminal, and cancelled is not closed", () => {
  assert(TERMINAL_STATES.includes(CLOSED_TICKET_STATE));
  assert(CLOSED_TICKET_STATE !== TICKET_STATE.cancelled);
});

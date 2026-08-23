import { assertEquals } from "jsr:@std/assert@1";
import {
  activeFieldPins,
  autoApplies,
  carryFieldPins,
  CORRECTABLE_FIELD_COLUMNS,
  CORRECTION_AUTO_APPLY_FLOOR,
  CORRECTION_PIN_DAYS,
  FIELD_PINS_KEY,
  type FieldPins,
  readFieldPins,
  stripPinnedColumns,
} from "./enrich-corrections.ts";

// THE SHIP GATE for corrections (MESITA-1190).
//
// The whole feature is one claim: a fact an agent learned by CALLING the venue
// outranks a fact the Enricher can refetch. Two things can break that claim
// quietly, and both are tested here.
//
//   1. The persist steps overwrite a pinned column anyway. Then a correction
//      lasts until the next scheduled run and every call is wrong again.
//   2. `places.enrichment_sources` is rebuilt wholesale by S8 — it is that
//      stage's per-run diagnostics bag — and the pins live INSIDE it. A write
//      that forgets to carry them forward deletes every correction on the row.
//
// (2) is the non-obvious one: the pin is destroyed by exactly the run it exists
// to survive. `carryFieldPins` is the carry; these tests are what goes red if
// someone "tidies" it back into a plain assignment.

const FUTURE = new Date("2099-01-01T00:00:00.000Z").toISOString();
const PAST = new Date("2020-01-01T00:00:00.000Z").toISOString();

function pinned(field: string, until: string) {
  return {
    [FIELD_PINS_KEY]: {
      [field]: { source: "reservationist", confidence: 0.9, pinnedUntil: until },
    },
  };
}

Deno.test("pins survive a rebuilt enrichment_sources blob", () => {
  // Exactly what S8 does: build a fresh diagnostics object from this run's
  // material, then assign it over the column. The pins must ride along.
  const live = pinned("hours", FUTURE);
  const pins = activeFieldPins(readFieldPins(live));
  const freshRunDiagnostics = { synthesis: { ok: true }, cost: { spentUsd: 1 } };

  const written = carryFieldPins(freshRunDiagnostics, pins);

  assertEquals(Object.keys(readFieldPins(written)), ["hours"]);
  // …and the run's own diagnostics are not disturbed by the carry.
  assertEquals(written.synthesis, { ok: true });
});

Deno.test("a place with no pins gets no pins key — the blob stays clean", () => {
  const written = carryFieldPins({ synthesis: { ok: true } }, {});
  assertEquals(FIELD_PINS_KEY in written, false);
});

Deno.test("an active pin is stripped from the persist payload", () => {
  const pins = activeFieldPins(readFieldPins(pinned("hours", FUTURE)));
  const { update, skipped } = stripPinnedColumns(
    { hours: { mon: "09:00-17:00" }, address: "Calle 1", description: "x" },
    pins,
  );
  assertEquals(skipped, ["hours"]);
  assertEquals("hours" in update, false);
  // Everything the pin does not own is still written.
  assertEquals(update.address, "Calle 1");
  assertEquals(update.description, "x");
});

Deno.test("an expired pin gives the field back to the Enricher", () => {
  const pins = activeFieldPins(readFieldPins(pinned("hours", PAST)));
  const { update, skipped } = stripPinnedColumns({ hours: { mon: "x" } }, pins);
  assertEquals(skipped, []);
  assertEquals(update.hours, { mon: "x" });
});

Deno.test("the reservation endpoint pins BOTH of its columns", () => {
  // channel and value are written as a pair; protecting one and not the other
  // leaves a channel pointing at a stale number.
  const pins = activeFieldPins(
    readFieldPins(pinned("reservation_endpoint", FUTURE)),
  );
  const { update, skipped } = stripPinnedColumns(
    { reservation_channel: "phone", reservation_target: "+5215500000000" },
    pins,
  );
  assertEquals(skipped, ["reservation_endpoint"]);
  assertEquals(Object.keys(update), []);
});

Deno.test("a pin on a field the payload does not carry reports nothing", () => {
  // Absent keys are untouched by the persist contract, so there is no write to
  // stand down from and nothing honest to report.
  const pins = activeFieldPins(readFieldPins(pinned("phone", FUTURE)));
  const { skipped } = stripPinnedColumns({ address: "Calle 1" }, pins);
  assertEquals(skipped, []);
});

Deno.test("garbage in enrichment_sources never freezes a field", () => {
  // The failure mode of guessing is a column the Enricher can never write
  // again, so anything that is not a recognisable pin record yields no pin.
  const cases: unknown[] = [
    null,
    "pins",
    { [FIELD_PINS_KEY]: "hours" },
    { [FIELD_PINS_KEY]: { hours: {} } },
    { [FIELD_PINS_KEY]: { hours: { source: "reservationist" } } }, // no expiry
    { [FIELD_PINS_KEY]: { hours: { source: "martian", pinnedUntil: FUTURE } } },
    { [FIELD_PINS_KEY]: { hours: { source: "admin", pinnedUntil: "soon" } } },
    { [FIELD_PINS_KEY]: { name: { source: "admin", pinnedUntil: FUTURE } } }, // not correctable
  ];
  for (const raw of cases) {
    assertEquals(
      Object.keys(readFieldPins(raw)),
      [],
      `must yield no pin: ${JSON.stringify(raw)}`,
    );
  }
});

Deno.test("identity and generated prose are not correctable", () => {
  // The spine and the Enricher's own output are outside the loop on purpose.
  const columns = Object.values(CORRECTABLE_FIELD_COLUMNS).flat();
  for (const forbidden of ["name", "google_name", "google_place_id", "description"]) {
    assertEquals(
      columns.includes(forbidden),
      false,
      `${forbidden} must never be pinnable`,
    );
  }
});

Deno.test("Ojo never auto-applies; the venue's own team always does", () => {
  const base = {
    placeId: "p",
    field: "hours" as const,
    value: null,
    evidence: "e",
    observedAt: PAST,
  };
  assertEquals(
    autoApplies({ ...base, source: "ojo", confidence: 1 }),
    false,
  );
  assertEquals(
    autoApplies({ ...base, source: "business", confidence: 0 }),
    true,
  );
  assertEquals(
    autoApplies({ ...base, source: "reservationist", confidence: 0.79 }),
    false,
  );
  assertEquals(CORRECTION_AUTO_APPLY_FLOOR.reservationist, 0.8);
  assertEquals(CORRECTION_PIN_DAYS, 90);
});

Deno.test("activeFieldPins keeps every unexpired field, not just the first", () => {
  const pins: FieldPins = {
    hours: { source: "reservationist", confidence: 0.9, pinnedUntil: FUTURE },
    phone: { source: "business", confidence: 1, pinnedUntil: FUTURE },
    address: { source: "admin", confidence: 1, pinnedUntil: PAST },
  };
  assertEquals(Object.keys(activeFieldPins(pins)).sort(), ["hours", "phone"]);
});
